from __future__ import annotations

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
WORKFLOW = HERE / "vaccine_agent_v19_orthogonal_decisions.yml"


def code_main(nodes: list[dict], node_id: str):
    current = next(node for node in nodes if node["id"] == node_id)
    namespace: dict = {}
    exec(compile(current["data"]["code"], f"node:{current['data']['title']}", "exec"), namespace)
    return namespace["main"]


def program() -> dict:
    def vaccine(vaccine_id: str, state: str, products=None):
        return {
            "vaccine_id": vaccine_id,
            "display_name": vaccine_id,
            "program_state": state,
            "next_dose": 1,
            "earliest_date": "2026-09-09" if state == "PROGRAM_DUE" else None,
            "products": products or [],
            "calculation_notes": [],
        }

    return {
        "reference_date": "2026-09-09",
        "age_months": 36,
        "sex": "MALE",
        "history_complete": True,
        "vaccines": [
            vaccine("hep_b", "COMPLETED"),
            vaccine("dtap", "PROGRAM_DUE"),
            vaccine("mmr", "PROGRAM_DUE"),
            vaccine("flu", "NO_RECORD"),
            vaccine("varicella", "NO_RECORD"),
            vaccine("rotavirus", "NO_RECORD"),
            vaccine("ppsv23", "NO_RECORD"),
        ],
    }


def by_id(result: dict) -> dict[str, dict]:
    return {item["vaccine_id"]: item for item in result["vaccines"]}


def main() -> None:
    workflow = json.loads(WORKFLOW.read_text(encoding="utf-8"))
    nodes = workflow["workflow"]["graph"]["nodes"]
    for current in nodes:
        if current.get("data", {}).get("type") == "code":
            compile(current["data"]["code"], f"node:{current['data'].get('title')}", "exec")
    policy = code_main(nodes, "deepseek_independent_review_v13")
    calculator = code_main(nodes, "fusion_case_rules_v8")
    assembler = code_main(nodes, "deepseek_conflict_comparator_v13")
    validator = code_main(nodes, "v16_output_contract_validator")
    failures = []

    empty_complete_facts = {
        "demographics": {"age_months": 36, "sex": "MALE", "assessment_date": "2026-09-09"},
        "clinical_summary": "3岁男童，健康，无用药及免疫异常。",
        "acute_status": "ABSENT",
        "clinical_facts": {"current_stability": "STABLE"},
        "diagnoses": [], "treatments": [], "vaccinations": [],
    }
    empty_complete_calc = calculator(
        "评估日期：2026-09-09\n年龄：3岁\n性别：男\n健康。",
        json.dumps(empty_complete_facts, ensure_ascii=False),
        json.dumps({"record_state": "COMPLETE", "events": []}, ensure_ascii=False),
        "true",
    )
    empty_complete_policy = policy(json.dumps(empty_complete_facts, ensure_ascii=False), empty_complete_calc["decision_json"])
    empty_complete_result = json.loads(empty_complete_policy["result_json"])
    empty_items = by_id(empty_complete_result)
    if empty_complete_result["decision_summary"]["now_due_count"] != 6:
        failures.append(f"empty complete now_due_count={empty_complete_result['decision_summary']['now_due_count']}")
    if empty_items["rotavirus"]["schedule_status"] != "AGE_OUT":
        failures.append("empty complete rotavirus was not AGE_OUT")
    if empty_items["ppsv23"]["schedule_status"] != "NO_INDICATION":
        failures.append("empty complete PPSV23 was not NO_INDICATION")

    healthy = {"clinical_summary": "健康3岁儿童", "acute_status": "ABSENT", "clinical_facts": {"current_stability": "STABLE"}, "diagnoses": [], "treatments": []}
    raw = policy(json.dumps(healthy, ensure_ascii=False), json.dumps(program(), ensure_ascii=False))
    assembled = assembler(raw["result_json"], json.dumps(program(), ensure_ascii=False), [])
    result = json.loads(assembled["result_json"])
    items = by_id(result)
    expected = {
        "dtap": ("ALLOWED", "DUE", "SUFFICIENT", "NIP", "CATCHUP_DUE"),
        "varicella": ("ALLOWED", "UNKNOWN", "MISSING_PRODUCT", "NON_NIP", "PRODUCT_NEEDED"),
        "rotavirus": ("ALLOWED", "AGE_OUT", "SUFFICIENT", "NON_NIP", "NOT_YET_DUE"),
        "ppsv23": ("ALLOWED", "NO_INDICATION", "SUFFICIENT", "SPECIAL_INDICATION", "NO_INDICATION"),
    }
    for vaccine_id, wanted in expected.items():
        got = tuple(items[vaccine_id][key] for key in ("clinical_clearance", "schedule_status", "information_status", "program_scope", "decision_state"))
        if got != wanted:
            failures.append(f"{vaccine_id}: expected {wanted}, got {got}")
    if result["decision_summary"]["now_due_count"] != 3:
        failures.append(f"healthy now_due_count={result['decision_summary']['now_due_count']}")

    acute = {**healthy, "clinical_summary": "急性高热肺炎", "acute_status": "ACTIVE", "diagnoses": [{"category_id": "INFECTIOUS_DISEASE", "activity": "ACTIVE"}]}
    acute_result = json.loads(policy(json.dumps(acute, ensure_ascii=False), json.dumps(program(), ensure_ascii=False))["result_json"])
    if acute_result["overall_recommendation_state"] != "DEFER" or any(item["clinical_clearance"] != "DEFER" for item in acute_result["vaccines"]):
        failures.append("acute disease did not defer every vaccine")

    immunosuppressed = {**healthy, "clinical_summary": "持续免疫抑制治疗", "treatments": [{"type": "IMMUNOSUPPRESSANT", "status": "ONGOING"}]}
    immune_result = json.loads(policy(json.dumps(immunosuppressed, ensure_ascii=False), json.dumps(program(), ensure_ascii=False))["result_json"])
    immune_items = by_id(immune_result)
    if immune_items["mmr"]["clinical_clearance"] != "SPECIALIST_REVIEW" or immune_items["dtap"]["clinical_clearance"] != "ALLOWED":
        failures.append("inactivated-only split failed")

    ivig = {**healthy, "clinical_summary": "IVIG后", "treatments": [{"type": "IVIG", "status": "ENDED", "dose": "2 g/kg", "last_date": "2026-06-18"}]}
    ivig_result = json.loads(policy(json.dumps(ivig, ensure_ascii=False), json.dumps(program(), ensure_ascii=False))["result_json"])
    ivig_mmr = by_id(ivig_result)["mmr"]
    if (ivig_mmr["schedule_status"], ivig_mmr["earliest_date"]) != ("NOT_DUE", "2027-05-18"):
        failures.append("IVIG interval split failed")

    corrected = validator("有3项现在可以安排。\n目前没有需要立即处理的项目。", assembled["result"], assembled["result_json"])
    if "没有需要立即处理" in corrected["result"]:
        failures.append("contradictory text was not removed")

    output = {
        "nodes": len(nodes),
        "release": result["deployment_contract"]["release"],
        "healthy_summary": result["decision_summary"],
        "empty_complete_summary": empty_complete_result["decision_summary"],
        "acute_state": acute_result["overall_recommendation_state"],
        "immunosuppressed_state": immune_result["overall_recommendation_state"],
        "ivig_mmr": {"schedule_status": ivig_mmr["schedule_status"], "earliest_date": ivig_mmr["earliest_date"]},
        "validator_report": json.loads(corrected["validation_report"]),
        "failures": failures,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
