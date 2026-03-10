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

## No nano / no editor setup

If you don't want to open `nano`, write `.env` directly with heredoc:

```bash
cat > apps/telegram-bot/.env <<'EOF'
BOT_TOKEN=your_bot_token
BOT_USERNAME=your_bot_username
MINIAPP_URL=https://t.me/your_bot_username
DEEPLINK_SECRET=replace_with_a_long_random_secret
AUTH_SERVER_PORT=8787

DGP_LANG=zh-CN
DGP_NETWORK=arbSepolia
RPC_URL=

ESCROW_FACTORY=0x0000000000000000000000000000000000000000
DISPUTE_MODULE=0x0000000000000000000000000000000000000000
TELEGRAM_ANNOUNCE_CHAT_ID=

DEAL_STORE_PATH=
EOF
```

Then start the bot:

```bash
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

## Localization (汉化)

Bot language is controlled by environment variables:

- `DGP_LANG` (recommended)
- `DGP_BOT_LANG` (backward compatibility)
- fallback to system `LANG`

Supported values:

- `zh-CN` (default, Chinese)
- `en` (English)

Example:

```bash
DGP_LANG=zh-CN pnpm --filter @dgp/telegram-bot start
```

Or in `.env`:

```env
DGP_LANG=zh-CN
```

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
