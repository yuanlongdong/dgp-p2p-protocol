# Security Baseline Checklist

## Secrets & Config
- Never commit private keys or API tokens.
- Use `.env` for sensitive values and keep `.env.example` sanitized.
- Rotate leaked credentials immediately.

## Contracts
- Require strict state transition guards.
- Enforce role checks for privileged actions.
- Add timeout/quorum protections for dispute voting.
- Cover revert paths with unit tests.

## Frontend
- Block write actions on wrong chain.
- Validate user input before tx submission.
- Show tx hash + confirmation status.
- Provide graceful error boundaries and retries.

## CI
- Run contract tests on PRs.
- Run monorepo build on PRs.
- Include dependency audit and basic secret pattern scanning.
