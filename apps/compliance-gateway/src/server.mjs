import express from "express";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const COMPLIANCE_REGISTRY = process.env.COMPLIANCE_REGISTRY || "";
const PORT = Number(process.env.PORT || 8787);
const PROVIDER_SHARED_SECRET = process.env.PROVIDER_SHARED_SECRET || "";

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
app.use(express.json());

function verifyAuth(req) {
  return req.header("x-provider-secret") === PROVIDER_SHARED_SECRET;
}

function okAddress(value) {
  try {
    return ethers.getAddress(value);
  } catch {
    return "";
  }
}

function parseBool(value, name) {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`invalid boolean field: ${name}`);
}

app.get("/healthz", async (_req, res) => {
  try {
    const block = await provider.getBlockNumber();
    res.json({ ok: true, block, registry: COMPLIANCE_REGISTRY, signer: signer.address });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post("/provider/kyc-result", async (req, res) => {
  if (!verifyAuth(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const account = okAddress(req.body?.account || "");
  let kycApproved;
  let blacklisted;
  let sanctioned;
  let riskBps;
  try {
    kycApproved = parseBool(req.body?.kycApproved, "kycApproved");
    blacklisted = parseBool(req.body?.blacklisted, "blacklisted");
    sanctioned = parseBool(req.body?.sanctioned, "sanctioned");
    riskBps = Number(req.body?.riskBps ?? 0);
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e) });
  }

  if (!account) return res.status(400).json({ ok: false, error: "invalid account" });
  if (!Number.isInteger(riskBps) || riskBps < 0 || riskBps > 10000) {
    return res.status(400).json({ ok: false, error: "invalid riskBps" });
  }

  try {
    const tx = await registry.setComplianceData(account, kycApproved, blacklisted, sanctioned, riskBps);
    await tx.wait();

    res.json({
      ok: true,
      txHash: tx.hash
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`[compliance-gateway] listening on :${PORT}`);
});
