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

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app container");

const webApp = window.Telegram?.WebApp;
if (webApp) {
  webApp.ready();
  webApp.expand();
}

const user = webApp?.initDataUnsafe?.user;
const fallbackName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
const userName = user?.username ?? (fallbackName || "Guest");
const userId = user?.id ?? "N/A";
const platform = webApp?.platform ?? "browser";
const version = webApp?.version ?? "unknown";
const colorScheme = webApp?.colorScheme ?? "light";
const authEndpoint = (import.meta as any).env?.VITE_TELEGRAM_AUTH_ENDPOINT as string | undefined;

async function verifyInitData() {
  if (!authEndpoint || !webApp?.initData) {
    return "Not verified (missing endpoint/initData)";
  }
  try {
    const res = await fetch(authEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: webApp.initData })
    });
    return res.ok ? "Verified" : `Rejected (${res.status})`;
  } catch {
    return "Verify request failed";
  }
}

verifyInitData().then((authStatus) => {
  app.innerHTML = `
    <main style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 0 auto; padding: 24px;">
      <h1 style="margin: 0 0 12px;">DGP MiniApp</h1>
      <p style="margin: 0 0 16px; color: #666;">
        ${webApp ? "Telegram WebApp context loaded." : "Running outside Telegram WebApp."}
      </p>
      <section style="border: 1px solid #ddd; border-radius: 12px; padding: 16px; background: #fafafa;">
        <h2 style="margin-top: 0;">User Context</h2>
        <p><strong>Name:</strong> ${userName}</p>
        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>Platform:</strong> ${platform}</p>
        <p><strong>WebApp Version:</strong> ${version}</p>
        <p><strong>Color Scheme:</strong> ${colorScheme}</p>
        <p><strong>InitData Verify:</strong> ${authStatus}</p>
      </section>
    </main>
  `;
});
