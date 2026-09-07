const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const sharp = require('sharp');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '..');
const out = '/tmp/sisyphus-realm-art-qa';

(async () => {
  await fs.mkdir(out, {recursive:true});
  const config = JSON.parse(await fs.readFile(path.join(root,'realm-palettes.json'),'utf8'));
  for(const asset of config.assets) {
    const {data,info} = await sharp(path.join(root,'assets',asset.output)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,asset.width); assert.equal(info.height,asset.height);
    const palette = new Set(asset.ramps.flatMap(r=>config.ramps[r].map(c=>c.slice(1))));
    for(let i=0;i<data.length;i+=4) {
      assert.ok(data[i+3]===0 || data[i+3]===255,'No soft alpha fringes');
      if(data[i+3]) assert.ok(palette.has(data.subarray(i,i+3).toString('hex')),'Only authored material colors');
    }
  }
  const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--allow-file-access-from-files']});
  const errors=[], report=[];
  try {
    for(const device of [{name:'portrait',width:430,height:932,dpr:3},{name:'landscape',width:932,height:430,dpr:3},{name:'desktop',width:1440,height:900,dpr:1}]) {
      const context = await browser.newContext({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.dpr});
      const page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
      const url = pathToFileURL(path.join(root,'index.html')).href;
      await page.goto(url+'?qa=1&qaStart=1&qaWaterfall=1&qaHoldAltitude=755&qaRealmArt=1&qaRealm=waterfalls');
      await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
      await page.waitForTimeout(1800); await page.keyboard.press('Space');
      await page.waitForTimeout(400);
      await page.screenshot({path:path.join(out,device.name+'-waterfall.png')});
      const before = await page.locator('#game').screenshot();
      await page.waitForTimeout(700);
      const after = await page.locator('#game').screenshot();
      assert.ok(!before.equals(after),'Waterfall remains animated in gameplay');
      const debug = await page.evaluate(()=>({game:window.__sisyphusDebug(),perf:window.__sisyphusQa.frameStats()}));
      assert.equal(debug.game.loopError,'');
      report.push({viewport:device.name,perf:debug.perf});
      await context.close();
    }
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(root,'index.html')).href+'?qa=1');
    const geometry = await page.evaluate(async()=>{
      const c=document.createElement('canvas'); c.width=480;c.height=320;
      const g=c.getContext('2d'), art=new window.SisyphusRealmArchitecture();
      art.bridge(g,{width:480,height:320,scroll:0,surface:()=>100,span:112,pier:22,depth:180,palette:'forest'});
      const at=(x,y)=>g.getImageData(x,y,1,1).data[3];
      const result={deck:at(56,100),arch:at(56,180),pier:at(0,180),above:at(56,99)};
      const image=new Image(); image.src='v6-preview/assets/realm-cherry-tree-v1-native.png'; await image.decode();
      function tree(time){g.clearRect(0,0,480,320);art.cherry(g,{image,x:120,bottom:300,size:192,time,seed:0});return g.getImageData(0,0,480,320).data;}
      const a=tree(0),b=tree(2); let moving=0,baseMoving=0;
      for(let i=0;i<a.length;i+=4) if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3]) {
        moving++; if(Math.floor(i/4/480)>285)baseMoving++;
      }
      return {...result,moving,baseMoving};
    });
    assert.equal(geometry.deck,255);assert.equal(geometry.arch,0);assert.equal(geometry.pier,255);assert.equal(geometry.above,0);
    assert.ok(geometry.moving>100); assert.equal(geometry.baseMoving,0,'Tree roots do not slide in wind');
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(out,'report.json'),JSON.stringify({report,geometry,errors},null,2));
    console.log(JSON.stringify({report,geometry,errors},null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
