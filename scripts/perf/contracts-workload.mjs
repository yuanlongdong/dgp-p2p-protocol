import fs from "node:fs";
import path from "node:path";

const DEFAULT_SCENARIOS = [
  { name: "smoke", users: 10, opsPerUser: 20, concurrency: 5, failureBps: 50 },
  { name: "baseline", users: 50, opsPerUser: 40, concurrency: 20, failureBps: 100 },
  { name: "stress", users: 120, opsPerUser: 60, concurrency: 40, failureBps: 200 }
];

function rng(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0;
const stat = (a) => ({
  count: a.length,
  avg: a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0,
  p50: pct(a, 50),
  p95: pct(a, 95),
  p99: pct(a, 99),
  max: a.length ? Math.max(...a) : 0
});

async function runScenario(s, seed) {
  const rand = rng(seed);
  const total = s.users * s.opsPerUser;
  let fail = 0, done = 0, inFlight = 0, next = 0;
  const lat = [];
  const t0 = Date.now();

  return await new Promise((resolve) => {
    const launch = () => {
      while (inFlight < s.concurrency && next < total) {
        inFlight++;
        next++;
        const d = Math.floor(40 + rand() * 360);
        const f = rand() < s.failureBps / 10000;
        const ts = Date.now();

        sleep(d).then(() => {
          const l = Date.now() - ts;
          if (f) fail++;
          else lat.push(l);
          done++;
          inFlight--;

          if (done >= total) {
            const dur = Date.now() - t0;
            const ok = lat.length;
            resolve({
              name: s.name,
              users: s.users,
              opsPerUser: s.opsPerUser,
              concurrency: s.concurrency,
              totalOps: total,
              successOps: ok,
              failedOps: fail,
              failureRate: total ? fail / total : 0,
              durationMs: dur,
              tps: dur ? ok / (dur / 1000) : 0,
              latencyMs: stat(lat)
            });
          } else {
            launch();
          }
        });
      }
    };
    launch();
  });
}

function md(results) {
  const L = [];
  L.push("# Performance Report");
  L.push("");
  L.push("Generated at: " + new Date().toISOString());
  L.push("");
  L.push("| Scenario | Users | Ops/User | Concurrency | Success TPS | Fail Rate | P95 (ms) | P99 (ms) |");
  L.push("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const r of results) {
    L.push("| " + r.name + " | " + r.users + " | " + r.opsPerUser + " | " + r.concurrency + " | " + r.tps.toFixed(2) + " | " + (r.failureRate * 100).toFixed(2) + "% | " + r.latencyMs.p95.toFixed(0) + " | " + r.latencyMs.p99.toFixed(0) + " |");
  }
  L.push("");
  L.push("## Method");
  L.push("- Synthetic workload runner with deterministic RNG (seeded).");
  L.push("- Metrics: TPS, failure rate, latency percentiles.");
  L.push("- Purpose: regression tracking and pre-release gate baseline.");
  return n;
}

(async () => {
  const seed = Number(process.env.PERF_SEED || "42");
  const scenariosPath = "docs/perf/scenarios.json";
  let scenarios = DEFAULT_SCENARIOS;

  if (fs.existsSync(scenariosPath)) {
    const s = JSON.parse(fs.readFileSync(scenariosPath, "utf-8"));
    if (Array.isArray(s) && s.length) scenarios = s;
  }

  const results = [];
  for (let i = 0; i < scenarios.length; i++) {
    console.log(Running ${scenarios[i].name}...);
    results.push(await runScenario(scenarios[i], seed + i * 1000));
  }

  const outDir = path.join(process.cwd(), "docs", "perf", "results");
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const report = { generatedAt: new Date().toISOString(), seed, scenarios: results };

  fs.writeFileSync(path.join(outDir, workload-${ts}.json), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, workload-${ts}.md), md(results));
  fs.writeFileSync(path.join(outDir, "latest.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, "latest.md"), md(results));

  console.log("Wrote docs/perf/results/latest.json");
  console.log("Wrote docs/perf/results/latest.md");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
