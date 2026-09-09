from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "dify" / "v18" / "vaccine_agent_v18_structured_policy.yml"
RULES_PATH = ROOT / "dify" / "v18" / "clinical_policy_rules_v1.json"
OUTPUT = ROOT / "dify" / "v19" / "vaccine_agent_v19_orthogonal_decisions.yml"


POLICY_CODE_TEMPLATE = r'''import json
import re
from calendar import monthrange
from datetime import date

POLICY = __RULES_JSON__
LIVE_IDS = {"bcg", "mmr", "varicella", "rotavirus"}
PRODUCT_LIVE = {"je_live", "hep_a_live"}
NIP_IDS = {"hep_b", "bcg", "polio", "dtap", "mmr", "je", "meningococcal", "hep_a", "hpv_nip"}
SPECIAL_INDICATION_IDS = {"ppsv23"}
PROGRAM_MAP = {
    "PROGRAM_DUE": ("DUE", "SUFFICIENT"),
    "COMPLETED": ("COMPLETED", "SUFFICIENT"),
    "NOT_YET_DUE": ("NOT_DUE", "SUFFICIENT"),
    "INTERVAL_DATE_NEEDED": ("DUE", "MISSING_DATE"),
    "PRODUCT_NEEDED": ("UNKNOWN", "MISSING_PRODUCT"),
    "RECORDS_NEEDED": ("UNKNOWN", "MISSING_HISTORY"),
    "HISTORY_RECORDED": ("UNKNOWN", "MISSING_HISTORY"),
    "NO_RECORD": ("UNKNOWN", "MISSING_HISTORY"),
}


def _json(text):
    if isinstance(text, dict):
        return text
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", str(text or "").strip(), flags=re.I)
    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def _date(value):
    try:
        return date.fromisoformat(str(value)[:10])
    except Exception:
        return None


def _add_months(value, months):
    year = value.year + (value.month - 1 + months) // 12
    month = (value.month - 1 + months) % 12 + 1
    return date(year, month, min(value.day, monthrange(year, month)[1]))


def _known(value):
    return value is not None and value != "" and value != "UNKNOWN"


def _path(data, path):
    value = data
    for part in str(path or "").split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


def _compare(actual, op, expected):
    if op == "eq":
        return actual == expected
    if op == "in":
        return actual in (expected or [])
    if op == "not_in":
        return actual not in (expected or [])
    if op == "present":
        return _known(actual)
    return False


def _where(item, clauses):
    return isinstance(item, dict) and all(_compare(item.get(c.get("field")), c.get("op"), c.get("value")) for c in clauses)


def _match(data, spec):
    if not isinstance(spec, dict):
        return False
    if "all" in spec:
        return all(_match(data, child) for child in spec["all"])
    if "any" in spec:
        return any(_match(data, child) for child in spec["any"])
    value = _path(data, spec.get("path"))
    if spec.get("op") == "any":
        return isinstance(value, list) and any(_where(item, spec.get("where") or []) for item in value)
    return _compare(value, spec.get("op"), spec.get("value"))


def _treatment_fact(facts, treatment_type, field):
    values = []
    for item in facts.get("treatments", []):
        if isinstance(item, dict) and item.get("type") == treatment_type and _known(item.get(field)):
            values.append(item.get(field))
    return values[-1] if values else None


def _required_value(facts, path):
    parts = str(path).split(".")
    if len(parts) == 3 and parts[0] == "treatments":
        return _treatment_fact(facts, parts[1], parts[2])
    return _path(facts, path)


def _missing(facts, paths):
    return [path for path in (paths or []) if not _known(_required_value(facts, path))]


def _scope(vaccine_id):
    if vaccine_id in SPECIAL_INDICATION_IDS:
        return "SPECIAL_INDICATION"
    return "NIP" if vaccine_id in NIP_IDS else "NON_NIP"


def _is_live(item):
    products = set((item.get("program_calculation") or {}).get("products") or [])
    return item.get("vaccine_id") in LIVE_IDS or bool(products & PRODUCT_LIVE)


def _legacy(item):
    clearance = item.get("clinical_clearance")
    schedule = item.get("schedule_status")
    info = item.get("information_status")
    if clearance == "DEFER":
        return "TEMPORARILY_DEFERRED"
    if clearance == "SPECIALIST_REVIEW":
        return "MEDICAL_REVIEW"
    if schedule == "COMPLETED":
        return "COMPLETED"
    if schedule in {"NOT_DUE", "AGE_OUT"}:
        return "NOT_YET_DUE"
    if schedule == "NO_INDICATION":
        return "NO_INDICATION"
    if schedule == "DUE" and info == "SUFFICIENT":
        return "CATCHUP_DUE"
    if schedule == "DUE" and info == "MISSING_DATE":
        return "CONDITIONALLY_DUE"
    if info == "MISSING_PRODUCT":
        return "PRODUCT_NEEDED"
    return "RECORDS_NEEDED"


def _base_vaccines(program, facts):
    complete = bool(program.get("history_complete"))
    age = program.get("age_months")
    healthy = not facts.get("diagnoses") and not facts.get("treatments") and facts.get("acute_status") in {"ABSENT", "RECOVERED"}
    items = []
    for calc in program.get("vaccines", []):
        if not isinstance(calc, dict):
            continue
        vaccine_id = str(calc.get("vaccine_id") or "")
        schedule, info = PROGRAM_MAP.get(str(calc.get("program_state") or ""), ("UNKNOWN", "MISSING_HISTORY"))
        if complete and calc.get("program_state") == "NO_RECORD":
            if vaccine_id == "flu" and isinstance(age, int) and age >= 6:
                schedule, info = "DUE", "SUFFICIENT"
            elif vaccine_id == "rotavirus" and isinstance(age, int) and age >= 36:
                schedule, info = "AGE_OUT", "SUFFICIENT"
            elif vaccine_id == "ppsv23" and healthy:
                schedule, info = "NO_INDICATION", "SUFFICIENT"
            else:
                schedule, info = "UNKNOWN", "MISSING_PRODUCT"
        item = {
            "vaccine_id": vaccine_id,
            "display_name": calc.get("display_name") or vaccine_id,
            "clinical_clearance": "ALLOWED",
            "schedule_status": schedule,
            "information_status": info,
            "program_scope": _scope(vaccine_id),
            "decision_state": "",
            "reason": "; ".join(calc.get("calculation_notes") or []) or "依据年龄、剂次、日期和最小间隔计算。",
            "caregiver_advice": "结合接种证记录和现场健康检查安排。",
            "dose": calc.get("next_dose"),
            "earliest_date": calc.get("earliest_date"),
            "is_live": False,
            "evidence_ids": [],
            "program_calculation": calc,
        }
        item["is_live"] = _is_live(item)
        item["decision_state"] = _legacy(item)
        items.append(item)
    return items


def _summary(vaccines):
    return {
        "now_due_count": sum(v.get("clinical_clearance") == "ALLOWED" and v.get("schedule_status") == "DUE" and v.get("information_status") == "SUFFICIENT" for v in vaccines),
        "conditional_due_count": sum(v.get("clinical_clearance") == "ALLOWED" and v.get("schedule_status") == "DUE" and v.get("information_status") != "SUFFICIENT" for v in vaccines),
        "information_needed_count": sum(v.get("clinical_clearance") == "ALLOWED" and v.get("information_status") != "SUFFICIENT" for v in vaccines),
        "specialist_review_count": sum(v.get("clinical_clearance") == "SPECIALIST_REVIEW" for v in vaccines),
        "deferred_count": sum(v.get("clinical_clearance") == "DEFER" for v in vaccines),
        "no_action_count": sum(v.get("schedule_status") in {"COMPLETED", "NOT_DUE", "AGE_OUT", "NO_INDICATION"} for v in vaccines),
    }


def main(semantic_facts: str, program_json: str) -> dict:
    facts = _json(semantic_facts)
    program = _json(program_json)
    trace = []
    candidates = []
    for rule in POLICY.get("rules", []):
        if not _match(facts, rule.get("match")):
            continue
        missing = _missing(facts, rule.get("required_facts"))
        effect = rule.get("missing_effect") if missing and rule.get("missing_effect") else rule.get("effect", {})
        entry = {"rule_id": rule.get("rule_id"), "title": rule.get("title"), "priority": rule.get("priority", 0), "missing_facts": missing, "effect": effect, "evidence_ids": rule.get("evidence_ids", []), "caregiver_reason": rule.get("caregiver_reason", "")}
        trace.append(entry)
        candidates.append(entry)
    if not candidates:
        candidates.append({"rule_id": "POL-DEFAULT-ROUTINE", "title": "默认常规路径", "priority": 0, "missing_facts": [], "effect": {"overall_state": "ROUTINE_CATCHUP", "gate": "ROUTINE", "block": "NONE"}, "evidence_ids": ["CN_NIP_2026"], "caregiver_reason": "未识别到需要改变常规接种方向的明确高风险条件。"})
        trace.extend(candidates)

    state_priority = POLICY.get("state_priority", {})
    overall = max((entry["effect"].get("overall_state", "ROUTINE_CATCHUP") for entry in candidates), key=lambda state: state_priority.get(state, 0))
    decisive = max((entry for entry in candidates if entry["effect"].get("overall_state") == overall), key=lambda entry: entry.get("priority", 0))
    vaccines = _base_vaccines(program, facts)
    assessment = _date(program.get("reference_date")) or date.today()
    audit = []

    for entry in sorted(candidates, key=lambda value: value.get("priority", 0), reverse=True):
        effect = entry.get("effect") or {}
        block = effect.get("block", "NONE")
        for item in vaccines:
            if overall == "DEFER" or block == "ALL_ACTIONS" and effect.get("overall_state") == "DEFER":
                item["clinical_clearance"] = "DEFER"
                item["reason"] = entry.get("caregiver_reason") or item["reason"]
            elif overall == "FURTHER_EVALUATION" or block == "ALL_ACTIONS":
                item["clinical_clearance"] = "SPECIALIST_REVIEW"
                item["reason"] = entry.get("caregiver_reason") or item["reason"]
            elif block == "LIVE_ACTIONS" and item["is_live"]:
                item["clinical_clearance"] = "SPECIALIST_REVIEW"
                item["reason"] = entry.get("caregiver_reason") or item["reason"]
            elif block == "VACCINE_TYPES_UNTIL_INTERVAL" and item["vaccine_id"] in set(effect.get("vaccine_ids") or []):
                last_date = _date(_treatment_fact(facts, "IVIG", "last_date"))
                if last_date:
                    earliest = _add_months(last_date, int(effect.get("interval_months") or 0))
                    if assessment < earliest and item["schedule_status"] != "COMPLETED":
                        item["schedule_status"] = "NOT_DUE"
                        item["information_status"] = "SUFFICIENT"
                        item["earliest_date"] = earliest.isoformat()
                        item["reason"] = entry.get("caregiver_reason") or item["reason"]
                        audit.append({"rule_id": entry["rule_id"], "vaccine_id": item["vaccine_id"], "action": "INTERVAL_BLOCKED", "earliest_date": earliest.isoformat()})
            if entry.get("evidence_ids"):
                item["evidence_ids"] = sorted(set(item.get("evidence_ids", []) + entry["evidence_ids"]))

    for item in vaccines:
        item["decision_state"] = _legacy(item)
    summary = _summary(vaccines)
    if overall == "ROUTINE_VACCINATION" and summary["now_due_count"]:
        overall = "ROUTINE_CATCHUP"
    headlines = {"ROUTINE_VACCINATION": "常规接种", "ROUTINE_CATCHUP": "常规补种", "INACTIVATED_ONLY": "建议接种灭活疫苗", "DEFER": "暂缓接种", "FURTHER_EVALUATION": "需进一步评估"}
    missing_facts = sorted(set(path for entry in candidates for path in entry.get("missing_facts", [])))
    result = {
        "schema_version": "vaccine-decision-v19",
        "decision_model": "ORTHOGONAL_V1",
        "overall_recommendation_state": overall,
        "patient_decision": {"gate": decisive["effect"].get("gate", "ROUTINE"), "headline": headlines[overall], "alert": decisive.get("caregiver_reason", ""), "critical_missing": missing_facts, "targeted_questions": missing_facts},
        "health_summary": facts.get("clinical_summary", ""),
        "vaccines": vaccines,
        "decision_summary": summary,
        "next_steps": (["补充会改变接种安全方向的关键信息后，由专科和接种门诊复核。"] if overall == "FURTHER_EVALUATION" else ["携带接种证和相关病历，由接种门诊核对后安排。"]),
        "sources": [], "policy_trace": trace, "policy_audit": audit,
    }
    raw = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
    report = {"matched_rules": [entry["rule_id"] for entry in trace], "decision_summary": summary, "audit": audit}
    return {"result": raw, "result_json": raw, "generation_context": raw, "validation_report": json.dumps(report, ensure_ascii=False, separators=(",", ":"))}
'''


