# Vaccine Agent v18

This directory contains the Dify workflow release that separates clinical fact extraction, deterministic vaccination-program calculation, structured clinical-policy evaluation, and caregiver-facing text generation.

## Files

- `vaccine_agent_v18_structured_policy.yml`: importable Dify workflow.
- `clinical_policy_rules_v1.json`: versioned structured clinical-policy rules embedded into the workflow during the build.
- `build_structured_policy_workflow.py`: builder based on the v17 minimal-code workflow.
- `validate_v18_workflow.py`: offline compilation and policy-regression checks.

## Validation status

- Offline policy regression: 8/8 scenarios passed.
- Dify API test on 20 unseen cases: 17 passed and 3 failed.
- Known review items: IVIG acceptance criteria, seizure-state priority, and 22q11.2/immune-information matching.

API keys and local test result directories are intentionally excluded from this release.
