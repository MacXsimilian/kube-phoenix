import { appendFileSync, readFileSync } from 'node:fs';

function output(values) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT,
      Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
  }
}

try {
  const [reportPath, auditExitCode] = process.argv.slice(2);
  if (!reportPath || !['0', '1'].includes(auditExitCode)) {
    throw new Error(`npm audit did not complete (exit code ${auditExitCode ?? 'unknown'})`);
  }

  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  if (report.error) {
    throw new Error(`npm audit failed: ${report.error.summary ?? report.error.code ?? 'unknown error'}`);
  }

  const counts = report.metadata?.vulnerabilities;
  for (const severity of ['info', 'low', 'moderate', 'high', 'critical']) {
    if (!Number.isSafeInteger(counts?.[severity]) || counts[severity] < 0) {
      throw new Error(`npm audit report has no valid ${severity} count`);
    }
  }

  const total = counts.info + counts.low + counts.moderate + counts.high + counts.critical;
  output({ high: counts.high, critical: counts.critical, moderate: counts.moderate,
    status: total > 0 ? 'found' : 'clean' });
  console.log(`npm audit: ${counts.critical} critical, ${counts.high} high, ${counts.moderate} moderate`);
  if (counts.high > 0 || counts.critical > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  output({ status: 'error' });
  console.error(error.message);
  process.exitCode = 1;
}
