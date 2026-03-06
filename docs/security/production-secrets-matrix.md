# Production Secrets Matrix

| Secret Key | Purpose | Source System | Rotation | Owner | Last Rotated |
|---|---|---|---|---|---|
| PRIVATE_KEY | Deployment signer | Vault + GitHub Secrets | 30 days | DevOps | TBD |
| DEPLOYER_SAFE | Multisig safe | Config + GitHub Secrets | On change | Governance | TBD |
| MEDIATOR_OWNER | Mediator owner | Config + GitHub Secrets | On change | Governance | TBD |
| GOVERNANCE_OWNER | Governance owner | Config + GitHub Secrets | On change | Governance | TBD |
| EMERGENCY_PAUSE_ADMIN | Pause admin | Config + GitHub Secrets | On change | Security | TBD |
| CHAINLINK_FEED | Oracle feed | Chainlink + GitHub Secrets | On migration | Oracle | TBD |
| KLEROS_COURT | Kleros court | Kleros + GitHub Secrets | On migration | Dispute | TBD |
| KLEROS_ARBITRATOR | Arbitrator | Kleros + GitHub Secrets | On migration | Dispute | TBD |
