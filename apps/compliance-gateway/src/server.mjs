import crypto from "crypto";
import fs from "fs";
import path from "path";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const COMPLIANCE_REGISTRY = process.env.COMPLIANCE_REGISTRY || "";
const PORT = Number(process.env.PORT || 8787);
const PROVIDER_SHARED_SECRET = process.env.PROVIDER_SHARED_SECRET || "";
const REQUEST_SKEW_SECONDS = Number(process.env.REQUEST_SKEW_SECONDS || 300);
const NONCE_TTL_SECONDS = Number(process.env.NONCE_TTL_SECONDS || 900);
const IDEMPOTENCY_TTL_SECONDS = Number(process.env.IDEMPOTENCY_TTL_SECONDS || 900);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 60);
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || "";
const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH || path.join(process.cwd(), "logs", "compliance-gateway.log");

if (!RPC_URL || !PRIVATE_KEY || !COMPLIANCE_REGISTRY || !PROVIDER_SHARED_SECRET) {
  console.error("[compliance-gateway] RPC_URL / PRIVATE_KEY / COMPLIANCE_REGISTRY / PROVIDER_SHARED_SECRET are required");
  process.exit(1);
}

const abi = [
  "function setComplianceData(address account, bool kycApproved, bool blacklisted, bool sanctioned, uint16 riskBps)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const registry = new ethers.Contract(COMPLIANCE_REGISTRY, abi, signer);

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false
}));
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString("utf8");
  }
}));

const usedNonces = new Map();
const idempotencyStore = new Map();

fs.mkdirSync(path.dirname(AUDIT_LOG_PATH), { recursive: true });

setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [nonce, exp] of usedNonces.entries()) {
    if (exp <= now) usedNonces.delete(nonce);
  }
  for (const [key, entry] of idempotencyStore.entries()) {
    if (entry.expiresAt <= now) idempotencyStore.delete(key);
  }
}, 60_000).unref();

const payloadSchema = z.object({
  account: z.string(),
  kycApproved: z.union([z.boolean(), z.enum(["true", "false"])]),
  blacklisted: z.union([z.boolean(), z.enum(["true", "false"])]),
  sanctioned: z.union([z.boolean(), z.enum(["true", "false"])]),
  riskBps: z.number().int().min(0).max(10000)
});

function log(event, extra = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...extra
  });
  console.log(line);
  fs.appendFileSync(AUDIT_LOG_PATH, line + "\n");
}

async function sendAlert(type, payload) {
  if (!ALERT_WEBHOOK_URL) return;
  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        service: "compliance-gateway",
        type,
        ...payload,
        ts: new Date().toISOString()
      })
    });
  } catch (e) {
    log("alert_failed", { error: String(e), type });
  }
}

function parseBool(value) {
  if (value === true || value === false) return value;
  return value === "true";
}

function signatureFor(ts, nonce, rawBody) {
  return crypto
    .createHmac("sha256", PROVIDER_SHARED_SECRET)
    .update(`${ts}.${nonce}.${rawBody}`)
    .digest("hex");
}

function secureEqualHex(a, b) {
  try {
    const aa = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (aa.length !== bb.length) return false;
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function verifySignature(req) {
  const ts = Number(req.header("x-provider-ts") || 0);
  const nonce = req.header("x-provider-nonce") || "";
  const sig = req.header("x-provider-signature") || "";
  if (!Number.isInteger(ts) || !nonce || !sig) {
    return { ok: false, error: "missing-signature-headers" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > REQUEST_SKEW_SECONDS) {
    return { ok: false, error: "timestamp-out-of-window" };
  }

  if (usedNonces.has(nonce)) {
    return { ok: false, error: "replay-detected" };
  }

  const expected = signatureFor(ts, nonce, req.rawBody || "");
  if (!secureEqualHex(sig, expected)) {
    return { ok: false, error: "bad-signature" };
  }

  usedNonces.set(nonce, now + NONCE_TTL_SECONDS);
  return { ok: true };
}

function normalizeBody(req, res) {
  const parse = payloadSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ ok: false, error: "invalid-body", details: parse.error.flatten() });
    return null;
  }
  const account = (() => {
    try {
      return ethers.getAddress(parse.data.account);
    } catch {
      return "";
    }
  })();
  if (!account) {
    res.status(400).json({ ok: false, error: "invalid-account" });
    return null;
  }
  return {
    account,
    kycApproved: parseBool(parse.data.kycApproved),
    blacklisted: parseBool(parse.data.blacklisted),
    sanctioned: parseBool(parse.data.sanctioned),
    riskBps: parse.data.riskBps
  };
}

app.get("/healthz", async (_req, res) => {
  try {
    const block = await provider.getBlockNumber();
    res.json({ ok: true, block, registry: COMPLIANCE_REGISTRY, signer: signer.address });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/readyz", async (_req, res) => {
  try {
    await provider.getBlockNumber();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post("/provider/kyc-result", async (req, res) => {
  const verify = verifySignature(req);
  if (!verify.ok) {
    log("auth_rejected", { reason: verify.error, ip: req.ip });
    await sendAlert("auth_rejected", { reason: verify.error, ip: req.ip });
    return res.status(401).json({ ok: false, error: verify.error });
  }

  const idemKey = req.header("x-idempotency-key") || "";
  if (idemKey && idempotencyStore.has(idemKey)) {
    const cached = idempotencyStore.get(idemKey);
    return res.status(200).json({ ok: true, idempotent: true, ...cached.response });
  }

  const body = normalizeBody(req, res);
  if (!body) return;

  try {
    const tx = await registry.setComplianceData(
      body.account,
      body.kycApproved,
      body.blacklisted,
      body.sanctioned,
      body.riskBps
    );
    await tx.wait();

    const response = { txHash: tx.hash, account: body.account };
    if (idemKey) {
      idempotencyStore.set(idemKey, {
        response,
        expiresAt: Math.floor(Date.now() / 1000) + IDEMPOTENCY_TTL_SECONDS
      });
    }

    log("kyc_result_applied", { account: body.account, txHash: tx.hash });
    return res.json({ ok: true, ...response });
  } catch (e) {
    log("kyc_result_failed", { error: String(e) });
    await sendAlert("kyc_result_failed", { error: String(e) });
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(PORT, () => {
  log("service_started", { port: PORT, registry: COMPLIANCE_REGISTRY, signer: signer.address });
});
