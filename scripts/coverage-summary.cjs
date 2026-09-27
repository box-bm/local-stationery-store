#!/usr/bin/env node
// Prints coverage/coverage-summary.json (written by `npm run test:ci`) as a
// Markdown table, for the GitHub Actions job summary.
const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "..", "coverage", "coverage-summary.json");
if (!fs.existsSync(file)) {
  console.log("_No coverage report was generated._");
  process.exit(0);
}

const { total } = JSON.parse(fs.readFileSync(file, "utf8"));
const rows = ["lines", "statements", "functions", "branches"].map(
  (k) => `| ${k} | ${total[k].pct}% | ${total[k].covered}/${total[k].total} |`
);

console.log(
  ["### Test coverage", "", "| Metric | % | Covered |", "|---|---|---|", ...rows].join("\n")
);
