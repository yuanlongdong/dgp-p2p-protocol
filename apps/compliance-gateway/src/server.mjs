import express from "express";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const COMPLIANCE_REGISTRY = process.env.COMPLIANCE_REGISTRY || "";
const PORT = Number(process.env.PORT || 8787);
const PROVIDER_SHARED_SECRET = process.env.PROVIDER_SHARED_SECRET || "";

if (!RPC_URL || !PRIVATE_KEY || !COMPLIANCE_REGISTRY) {
  console.error("[compliance-gateway] RPC_URL / PRIVATE_KEY / COMPLIANCE_REGISTRY are required");
  process.exit(1);
}

const abi = [
  "function setKyc(address account, bool approved)",
  "function setBlacklist(address account, bool blacklisted)",
  "function setSanction(address account, bool sanctioned)",
  "function setAmlRiskScore(address account, uint16 riskBps)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const registry = new ethers.Contract(COMPLIANCE_REGISTRY, abi, signer);

const app = express();
app.use(express.json());

function verifyAuth(req) {
  if (!PROVIDER_SHARED_SECRET) return true;
  return req.header("x-provider-secret") === PROVIDER_SHARED_SECRET;
}

function okAddress(value) {
  try {
    return ethers.getAddress(value);
  } catch {
    return "";
  }
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
  const kycApproved = Boolean(req.body?.kycApproved);
  const blacklisted = Boolean(req.body?.blacklisted);
  const sanctioned = Boolean(req.body?.sanctioned);
  const riskBps = Number(req.body?.riskBps ?? 0);

  if (!account) return res.status(400).json({ ok: false, error: "invalid account" });
  if (!Number.isInteger(riskBps) || riskBps < 0 || riskBps > 10000) {
    return res.status(400).json({ ok: false, error: "invalid riskBps" });
  }

  try {
    const tx1 = await registry.setKyc(account, kycApproved);
    await tx1.wait();
    const tx2 = await registry.setBlacklist(account, blacklisted);
    await tx2.wait();
    const tx3 = await registry.setSanction(account, sanctioned);
    await tx3.wait();
    const tx4 = await registry.setAmlRiskScore(account, riskBps);
    await tx4.wait();

    res.json({
      ok: true,
      txHashes: [tx1.hash, tx2.hash, tx3.hash, tx4.hash]
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`[compliance-gateway] listening on :${PORT}`);
});
