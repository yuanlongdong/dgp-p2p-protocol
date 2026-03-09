module.exports = {
  apps: [
    {
      name: "dgp-telegram-bot",
      cwd: "/root/codex",
      script: "pnpm",
      args: "--filter @dgp/telegram-bot start",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
