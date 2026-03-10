import fs from "node:fs";
import path from "node:path";

const defaults = [
  { name: "fund-50m-base", principal: 50000000, utilization: 0.58, avgDurationDays: 30, protocolFeeBps: 80, defaultRateBps: 140, slashRecoveryBps: 7000, annualGrowthRate: 0.18 },
  { name: "fund-300m-scale", principal: 300000000, utilization: 0.66, avgDurationDays: 28, protocolFeeBps: 70, defaultRateBps: 170, slashRecoveryBps: 7600, annualGrowthRate: 0.24 }
];

const inFile = path.join(process.cwd(), "docs/econ/scenarios.json");
const scenarios = fs.existsSync(inFile) ? JSON.parse(fs.readFileSync(inFile, "utf8")) : defaults;

const results = scenarios.map((s) => {
  const cyclesPerYear = 365 / s.avgDurationDays;
  const grossVolume = s.principal * s.utilization * cyclesPerYear;
  const grossFees = grossVolume * s.protocolFeeBps / 10000;
  const expectedDefaults = grossVolume * s.defaultRateBps / 10000;
  const recoveredLoss = expectedDefaults * s.slashRecoveryBps / 10000;
  const netLoss = Math.max(expectedDefaults - recoveredLoss, 0);
  const netRevenue = grossFees - netLoss;
  const annualizedYield = netRevenue / s.principal;
  const projectedAum12m = s.principal * (1 + s.annualGrowthRate);
  return { name: s.name, inputs: s, outputs: { cyclesPerYear, grossVolume, grossFees, expectedDefaults, recoveredLoss, netLoss, netRevenue, annualizedYield, projectedAum12m } };
});

const outDir = path.join(process.cwd(), "docs/econ/results");
fs.mkdirSync(outDir, { recursive: true });

const report = { generatedAt: new Date().toISOString(), version: 1, results };
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const usd = (n) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (n) => (n * 100).toFixed(2) + "%";

const md = [
  "# APY Simulation Report",
  "",
  "Generated at: " + report.generatedAt,
  "",
  "| Scenario | Principal | Utilization | Gross Fees | Net Loss | Net Revenue | APY | 12M AUM |",
  "|---|---:|---:|---:|---:|---:|---:|---:|",
  ...results.map((r) => | ${r.name} | ${usd(r.inputs.principal)} | ${pct(r.inputs.utilization)} | ${usd(r.outputs.grossFees)} | ${usd(r.outputs.netLoss)} | ${usd(r.outputs.netRevenue)} | ${pct(r.outputs.annualizedYield)} | ${usd(r.outputs.projectedAum12m)} |)
].join("\n");

fs.writeFileSync(path.join(outDir, apy-${ts}.json), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, apy-${ts}.md), md);
fs.writeFileSync(path.join(outDir, "latest.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, "latest.md"), md);

console.log("Wrote docs/econ/results/latest.json");
console.log("Wrote docs/econ/results/latest.md");
