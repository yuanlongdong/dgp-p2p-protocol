# External Audit SOW Template

## Project
- Repo: https://github.com/yuanlongdong/dgp-p2p-protocol
- Target commit: <FILL_COMMIT_HASH>
- Audit window: <FILL_DATE_RANGE>
- Auditor: <FILL_VENDOR>

## Scope
- contracts: packages/contracts/contracts/*.sol
- governance: VeDGP, DGPGovernor, timelock path
- risk: AntiManipulationGuard + EscrowFactory integration
- deploy/config scripts in packages/contracts/scripts

## Out of Scope
- off-chain infra not owned by project
- social engineering
- third-party outage issues

## Required Deliverables
1. Findings report with severity (Critical/High/Medium/Low)
2. Repro steps + affected component + fix recommendation
3. Re-test report after fixes
4. Final sign-off letter (or residual-risk statement)

## Exit Criteria
- 0 open Critical
- 0 open High
- every Medium has owner + deadline + mitigation
- sign-off bound to exact commit hash
