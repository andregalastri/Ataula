// Do not turn other failures into a green build. This exemption is restricted
// to the one fixture failure reproduced in the unmodified upstream engine.
const fs = require('node:fs');
const report = JSON.parse(fs.readFileSync('vitest-results.json', 'utf8'));
const failures = report.testResults.flatMap(file =>
  file.assertionResults.filter(test => test.status === 'failed').map(test => ({ file: file.name, test }))
);
const allowed = failures.length === 1 &&
  failures[0].file.replace(/\\/g, '/').endsWith('/packages/table-engine/src/table-editing-integration.test.ts') &&
  failures[0].test.title === 'should simulate Content Editing Case 34 correctly' &&
  // Vitest 1.x counts suite/hook errors separately from assertion failures.
  report.numFailedTestSuites === 0 &&
  report.numFailedTests === 1 &&
  report.testResults.filter(file => file.status === 'failed').length === 1 &&
  report.testResults.every(file => !file.message &&
    file.assertionResults.every(test => test.status === 'passed' || test.status === 'failed')) &&
  !report.wasInterrupted &&
  (!report.unhandledErrors || report.unhandledErrors.length === 0) &&
  report.numTotalTests >= 150 &&
  report.numPassedTests === report.numTotalTests - 1 &&
  !report.numPendingTests;
if (!allowed) {
  console.error('Failures differ from the known upstream baseline:', failures);
  process.exitCode = 1;
} else {
  console.warn('Known upstream failure reproduced: Content Editing Case 34. See TESTING.md.');
}
