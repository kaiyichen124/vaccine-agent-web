from __future__ import annotations

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
WORKFLOW = HERE / "vaccine_agent_v18_structured_policy.yml"
RULES = HERE / "clinical_policy_rules_v1.json"


def load_policy_main(workflow: dict):
    policy_node = next(
        node
        for node in workflow["workflow"]["graph"]["nodes"]
        if node["id"] == "deepseek_independent_review_v13"
    )
    namespace: dict = {}
    exec(compile(policy_node["data"]["code"], "v18-policy-node", "exec"), namespace)
    return namespace["main"]


def program() -> dict:
    return {
        "reference_date": "2026-09-08",
        "age_months": 36,
        "sex": "FEMALE",
        "history_complete": True,
        "vaccines": [
            {
                "vaccine_id": "mmr",
                "display_name": "麻腮风疫苗",
                "program_state": "PROGRAM_DUE",
                "next_dose": 2,
                "earliest_date": "2026-09-08",
                "products": [],
                "calculation_notes": ["达到补种年龄且满足最小间隔。"],
            },
            {
                "vaccine_id": "varicella",
                "display_name": "水痘疫苗",
                "program_state": "PROGRAM_DUE",
                "next_dose": 1,
                "earliest_date": "2026-09-08",
                "products": [],
                "calculation_notes": ["达到接种年龄。"],
            },
            {
                "vaccine_id": "dtap",
                "display_name": "百白破疫苗",
                "program_state": "PROGRAM_DUE",
                "next_dose": 4,
                "earliest_date": "2026-09-08",
                "products": [],
                "calculation_notes": ["达到补种年龄且满足最小间隔。"],
            },
        ],
    }


CASES = {
    "active_chemo": {
        "clinical_summary": "白血病患儿正在化疗。",
        "acute_status": "ACTIVE",
        "clinical_facts": {"current_stability": "ACTIVE"},
        "diagnoses": [{"category_id": "LEUKEMIA_CHEMOTHERAPY", "activity": "ACTIVE"}],
        "treatments": [{"type": "CHEMOTHERAPY", "status": "ONGOING"}],
    },
    "high_dose_systemic_steroid": {
        "clinical_summary": "正在口服泼尼松2 mg/kg/日。",
        "acute_status": "ABSENT",
        "clinical_facts": {"current_stability": "STABLE"},
        "diagnoses": [],
        "treatments": [{"type": "CORTICOSTEROID", "status": "ONGOING", "route_class": "SYSTEMIC", "intensity": "HIGH"}],
    },
    "ivig_known": {
        "clinical_summary": "2026-06-18使用IVIG 2 g/kg。",
        "acute_status": "RECOVERED",
        "clinical_facts": {"current_stability": "STABLE"},
        "diagnoses": [{"category_id": "IVIG_USE", "activity": "RECOVERED"}],
        "treatments": [{"type": "IVIG", "status": "ENDED", "dose": "2 g/kg", "last_date": "2026-06-18"}],
    },
    "chemo_ended_immune_unknown": {
        "clinical_summary": "化疗结束18个月，免疫重建结果未提供。",
        "acute_status": "RECOVERED",
        "clinical_facts": {"current_stability": "STABLE", "immune_reconstitution_status": "UNKNOWN"},
        "diagnoses": [{"category_id": "LEUKEMIA_CHEMOTHERAPY", "activity": "RECOVERED"}],
        "treatments": [{"type": "CHEMOTHERAPY", "status": "ENDED", "end_date": "2025-03-08"}],
    },
    "hsct_immune_unknown": {
        "clinical_summary": "造血干细胞移植后25个月，免疫重建结果未提供。",
        "acute_status": "RECOVERED",
        "clinical_facts": {"current_stability": "STABLE", "immune_reconstitution_status": "UNKNOWN", "current_immunosuppression_status": "ABSENT", "gvhd_status": "ABSENT"},
        "diagnoses": [{"category_id": "ALLOGENEIC_HSCT", "activity": "RECOVERED"}],
        "treatments": [{"type": "HSCT", "status": "ENDED", "last_date": "2024-08-08"}],
    },
    "solid_organ_transplant_on_is": {
        "clinical_summary": "肝移植后持续使用免疫抑制剂。",
        "acute_status": "RECOVERED",
        "clinical_facts": {"current_stability": "STABLE", "current_immunosuppression_status": "PRESENT"},
        "diagnoses": [{"category_id": "SOLID_ORGAN_TRANSPLANT", "activity": "STABLE"}],
        "treatments": [{"type": "SOLID_ORGAN_TRANSPLANT", "status": "ENDED"}, {"type": "IMMUNOSUPPRESSANT", "status": "ONGOING"}],
    },
    "stable_eczema": {
        "clinical_summary": "湿疹稳定，无急性发作。",
        "acute_status": "ABSENT",
        "clinical_facts": {"current_stability": "STABLE"},
        "diagnoses": [{"category_id": "ECZEMA", "activity": "STABLE"}],
        "treatments": [],
    },
    "seizure_pending": {
        "clinical_summary": "近期反复无热惊厥，病因诊断未明确。",
        "acute_status": "ABSENT",
        "clinical_facts": {"current_stability": "STABLE", "recent_seizure_status": "DIAGNOSIS_PENDING"},
        "diagnoses": [{"category_id": "FEBRILE_SEIZURE", "activity": "ACTIVE"}],
        "treatments": [],
    },
}


