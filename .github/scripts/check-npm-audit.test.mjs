import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const parser = new URL('./check-npm-audit.mjs', import.meta.url);

function check(report, auditExitCode = '1') {
  const directory = mkdtempSync(join(tmpdir(), 'npm-audit-gate-'));
  try {
    const input = join(directory, 'audit.json');
    const output = join(directory, 'outputs');
    writeFileSync(input, typeof report === 'string' ? report : JSON.stringify(report));
    const result = spawnSync(process.execPath, [parser.pathname, input, auditExitCode], {
      encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output },
    });
    assert.ifError(result.error);
    return { exitCode: result.status, stderr: result.stderr, output: readFileSync(output, 'utf8') };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function report(counts = {}) {
  return { auditReportVersion: 2, metadata: { vulnerabilities:
    { info: 0, low: 0, moderate: 0, high: 0, critical: 0, ...counts } } };
}

test('a clean audit passes', () => {
  const result = check(report(), '0');
  assert.equal(result.exitCode, 0);
  assert.match(result.output, /status=clean\n/);
});

test('moderate and low findings pass the high severity gate', () => {
  const result = check(report({ low: 2, moderate: 3 }));
  assert.equal(result.exitCode, 0);
  assert.match(result.output, /moderate=3\nstatus=found\n/);
});

for (const severity of ['high', 'critical']) {
  test(`${severity} findings fail the gate and preserve counts`, () => {
    const result = check(report({ [severity]: 2 }));
    assert.equal(result.exitCode, 1);
    assert.match(result.output, new RegExp(`${severity}=2\\n`));
    assert.match(result.output, /status=found\n/);
  });
}

for (const [name, input] of [
  ['registry error', { error: { code: 'ENOAUDIT', summary: 'Audit endpoint unavailable' } }],
  ['malformed JSON', '{bad json'],
  ['missing counts', { metadata: {} }],
  ['nonnumeric count', report({ high: '2' })],
  ['negative count', report({ high: -1 })],
]) {
  test(`${name} fails instead of reporting a clean audit`, () => {
    const result = check(input);
    assert.equal(result.exitCode, 1);
    assert.equal(result.output, 'status=error\n');
    assert.notEqual(result.stderr, '');
  });
}

test('unexpected npm exit codes fail even with a clean-looking report', () => {
  const result = check(report(), '2');
  assert.equal(result.exitCode, 1);
  assert.equal(result.output, 'status=error\n');
});
