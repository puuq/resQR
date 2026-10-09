import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
if (!existsSync('.dev.vars')) {
  mkdirSync('.local', { recursive: true });
  const token = randomBytes(32).toString('hex');
  writeFileSync('.dev.vars', `APP_ENV=development\nBOOTSTRAP_TOKEN=${token}\n`);
  writeFileSync('.local/setup-token.txt', token);
  console.log(
    'Local configuration created. Your one-time setup token is in .local/setup-token.txt.',
  );
} else console.log('Existing local configuration preserved.');
