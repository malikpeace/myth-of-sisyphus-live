const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const config=JSON.parse(fs.readFileSync(path.join(root,'realm-palettes.json'),'utf8'));
const files=[
  'index.html','full-runtime.html','endless-journey.js','endless-scenery.js',
  'realm-catalog.js','realm-scenes.js','realm-architecture.js','realm-palettes.json',
  'assets/realm-candidates.json','assets/manifest.json','assets/build-info.json','SIX-REALMS-WORKLOG.md',
  'tools/build-realm-assets.cjs','tools/build-realm-release.cjs',
  'tools/test-realm-catalog.cjs','tools/test-endless-journey.cjs',
  'tools/verify-realm-art.cjs','tools/verify-realm-routing.cjs',
  'tools/verify-realm-motion.cjs','tools/verify-endless-browser.cjs'
];
for(const asset of config.assets){files.push('assets/'+asset.output,'assets/'+asset.source);}
const runtimeChecksum=hash(path.join(root,'index.html'));
if(runtimeChecksum!==hash(path.join(root,'full-runtime.html')))throw new Error('Runtime mirror differs');
const v5=hash(path.join(root,'../v5/index.html'));
if(v5!=='3e3c5e76f68c31ce51255b7e1cd2185fac2103bef2c3d0132ea59c39a5050a9f')throw new Error('V5 changed');
const build={
  generatedAt:new Date().toISOString(),runtime:'6-six-realms-1',runtimeChecksum,
  canonicalViewport:'bounded dynamic integer grid',endlessRotationSteps:256,
  realms:require('../realm-catalog.js').entries.map(x=>x.id),realmStartMeters:0,
  automaticRealmTransitions:false,realmArtStatus:config.status,
  v5Checksum:v5
};
fs.writeFileSync(path.join(root,'assets/build-info.json'),JSON.stringify(build,null,2)+'\n');
const inventory=[...new Set(files)].sort().map(file=>({path:'v6-preview/'+file,bytes:fs.statSync(path.join(root,file)).size,sha256:hash(path.join(root,file))}));
fs.writeFileSync(path.join(root,'assets/realm-release-inventory.json'),JSON.stringify({build:build.runtime,reviewStatus:config.status,files:inventory},null,2)+'\n');
console.log(JSON.stringify({build,files:inventory.length,bytes:inventory.reduce((a,x)=>a+x.bytes,0)},null,2));