ASSEMBLER_CODE = r'''import json
import re


def _json(text):
    try:
        value = json.loads(str(text or ""))
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def _legacy(item):
    clearance, schedule, info = item.get("clinical_clearance"), item.get("schedule_status"), item.get("information_status")
    if clearance == "DEFER": return "TEMPORARILY_DEFERRED"
    if clearance == "SPECIALIST_REVIEW": return "MEDICAL_REVIEW"
    if schedule == "COMPLETED": return "COMPLETED"
    if schedule in {"NOT_DUE", "AGE_OUT"}: return "NOT_YET_DUE"
    if schedule == "NO_INDICATION": return "NO_INDICATION"
    if schedule == "DUE" and info == "SUFFICIENT": return "CATCHUP_DUE"
    if schedule == "DUE" and info == "MISSING_DATE": return "CONDITIONALLY_DUE"
    if info == "MISSING_PRODUCT": return "PRODUCT_NEEDED"
    return "RECORDS_NEEDED"


def _summary(vaccines):
    return {
        "now_due_count": sum(v.get("clinical_clearance") == "ALLOWED" and v.get("schedule_status") == "DUE" and v.get("information_status") == "SUFFICIENT" for v in vaccines),
        "conditional_due_count": sum(v.get("clinical_clearance") == "ALLOWED" and v.get("schedule_status") == "DUE" and v.get("information_status") != "SUFFICIENT" for v in vaccines),
        "information_needed_count": sum(v.get("clinical_clearance") == "ALLOWED" and v.get("information_status") != "SUFFICIENT" for v in vaccines),
        "specialist_review_count": sum(v.get("clinical_clearance") == "SPECIALIST_REVIEW" for v in vaccines),
        "deferred_count": sum(v.get("clinical_clearance") == "DEFER" for v in vaccines),
        "no_action_count": sum(v.get("schedule_status") in {"COMPLETED", "NOT_DUE", "AGE_OUT", "NO_INDICATION"} for v in vaccines),
    }


def _source(item, index):
    if not isinstance(item, dict): return None
    metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
    title = str(metadata.get("document_name") or metadata.get("file_name") or item.get("title") or f"知识库证据{index}")
    content = str(item.get("content") or item.get("text") or "")
    ids = sorted(set(re.findall(r"\b(?:CN|CDC|WHO)_[A-Z0-9_]+\b", content)))
    return {"evidence_id": ids[0] if ids else f"KB-{index}", "title": title, "location": str(metadata.get("position") or metadata.get("page") or ""), "score": item.get("score")}


def main(policy_decision_json: str, program_json: str, retrieval_result) -> dict:
    decision = _json(policy_decision_json)
    program = _json(program_json)
    overall = str(decision.get("overall_recommendation_state") or "FURTHER_EVALUATION")
    errors, seen, vaccines = [], set(), []
    for raw in decision.get("vaccines", []):
        if not isinstance(raw, dict): continue
        vaccine_id = str(raw.get("vaccine_id") or "")
        if not vaccine_id or vaccine_id in seen:
            errors.append("DUPLICATE_OR_EMPTY_VACCINE_REMOVED")
            continue
        seen.add(vaccine_id)
        if overall == "DEFER": raw["clinical_clearance"] = "DEFER"
        elif overall == "FURTHER_EVALUATION": raw["clinical_clearance"] = "SPECIALIST_REVIEW"
        if raw.get("clinical_clearance") not in {"ALLOWED", "DEFER", "SPECIALIST_REVIEW"}:
            raw["clinical_clearance"] = "SPECIALIST_REVIEW"; errors.append("INVALID_CLEARANCE_CORRECTED")
        if raw.get("schedule_status") not in {"DUE", "COMPLETED", "NOT_DUE", "AGE_OUT", "NO_INDICATION", "UNKNOWN"}:
            raw["schedule_status"] = "UNKNOWN"; errors.append("INVALID_SCHEDULE_CORRECTED")
        if raw.get("information_status") not in {"SUFFICIENT", "MISSING_DATE", "MISSING_PRODUCT", "MISSING_HISTORY"}:
            raw["information_status"] = "MISSING_HISTORY"; errors.append("INVALID_INFORMATION_CORRECTED")
        raw["decision_state"] = _legacy(raw)
        vaccines.append(raw)
    summary = _summary(vaccines)
    decision["vaccines"] = vaccines
    decision["decision_summary"] = summary
    decision["sources"] = [source for source in (_source(item, i) for i, item in enumerate(retrieval_result or [], 1)) if source]
    decision["parent_view"] = {
        "visible_vaccine_ids": [v.get("vaccine_id") for v in vaccines if v.get("clinical_clearance") == "ALLOWED" and v.get("schedule_status") == "DUE"],
        "health_summary": decision.get("health_summary", ""),
        "summary": {**summary, "action_count": summary["now_due_count"], "zero_action_explanation": "" if summary["now_due_count"] else "当前没有已满足直接安排条件的项目。"},
    }
    decision["processing_status"] = "READY"
    decision["critical_errors"] = []
    decision["reference_date"] = program.get("reference_date")
    decision["case_summary"] = {"age_months": program.get("age_months"), "sex": program.get("sex"), "vaccination_mode": "COMPLETE" if program.get("history_complete") else "PARTIAL"}
    decision["deployment_contract"] = {"release": "v19.0-orthogonal-decisions", "clinical_fact_owner": "DeepSeek", "decision_owner": "STRUCTURED_POLICY_ENGINE", "code_scope": ["age_date_dose_interval", "combination_expansion", "orthogonal_policy_evaluation", "safety_consistency"]}
    decision["safety_audit"] = sorted(set(errors))
    compact = {key: decision.get(key) for key in ("processing_status", "overall_recommendation_state", "patient_decision", "health_summary", "decision_summary", "parent_view", "vaccines", "next_steps", "sources", "policy_trace", "policy_audit", "safety_audit")}
    raw = json.dumps(decision, ensure_ascii=False, separators=(",", ":"))
    report = {"status": "PASS" if not errors else "CORRECTED", "decision_summary": summary, "audit": errors}
    return {"result": raw, "result_json": raw, "generation_context": json.dumps(compact, ensure_ascii=False, separators=(",", ":")), "validation_report": json.dumps(report, ensure_ascii=False, separators=(",", ":"))}
'''


