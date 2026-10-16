import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import os from 'node:os';

const stage = process.argv[2] ?? 'stage2';
if (!['stage2', 'stage3', 'stage4'].includes(stage)) throw new Error('Unsupported evidence stage');
const directory = `docs/reports/evidence/${stage}`;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function files(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = `${root}/${entry.name}`;
    if (path === 'docs/reports') continue; // Reports refer to this immutable source manifest.
    if (entry.isDirectory()) result.push(...(await files(path)));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}
const sourcePaths = [
  ...(await files('src')),
  ...(await files('tests')),
  ...(await files('scripts')),
  ...(await files('public')),
  ...(await files('docs')),
  ...(await readdir('.')).filter(
    (path) =>
      /\.(json|ts|js|html)$/.test(path) ||
      [
        'README.md',
        'CHANGELOG.md',
        'AGENTS.md',
        '.prettierignore',
        '.prettierrc.json',
        '.nvmrc',
        '.npmrc',
        '.gitignore',
      ].includes(path),
  ),
].sort();
const sourceFiles = [];
for (const path of sourcePaths) {
  const bytes = await readFile(path);
  sourceFiles.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
}
async function assets(root) {
  const result = [];
  for (const path of (await files(root)).sort()) {
    const bytes = await readFile(path);
    result.push({
      path,
      bytes: bytes.length,
      gzipBytes: gzipSync(bytes).length,
      sha256: sha256(bytes),
    });
  }
  return result;
}
const vitest = JSON.parse(await readFile(`${directory}/vitest-results.json`, 'utf8'));
const suites = vitest.testResults.map((suite) => ({
  path: suite.name.replaceAll('\\', '/').replace(`${process.cwd().replaceAll('\\', '/')}/`, ''),
  status: suite.status,
  passed: suite.assertionResults.filter((test) => test.status === 'passed').length,
  failed: suite.assertionResults.filter((test) => test.status === 'failed').length,
  pending: suite.assertionResults.filter(
    (test) => test.status !== 'passed' && test.status !== 'failed',
  ).length,
}));
const coverage = JSON.parse(
  await readFile(
    stage === 'stage4'
      ? `${directory}/coverage/coverage-summary.json`
      : 'coverage/coverage-summary.json',
    'utf8',
  ),
);
const coverageGroups = {};
for (const [group, token] of Object.entries({
  domain: '/src/domain/',
  engine: '/src/engine/',
  application: '/src/application/',
  persistence: '/src/adapters/persistence/',
  state: '/src/state/',
  validation: '/src/validation/',
})) {
  const members = Object.entries(coverage).filter(([path]) =>
    path.replaceAll('\\', '/').includes(token),
  );
  const total = members.reduce((sum, [, value]) => sum + value.branches.total, 0);
  const covered = members.reduce((sum, [, value]) => sum + value.branches.covered, 0);
  coverageGroups[group] = { covered, total, branchPercent: total ? (covered / total) * 100 : null };
}
const evidenceFiles = [];
for (const path of (await files(directory)).sort()) {
  if (path.endsWith('/artifact-manifest.json')) continue;
  const bytes = await readFile(path);
  evidenceFiles.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
}
await writeFile(
  `${directory}/artifact-manifest.json`,
  JSON.stringify(
    {
      recordedAt: new Date().toISOString(),
      timezone: 'America/Sao_Paulo',
      git: 'No .git directory; no commit or publication performed.',
      environment: {
        node: process.version,
        os: os.release(),
        cpu: os.cpus()[0]?.model,
        ramBytes: os.totalmem(),
      },
      sourceIdentity: sha256(sourceFiles.map((file) => `${file.path}\0${file.sha256}\n`).join('')),
      identityMethod:
        'SHA-256 of sorted relative source paths, NUL, file SHA-256, LF; reports and generated evidence excluded to avoid circular identity.',
      sourceFiles,
      productionAssets: await assets('dist'),
      benchmarkAssets: await assets('dist-benchmark'),
      suites,
      coverageGroups,
      evidenceFiles,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    { passed: vitest.numPassedTests, failed: vitest.numFailedTests, suites, coverageGroups },
    null,
    2,
  ),
);
