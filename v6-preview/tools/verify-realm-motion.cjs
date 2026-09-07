const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const Realms=require('../realm-catalog.js');
const out='/tmp/sisyphus-realm-motion-qa';
const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;

(async()=>{
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--allow-file-access-from-files']});
  const results=[],errors=[];
  try {
    for(const [name,width,height,dpr] of [['portrait',430,932,3],['landscape',932,430,3],['desktop',1440,900,1]]) {
      if(process.env.QA_VIEWPORT && process.env.QA_VIEWPORT!==name)continue;
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:name!=='desktop',hasTouch:true});
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      for(const realm of Realms.entries) {
        if(process.env.QA_REALM && !process.env.QA_REALM.split(',').includes(realm.id))continue;
        await page.goto(url+'?qa=1&qaStart=1&qaWaterfall=700&qaRealmArt=1&qaRealm='+realm.id);
        await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
        await page.waitForTimeout(1600);
        const start=await page.evaluate(()=>window.__sisyphusDebug());
        assert.equal(start.realm,realm.id);assert.equal(start.score,700);
        const before=await page.locator('#game').screenshot();
        for(let i=0;i<12;i++){await page.touchscreen.tap(width*.7,height*.5);await page.waitForTimeout(220);}
        const pushed=await page.evaluate(()=>window.__sisyphusDebug());
        assert.ok(pushed.score>start.score+15,'Ordinary taps advance '+realm.id);
        await page.screenshot({path:path.join(out,name+'-'+realm.id+'-climbing.png'),scale:'css'});
        const after=await page.locator('#game').screenshot();assert.ok(!before.equals(after),'The actual rendered climb must move');
        const trace=await page.evaluate(()=>new Promise(resolve=>{
          const rows=[],t0=performance.now();
          function sample(now){const s=window.__sisyphusDebug();rows.push({t:now,score:s.score,velocity:s.journey.velocity,state:s.state,realm:s.realm});
            if(now-t0<6500)requestAnimationFrame(sample);else resolve(rows);}
          requestAnimationFrame(sample);
        }));
        for(let i=1;i<trace.length;i++){
          assert.equal(trace[i].state,'playing');assert.equal(trace[i].realm,realm.id);
          assert.ok(trace[i-1].score-trace[i].score<=320*(trace[i].t-trace[i-1].t)/1000+3,'No instant reset');
        }
        const fallen=await page.evaluate(()=>window.__sisyphusDebug());
        await fs.writeFile(path.join(out,name+'-'+realm.id+'-trace.json'),JSON.stringify({start,pushed,fallen,trace},null,2));
        assert.ok(fallen.score<pushed.score-20,'Releasing has a visible consequence');
        assert.ok(Math.min(...trace.map(s=>s.velocity))<-80,'Sustained rollback accelerates after push momentum and grace expire');
        await page.screenshot({path:path.join(out,name+'-'+realm.id+'-sliding.png'),scale:'css'});
        for(let i=0;i<10;i++){await page.touchscreen.tap(width*.7,height*.5);await page.waitForTimeout(250);}
        const recovered=await page.evaluate(()=>window.__sisyphusDebug());
        assert.ok(recovered.score>fallen.score,'The slide can be caught');
        const render=await page.evaluate(()=>{
          const c=document.querySelector('#game'),rect=c.getBoundingClientRect(),g=c.getContext('2d');
          const data=g.getImageData(0,0,c.width,c.height).data,colors=new Set();
          for(let i=0;i<data.length;i+=4)colors.add(data[i]+','+data[i+1]+','+data[i+2]);
          return {sx:rect.width/c.width,sy:rect.height/c.height,smoothing:g.imageSmoothingEnabled,colors:colors.size,overflow:document.documentElement.scrollWidth>innerWidth,perf:window.__sisyphusQa.frameStats()};
        });
        assert.equal(render.smoothing,false);assert.equal(render.sx,render.sy);assert.ok(Number.isInteger(render.sx));
        assert.ok(render.colors>100);assert.equal(render.overflow,false);assert.equal(recovered.loopError,'');
        results.push({viewport:name,realm:realm.id,start:start.score,pushed:pushed.score,fallen:fallen.score,recovered:recovered.score,render});
        console.log(name+' '+realm.id+': '+pushed.score+' -> '+fallen.score+' -> '+recovered.score);
      }
      await context.close();
    }
    assert.deepEqual(errors,[]);
  } finally {
    await fs.writeFile(path.join(out,process.env.QA_REALM?'subset-report.json':'report.json'),JSON.stringify({results,errors},null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