PARENT_PROMPT = r'''你是面向患儿看护人的疫苗宣教材料生成器。结构化规则引擎已经完成决定，你只负责准确展示，不得重新计算、补充或更改疫苗结论。

每种疫苗有四个独立维度：clinical_clearance表示临床能否接种；schedule_status表示程序状态；information_status表示资料完整度；program_scope表示免疫规划属性。decision_state仅用于旧前端兼容，不作为解释依据。

严格使用decision_summary中的数字：now_due_count大于0时必须写“有N项现在可以安排”，禁止出现“没有需要立即处理的项目”；等于0时才可说明当前无直接安排项目。

依次输出：孩子目前情况；总体建议；本次最需要关注；疫苗安排；下一步；主要依据；提示。

疫苗安排规则：
1. ALLOWED+DUE+SUFFICIENT列入“现在可以安排”。
2. DEFER列入“暂缓”；SPECIALIST_REVIEW列入“专业评估”。
3. MISSING_PRODUCT写“需确认产品或接种意愿”，禁止写“需进一步评估”。
4. MISSING_DATE写“需核对上一剂日期”。
5. AGE_OUT和NO_INDICATION通常不展开，必要时各用一句说明。
6. COMPLETED和NOT_DUE仅做简短汇总。
7. 不得根据常识新增剂次、日期、年龄窗口或疫苗名称。

总体建议必须逐字使用patient_decision.headline。提示固定为：本材料用于科研原型和疫苗接种宣教，需由研究人员或预防接种专业人员审核，接种安排以现场评估为准。'''


