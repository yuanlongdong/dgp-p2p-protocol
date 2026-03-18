type TelegramUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  colorScheme?: string;
  platform?: string;
  version?: string;
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramUser;
  };
};

type ReputationSnapshot = {
  score: number;
  riskLevel: string;
  depositBps: number;
  feeBps: number;
  tradeLimit: string;
  warning: string;
};

type Locale = "zh-CN" | "en";

const translations: Record<Locale, Record<string, string>> = {
  "zh-CN": {
    missingApp: "缺少 #app 容器",
    guest: "访客",
    unknown: "未知",
    browser: "浏览器",
    light: "浅色",
    verifyMissing: "未验证（缺少 endpoint/initData）",
    verifyRejected: "已拒绝（{status}）",
    verifyFailed: "验证请求失败",
    verifyOk: "已验证",
    envLoaded: "已加载 Telegram WebApp 环境。",
    envOutside: "当前运行在 Telegram WebApp 之外。",
    userContext: "用户信息",
    heroTitle: "DGP MiniApp 控制台",
    heroSubtitle: "用于安全打开托管、校验 Telegram 身份，并在移动端快速进入交易流程。",
    name: "名称",
    userId: "用户 ID",
    platform: "平台",
    webAppVersion: "WebApp 版本",
    colorScheme: "配色方案",
    initDataVerify: "InitData 验证",
    statusCard: "运行状态",
    statusOnline: "已连接 WebApp",
    statusOffline: "浏览器预览模式",
    footer: "建议从 Telegram 官方入口打开，以获得完整签名校验与上下文。",
    securityTitle: "安全提示",
    securityBody: "页面仅展示 Telegram 上下文和鉴权结果，真实资金操作仍以链上签名与合约状态为准。",
    reputationTitle: "信誉与风险控制",
    reputationCopy: "实时信誉分可用于决定押金比例、手续费和可承接额度，帮助机器人与 MiniApp 提前暴露高风险交易。",
    reputationScore: "信誉分",
    riskLevel: "风险等级",
    depositRate: "押金比例",
    feeRate: "手续费",
    tradeLimit: "交易额度",
    riskWarning: "风险提示",
    riskUnavailable: "未配置信誉接口，当前显示静态占位。",
    riskLoading: "正在读取信誉快照…"
  },
  en: {
    missingApp: "Missing #app container",
    guest: "Guest",
    unknown: "N/A",
    browser: "browser",
    light: "light",
    verifyMissing: "Not verified (missing endpoint/initData)",
    verifyRejected: "Rejected ({status})",
    verifyFailed: "Verify request failed",
    verifyOk: "Verified",
    envLoaded: "Telegram WebApp context loaded.",
    envOutside: "Running outside Telegram WebApp.",
    userContext: "User Context",
    heroTitle: "DGP MiniApp Console",
    heroSubtitle: "Securely open escrow flows, verify Telegram identity, and move through deal actions faster on mobile.",
    name: "Name",
    userId: "User ID",
    platform: "Platform",
    webAppVersion: "WebApp Version",
    colorScheme: "Color Scheme",
    initDataVerify: "InitData Verify",
    statusCard: "Runtime Status",
    statusOnline: "WebApp connected",
    statusOffline: "Browser preview mode",
    footer: "Open this page from the official Telegram entry point for full signed context and verification.",
    securityTitle: "Security note",
    securityBody: "This page only shows Telegram context and auth status. Real fund actions still depend on on-chain signatures and contract state.",
    reputationTitle: "Reputation & risk controls",
    reputationCopy: "Live reputation snapshots drive deposit ratios, fee discounts, and trade-cap checks so the bot and MiniApp can warn users before risky trades proceed.",
    reputationScore: "Reputation score",
    riskLevel: "Risk level",
    depositRate: "Deposit rate",
    feeRate: "Fee",
    tradeLimit: "Trade limit",
    riskWarning: "Risk notice",
    riskUnavailable: "Reputation endpoint is not configured; showing a static placeholder.",
    riskLoading: "Loading reputation snapshot…"
  }
};

const resolveLocale = (): Locale => {
  const envLang = (import.meta as any).env?.VITE_LANG as string | undefined;
  const raw = (envLang || "zh-CN").toLowerCase();
  return raw.startsWith("en") ? "en" : "zh-CN";
};

