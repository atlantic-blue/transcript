import { readFileSync } from "node:fs";

const REPORT = ".vitest-result.json";

let report;
try {
  report = JSON.parse(readFileSync(REPORT, "utf8"));
} catch {
  console.error(`no test report at ${REPORT}: the suite did not run`);
  process.exit(1);
}

const total = report.numTotalTests ?? 0;
const passed = report.numPassedTests ?? 0;
const failed = report.numFailedTests ?? 0;

console.log(`tests: ${total} total, ${passed} passed, ${failed} failed`);

if (total === 0) {
  console.error("the suite found no tests, which is a failure, not a pass");
  process.exit(1);
}
if (failed > 0) {
  console.error(`${failed} tests failed`);
  process.exit(1);
}
