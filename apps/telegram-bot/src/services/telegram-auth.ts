import crypto from "node:crypto";
import http from "node:http";
import { auditLog } from "./audit-log";

type VerifyResult = {
  ok: boolean;
  reason?: string;
  user?: Record<string, unknown>;
};

export function verifyTelegramInitData(initData: string, botToken: string): VerifyResult {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { ok: false, reason: "missing-hash" };
    params.delete("hash");

    const authDate = Number(params.get("auth_date") || "0");
    const now = Math.floor(Date.now() / 1000);
    if (!authDate || now - authDate > 86400) {
      return { ok: false, reason: "stale-auth-date" };
    }

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto.createHash("sha256").update(botToken).digest();
    const digest = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    if (digest !== hash) return { ok: false, reason: "bad-signature" };

    const userRaw = params.get("user");
    const user = userRaw ? (JSON.parse(userRaw) as Record<string, unknown>) : undefined;
    return { ok: true, user };
  } catch (err) {
    return { ok: false, reason: `verify-error:${String(err)}` };
  }
}

export function startTelegramAuthServer(input: {
  botToken: string;
  port: number;
  host?: string;
}) {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method !== "POST" || req.url !== "/auth/telegram/verify") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "not-found" }));
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { initData?: string };
        if (!body.initData) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "missing-initData" }));
          return;
        }

        const verified = verifyTelegramInitData(body.initData, input.botToken);
        if (!verified.ok) {
          res.writeHead(403, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: verified.reason }));
          auditLog("telegramInitDataRejected", { reason: verified.reason });
          return;
        }

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, user: verified.user }));
        auditLog("telegramInitDataVerified", {
          userId: verified.user?.id,
          username: verified.user?.username
        });
      } catch (err) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: `bad-request:${String(err)}` }));
      }
    });
  });

  server.listen(input.port, input.host || "0.0.0.0", () => {
    auditLog("telegramAuthServerStarted", { port: input.port, host: input.host || "0.0.0.0" });
  });
}
