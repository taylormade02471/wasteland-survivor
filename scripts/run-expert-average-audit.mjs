import fs from "node:fs";
import path from "node:path";
import { runExpertAverageGamerAudit } from "../public/agent-squad-rules.mjs";

const matches = Math.min(64, Math.max(1, Math.trunc(Number(process.argv[2]) || 16)));
const players = Math.min(16, Math.max(4, Math.trunc(Number(process.argv[3]) || 16)));
const outputPath = path.resolve(process.argv[4] || "output/wasteland-survivor-expert-average-16-player-audit.json");
const startedAt = Date.now();
const audit = runExpertAverageGamerAudit({ matches, players, seed: 20261008 });
const report = {
  generatedAt: new Date().toISOString(),
  runtimeMs: Date.now() - startedAt,
  scope: "deterministic Expert average-gamer stress audit; not a substitute for sixteen real networked devices",
  ...audit,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, runtimeMs: report.runtimeMs, matches, players, score: report.score }, null, 2));
