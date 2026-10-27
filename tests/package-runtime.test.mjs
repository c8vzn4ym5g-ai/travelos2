import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
const source=(await readFile(new URL('../scripts/package-app.mjs',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
function packageArgs(version,cloudflare=true) {
  let call;
  vm.runInNewContext(source,{
    process:{argv:cloudflare?['node','script','--cloudflare']:['node','script'],env:{},platform:'linux',execPath:'node',exit:code=>{throw Error(`exit ${code}`);}},
    existsSync:()=>false,readFileSync:()=>JSON.stringify({version}),writeFileSync:()=>{},
    spawnSync:(command,args)=>{call={command,args};return {status:0};},
  });
  return call;
}
test('only the selected original-runtime maintenance patch has the calendar exception',()=>{
  assert.ok(packageArgs('15.5.28').args.includes('--dangerouslyUseUnsupportedNextVersion'));
  assert.equal(packageArgs('15.5.24').args.includes('--dangerouslyUseUnsupportedNextVersion'),false);
  assert.equal(packageArgs('16.4.3').args.includes('--dangerouslyUseUnsupportedNextVersion'),false);
});
test('ordinary Next packaging never receives the Cloudflare exception',()=>{
  assert.deepEqual(Array.from(packageArgs('15.5.28',false).args),['node_modules/next/dist/bin/next','build']);
});
