import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
const cloudflare = process.argv.includes('--cloudflare');
// Preserve the original 15.x runtime for this bounded release. OpenNext's
// calendar-only LTS check expired on 2026-10-21; this exception is exact-patch only.
const nextVersion = JSON.parse(readFileSync('node_modules/next/package.json','utf8')).version;
const originalRuntimeException = cloudflare && nextVersion === '15.5.28';
const sha = process.env.GITHUB_SHA;
const marker = '.next/travelos-package-sha';
const reusable = cloudflare && sha && existsSync(marker) && readFileSync(marker,'utf8') === sha && existsSync('.next/BUILD_ID');
const command = cloudflare ? 'pnpm' : process.execPath;
const args = cloudflare
  ? ['exec','opennextjs-cloudflare','build',...(reusable ? ['--skipNextBuild'] : []),...(originalRuntimeException ? ['--dangerouslyUseUnsupportedNextVersion'] : [])]
  : ['node_modules/next/dist/bin/next','build'];
// Packaging is not the Owner-authorized full verification gate. Dedicated
// test/typecheck/lint commands remain available for the explicitly frozen release.
const result = spawnSync(command,args,{stdio:'inherit',shell:process.platform==='win32'&&cloudflare,env:{...process.env,TRAVELOS_PACKAGE_ONLY:'1'}});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
if (!cloudflare && sha) writeFileSync(marker,sha);
