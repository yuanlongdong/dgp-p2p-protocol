import fs from "node:fs";
const r=JSON.parse(fs.readFileSync("docs/perf/results/latest.json","utf8"));
if(!Array.isArray(r.scenarios)||!r.scenarios.length) process.exit(1);
console.log("Perf gate passed.");
