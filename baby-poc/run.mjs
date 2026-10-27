// Bounded local-process supervisor; no production app is launched.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(fileURLToPath(import.meta.url));
const repo = dirname(root);
mkdirSync(join(root, 'scratch'), { recursive: true });
const lease = join(root, 'scratch', 'process-lease.json');
const ownership = { owner: 'root', mission: 'baby-storybook-poc', command: 'fixture-only server', port: 3347, lifetimeMs: 1800000, status: 'registered', productionAccess: false };
writeFileSync(lease, JSON.stringify(ownership));
const child = spawn(process.execPath, ['--experimental-strip-types', '--import', './tests/register-at.mjs', 'baby-poc/server.mjs'], { cwd: repo, stdio: 'inherit' });
writeFileSync(lease, JSON.stringify({ ...ownership, status: 'running', pid: child.pid }));
const stop = () => { child.kill(); writeFileSync(lease, JSON.stringify({ ...ownership, status: 'stopped' })); };
const timer = setTimeout(stop, ownership.lifetimeMs);
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', code => { clearTimeout(timer); writeFileSync(lease, JSON.stringify({ ...ownership, status: 'stopped' })); process.exitCode = code || 0; });