EXPECTED = {
    "active_chemo": "DEFER",
    "high_dose_systemic_steroid": "DEFER",
    "ivig_known": "ROUTINE_CATCHUP",
    "chemo_ended_immune_unknown": "FURTHER_EVALUATION",
    "hsct_immune_unknown": "FURTHER_EVALUATION",
    "solid_organ_transplant_on_is": "INACTIVATED_ONLY",
    "stable_eczema": "ROUTINE_CATCHUP",
    "seizure_pending": "FURTHER_EVALUATION",
}


def main() -> None:
    workflow = json.loads(WORKFLOW.read_text(encoding="utf-8"))
    rules = json.loads(RULES.read_text(encoding="utf-8"))
    nodes = workflow["workflow"]["graph"]["nodes"]
    for node in nodes:
        if node.get("data", {}).get("type") == "code":
            compile(node["data"]["code"], f"node:{node['data'].get('title')}", "exec")
    policy_main = load_policy_main(workflow)
    failures = []
    results = []
    for case_id, facts in CASES.items():
        output = policy_main(json.dumps(facts, ensure_ascii=False), json.dumps(program(), ensure_ascii=False))
        result = json.loads(output["result_json"])
        state = result["overall_recommendation_state"]
        actions = sum(item["decision_state"] in {"NOW_DUE", "CATCHUP_DUE"} for item in result["vaccines"])
        row = {"case_id": case_id, "state": state, "actions": actions, "matched_rules": [item["rule_id"] for item in result["policy_trace"]]}
        if case_id == "ivig_known":
            ivig_items = {item["vaccine_id"]: item for item in result["vaccines"]}
            row["mmr"] = {"state": ivig_items["mmr"]["decision_state"], "earliest_date": ivig_items["mmr"]["earliest_date"]}
            row["varicella"] = {"state": ivig_items["varicella"]["decision_state"], "earliest_date": ivig_items["varicella"]["earliest_date"]}
            if row["mmr"] != {"state": "NOT_YET_DUE", "earliest_date": "2027-05-18"} or row["varicella"] != {"state": "NOT_YET_DUE", "earliest_date": "2027-05-18"}:
                failures.append(f"{case_id}: IVIG interval calculation failed")
        if state != EXPECTED[case_id]:
            failures.append(f"{case_id}: expected {EXPECTED[case_id]}, got {state}")
        if state in {"DEFER", "FURTHER_EVALUATION"} and actions:
            failures.append(f"{case_id}: blocking state still has {actions} actions")
        results.append(row)
    print(json.dumps({"workflow_nodes": len(nodes), "rules": len(rules["rules"]), "results": results, "failures": failures}, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
