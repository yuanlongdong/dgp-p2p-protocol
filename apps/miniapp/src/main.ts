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
    name: "名称：",
    userId: "用户 ID：",
    platform: "平台：",
    webAppVersion: "WebApp 版本：",
    colorScheme: "配色方案：",
    initDataVerify: "InitData 验证："
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
    name: "Name: ",
    userId: "User ID: ",
    platform: "Platform: ",
    webAppVersion: "WebApp Version: ",
    colorScheme: "Color Scheme: ",
    initDataVerify: "InitData Verify: "
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

verifyInitData().then((authStatus) => {
  app.innerHTML = `
    <main style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 0 auto; padding: 24px;">
      <h1 style="margin: 0 0 12px;">DGP MiniApp</h1>
      <p style="margin: 0 0 16px; color: #666;">
        ${webApp ? t("envLoaded") : t("envOutside")}
      </p>
      <section style="border: 1px solid #ddd; border-radius: 12px; padding: 16px; background: #fafafa;">
        <h2 style="margin-top: 0;">${t("userContext")}</h2>
        <p><strong>${t("name")}</strong> ${userName}</p>
        <p><strong>${t("userId")}</strong> ${userId}</p>
        <p><strong>${t("platform")}</strong> ${platform}</p>
        <p><strong>${t("webAppVersion")}</strong> ${version}</p>
        <p><strong>${t("colorScheme")}</strong> ${colorScheme}</p>
        <p><strong>${t("initDataVerify")}</strong> ${authStatus}</p>
      </section>
    </main>
  `;
});