const t = (key: string, params: Record<string, string | number> = {}) => {
  const locale = resolveLocale();
  const template = translations[locale][key] ?? translations["zh-CN"][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error(t("missingApp"));

const webApp = window.Telegram?.WebApp;
if (webApp) {
  webApp.ready();
  webApp.expand();
}

const user = webApp?.initDataUnsafe?.user;
const fallbackName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
const userName = user?.username ?? (fallbackName || t("guest"));
const userId = user?.id ?? t("unknown");
const platform = webApp?.platform ?? t("browser");
const version = webApp?.version ?? t("unknown");
const colorScheme = webApp?.colorScheme ?? t("light");
const authEndpoint = (import.meta as any).env?.VITE_TELEGRAM_AUTH_ENDPOINT as string | undefined;
const reputationEndpoint = (import.meta as any).env?.VITE_REPUTATION_ENDPOINT as string | undefined;

async function verifyInitData() {
  if (!authEndpoint || !webApp?.initData) {
    return t("verifyMissing");
  }
  try {
    const res = await fetch(authEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: webApp.initData })
    });
    return res.ok ? t("verifyOk") : t("verifyRejected", { status: res.status });
  } catch {
    return t("verifyFailed");
  }
}

async function loadReputationSnapshot(): Promise<ReputationSnapshot> {
  if (!reputationEndpoint) {
    return {
      score: 500,
      riskLevel: "MEDIUM",
      depositBps: 1200,
      feeBps: 50,
      tradeLimit: "50000",
      warning: t("riskUnavailable")
    };
  }

  try {
    const url = new URL(reputationEndpoint, window.location.href);
    if (user?.id) url.searchParams.set("telegramUserId", String(user.id));
    if (user?.username) url.searchParams.set("username", user.username);
    const res = await fetch(url.toString(), {
      headers: { accept: "application/json" }
    });
    if (!res.ok) {
      return {
        score: 500,
        riskLevel: "MEDIUM",
        depositBps: 1200,
        feeBps: 50,
        tradeLimit: "50000",
        warning: t("verifyRejected", { status: res.status })
      };
    }
    const payload = (await res.json()) as Partial<ReputationSnapshot>;
    return {
      score: Number(payload.score ?? 500),
      riskLevel: String(payload.riskLevel ?? "MEDIUM"),
      depositBps: Number(payload.depositBps ?? 1200),
      feeBps: Number(payload.feeBps ?? 50),
      tradeLimit: String(payload.tradeLimit ?? "50000"),
      warning: String(payload.warning ?? "")
    };
  } catch {
    return {
      score: 500,
      riskLevel: "MEDIUM",
      depositBps: 1200,
      feeBps: 50,
      tradeLimit: "50000",
      warning: t("riskUnavailable")
    };
  }
}

function infoRow(label: string, value: string | number) {
  return `
    <div class="info-row">
      <div class="info-label">${label}</div>
      <div class="info-value">${value}</div>
    </div>
  `;
}

