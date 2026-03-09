# Telegram Bot (Production Minimal)

## Core principle
- Bot is coordinator only.
- Funds are always locked/released by smart contracts.
- Admin cannot access user funds.

## Commands
- `/start`
- `/deal @seller amount token`
- `/pay <dealId> [escrowId]`
- `/release <dealId>`
- `/dispute <dealId>`
- `/status [dealId]`
- `/help`

## Deep link
Set `BOT_USERNAME` and bot buttons will open:
`https://t.me/<BOT_USERNAME>/app?startapp=deal_<id>:<action>:<sig>`

`sig` is HMAC-SHA256 generated with `DEEPLINK_SECRET`.

## Mapping
`telegramDealId -> contractEscrowId` is persisted in local file.
- Default: `apps/telegram-bot/data/deals.json`
- Override with `DEAL_STORE_PATH`

## Run
```bash
cp apps/telegram-bot/.env.example apps/telegram-bot/.env
pnpm --filter @dgp/telegram-bot start
```

Required env:
- `BOT_TOKEN`
- `BOT_USERNAME`
- `MINIAPP_URL`
- `DEEPLINK_SECRET`
- `ESCROW_FACTORY`
- `DISPUTE_MODULE`
- `AUTH_SERVER_PORT` (for Telegram initData verification API)

## Telegram initData verify API
Bot process starts a minimal endpoint:
- `POST /auth/telegram/verify`
- body: `{ "initData": "<Telegram WebApp initData>" }`
- success: `200 { ok: true, user }`
- failure: `403 { ok: false, error }`

## PM2
```bash
pm2 start apps/telegram-bot/ecosystem.config.cjs
pm2 save
pm2 startup
```

## Security notes
- Keep `MINIAPP_URL` fixed and official.
- Show official contract address in `/start`.
- Never accept off-chain payment confirmations.
