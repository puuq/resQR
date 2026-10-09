import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
if (config.d1_databases[0].database_id === '00000000-0000-0000-0000-000000000000') {
  console.error(
    'Create a Cloudflare D1 database and replace database_id in wrangler.jsonc before deploying. See README.md.',
  );
  process.exit(1);
}
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const args of [
  ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote'],
  ['opennextjs-cloudflare', 'deploy'],
]) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
