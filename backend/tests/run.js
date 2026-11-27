// Test runner: finds every *.test.js under backend/tests and runs each file with
// `node --test`, one file at a time. Uses fs instead of glob patterns so it works on Node 20+.
import { readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testsDir = dirname(fileURLToPath(import.meta.url));
const backendDir = join(testsDir, '..');

const findTests = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === 'helpers' ? [] : findTests(full);
      return entry.name.endsWith('.test.js') ? [full] : [];
    });

const files = findTests(testsDir);
if (files.length === 0) {
  console.error('No test files found.');
  process.exit(1);
}

const failed = [];
for (const file of files) {
  const name = relative(backendDir, file);
  console.log(`\n▶ ${name}`);
  const result = spawnSync(process.execPath, ['--test', file], {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });
  if (result.status !== 0) failed.push(name);
}

console.log(`\n${files.length - failed.length}/${files.length} test files passed.`);
if (failed.length) {
  console.log(`Failed:\n  ${failed.join('\n  ')}`);
  process.exit(1);
}