VALIDATOR_CODE = r'''import json
import re


def _json(text):
    try:
        value = json.loads(str(text or ""))
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def main(deepseek_text: str, deterministic_text: str, result_json: str) -> dict:
    result = _json(result_json)
    text = str(deepseek_text or "").strip()
    audit = []
    headline = str((result.get("patient_decision") or {}).get("headline") or "需进一步评估")
    summary = result.get("decision_summary") if isinstance(result.get("decision_summary"), dict) else {}
    due = int(summary.get("now_due_count") or 0)
    if due > 0 and re.search(r"(?:没有|无)(?:已经)?需要立即|当前无直接安排", text):
        text = re.sub(r"[^。\n]*(?:没有|无)(?:已经)?需要立即[^。\n]*[。]?", f"有{due}项现在可以安排。", text)
        text = re.sub(r"[^。\n]*当前无直接安排[^。\n]*[。]?", f"有{due}项现在可以安排。", text)
        audit.append("CONTRADICTORY_ZERO_ACTION_TEXT_CORRECTED")
    if due == 0 and re.search(r"有\s*[1-9]\d*\s*项现在可以安排", text):
        text = re.sub(r"有\s*[1-9]\d*\s*项现在可以安排", "当前没有已满足直接安排条件的项目", text)
        audit.append("CONTRADICTORY_ACTION_COUNT_CORRECTED")
    text = text.replace("需进一步评估接种程序判断", "需确认产品或接种意愿")
    if headline not in text:
        text = f"### 总体建议\n\n{headline}\n\n" + text
        audit.append("HEADLINE_INSERTED")
    if not text:
        text = f"### 总体建议\n\n{headline}\n\n请由预防接种专业人员复核结构化结果。"
        audit.append("EMPTY_TEXT_FALLBACK")
    report = {"status": "PASS" if not audit else "CORRECTED", "audit": audit, "decision_summary": summary}
    return {"result": text, "result_json": json.dumps(result, ensure_ascii=False, separators=(",", ":")), "validation_report": json.dumps(report, ensure_ascii=False, separators=(",", ":"))}
'''


