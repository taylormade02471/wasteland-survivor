import fs from "node:fs";
import path from "node:path";
import { runFullGameAudit } from "../public/agent-squad-rules.mjs";

const matches = Math.min(1_000_000, Math.max(1, Math.trunc(Number(process.argv[2]) || 1_000_000)));
const outputPath = path.resolve(process.argv[3] || "output/wasteland-survivor-million-match-audit.json");
const startedAt = Date.now();
const audit = runFullGameAudit({ matches, seed: 20261008 });
const report = {
  generatedAt: new Date().toISOString(),
  runtimeMs: Date.now() - startedAt,
  scope: "deterministic rules-level Monte Carlo audit; not a substitute for real network/device sessions",
  ...audit,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, runtimeMs: report.runtimeMs, matches: report.matches, score: report.score }, null, 2));