Promise.all([verifyInitData(), loadReputationSnapshot()]).then(([authStatus, reputation]) => {
  const envText = webApp ? t("envLoaded") : t("envOutside");
  const runtimeStatus = webApp ? t("statusOnline") : t("statusOffline");
  app.innerHTML = `
    <main class="mini-shell">
      <style>
        :root {
          color-scheme: light;
          --bg: linear-gradient(180deg, #0f172a 0%, #172554 46%, #eef2ff 46%, #f8fafc 100%);
          --card: rgba(255, 255, 255, 0.92);
          --border: rgba(148, 163, 184, 0.24);
          --text: #0f172a;
          --muted: #475467;
          --accent: #5b8cff;
          --accent-soft: rgba(91, 140, 255, 0.14);
          --success: #027a48;
          --warning: #b54708;
        }

        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: var(--bg);
          color: var(--text);
        }
        .mini-shell {
          min-height: 100vh;
          padding: 24px 18px 40px;
        }
        .mini-container {
          max-width: 760px;
          margin: 0 auto;
        }
        .hero {
          padding: 24px;
          border-radius: 28px;
          background: radial-gradient(circle at top right, rgba(255,255,255,0.2), transparent 28%), linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%);
          color: #fff;
          box-shadow: 0 24px 54px rgba(15, 23, 42, 0.28);
          margin-bottom: 18px;
        }
        .eyebrow {
          display: inline-flex;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.14);
          border: 1px solid rgba(255,255,255,0.16);
          font-size: 12px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }
        h1 {
          margin: 0 0 10px;
          font-size: 32px;
          line-height: 1.05;
        }
        .hero p {
          margin: 0;
          color: rgba(255,255,255,0.82);
          line-height: 1.7;
          font-size: 15px;
        }
        .grid {
          display: grid;
          gap: 16px;
        }
        .stats {
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          margin-top: 18px;
        }
        .stat,
        .card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 22px;
          box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
        }
        .stat {
          padding: 16px;
        }
        .stat-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #cbd5e1;
          margin-bottom: 8px;
        }
        .hero .stat-value {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
        }
        .content {
          display: grid;
          gap: 16px;
        }
        .card {
          padding: 20px;
        }
        .section-title {
          margin: 0 0 8px;
          font-size: 18px;
          font-weight: 800;
        }
        .section-copy {
          margin: 0 0 16px;
          color: var(--muted);
          line-height: 1.6;
          font-size: 14px;
        }
        .info-list {
          display: grid;
          gap: 12px;
        }
        .info-row {
          padding: 14px 16px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .info-label {
          font-size: 12px;
          color: #667085;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }
        .info-value {
          font-size: 15px;
          font-weight: 700;
          word-break: break-word;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 999px;
          background: var(--accent-soft);
          color: var(--accent);
          font-weight: 700;
          font-size: 12px;
        }
        .success { color: var(--success); }
        .warning { color: var(--warning); }
        .footer {
          margin-top: 16px;
          padding: 16px 18px;
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: var(--muted);
          line-height: 1.7;
          font-size: 14px;
        }
      </style>
      <div class="mini-container">
        <section class="hero">
          <div class="eyebrow">Telegram MiniApp</div>
          <h1>${t("heroTitle")}</h1>
          <p>${t("heroSubtitle")}</p>
          <div class="grid stats">
            <div class="stat">
              <div class="stat-label">${t("name")}</div>
              <div class="stat-value">${userName}</div>
            </div>
            <div class="stat">
              <div class="stat-label">${t("statusCard")}</div>
              <div class="stat-value">${runtimeStatus}</div>
            </div>
            <div class="stat">
              <div class="stat-label">${t("initDataVerify")}</div>
              <div class="stat-value">${authStatus}</div>
            </div>
          </div>
        </section>

        <section class="content">
          <div class="card">
            <div class="badge">${envText}</div>
            <h2 class="section-title">${t("userContext")}</h2>
            <p class="section-copy">${t("securityBody")}</p>
            <div class="info-list">
              ${infoRow(t("name"), String(userName))}
              ${infoRow(t("userId"), String(userId))}
              ${infoRow(t("platform"), String(platform))}
              ${infoRow(t("webAppVersion"), String(version))}
              ${infoRow(t("colorScheme"), String(colorScheme))}
              ${infoRow(t("initDataVerify"), String(authStatus))}
            </div>
          </div>

          <div class="card">
            <h2 class="section-title">${t("reputationTitle")}</h2>
            <p class="section-copy">${t("reputationCopy")}</p>
            <div class="info-list">
              ${infoRow(t("reputationScore"), reputation.score)}
              ${infoRow(t("riskLevel"), reputation.riskLevel)}
              ${infoRow(t("depositRate"), `${(reputation.depositBps / 100).toFixed(2)}%`)}
              ${infoRow(t("feeRate"), `${(reputation.feeBps / 100).toFixed(2)}%`)}
              ${infoRow(t("tradeLimit"), reputation.tradeLimit)}
              ${infoRow(t("riskWarning"), reputation.warning || t("riskLoading"))}
            </div>
          </div>

          <div class="card">
            <h2 class="section-title">${t("securityTitle")}</h2>
            <p class="section-copy">${t("securityBody")}</p>
            <div class="footer">
              <span class="success">●</span> ${t("footer")}<br />
              <span class="warning">●</span> ${reputation.warning || t("riskLoading")}
            </div>
          </div>
        </section>
      </div>
    </main>
  `;
});