def node(nodes: list[dict], node_id: str) -> dict:
    return next(item for item in nodes if item["id"] == node_id)


def main() -> None:
    workflow = json.loads(SOURCE.read_text(encoding="utf-8"))
    policy = json.loads(RULES_PATH.read_text(encoding="utf-8"))
    nodes = workflow["workflow"]["graph"]["nodes"]
    workflow["app"]["name"] = "儿童疫苗推荐助手 v19 正交决策版"
    workflow["app"]["description"] = "临床许可、程序状态、信息完整度和规划属性分维度输出，统一派生摘要及兼容状态。"
    policy_node = node(nodes, "deepseek_independent_review_v13")
    policy_node["data"]["title"] = "v19四维疫苗决策引擎"
    policy_node["data"]["code"] = POLICY_CODE_TEMPLATE.replace("__RULES_JSON__", json.dumps(policy, ensure_ascii=False, separators=(",", ":")))
    assembler = node(nodes, "deepseek_conflict_comparator_v13")
    assembler["data"]["title"] = "v19四维一致性与兼容状态生成"
    assembler["data"]["code"] = ASSEMBLER_CODE
    parent = node(nodes, "1787379557314")
    parent["data"]["title"] = "v19 DeepSeek看护人宣教"
    parent["data"]["prompt_template"][0]["text"] = PARENT_PROMPT
    validator = node(nodes, "v16_output_contract_validator")
    validator["data"]["title"] = "v19摘要与文本一致性检查"
    validator["data"]["code"] = VALIDATOR_CODE
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(workflow, ensure_ascii=False, indent=2), encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
