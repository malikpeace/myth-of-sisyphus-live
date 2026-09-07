const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const out = process.env.QA_OUTPUT || '/tmp/sisyphus-endless-qa';
fs.mkdirSync(out, {recursive:true});

(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--allow-file-access-from-files']});
  const report = {viewports:[], movement:[], saves:[], smoke:[]};
  const errors = [];
  try {
    for (const [name,width,height,dpr] of [['portrait',430,932,3],['landscape',932,430,3],['desktop',1440,900,1]]) {
      const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:name!=='desktop',hasTouch:name!=='desktop'});
      const page = await context.newPage();
      page.on('pageerror', e=>errors.push(e.message));
      await page.goto(url+'?qa=1');
      await page.waitForFunction(()=>window.__sisyphusDebug?.().sceneryReady);
      await page.waitForTimeout(500);
      await page.screenshot({path:path.join(out,`${name}-title.png`)});
      const lowerColors=await page.evaluate(()=>{
        const c=game.getContext('2d'),y=Math.floor(game.height*0.75);
        const pixels=c.getImageData(0,y,game.width,game.height-y).data;
        const colors=new Set();for(let i=0;i<pixels.length;i+=4) colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
        return colors.size;
      });
      assert.ok(lowerColors>40,'Title foreground must contain detailed scenery, not a flat fill');
      for (const altitude of [0,400,650,755,1145,1800]) {
        await page.goto(url + '?qa=1&qaStart=1&qaWaterfall=1&qaHoldAltitude='+altitude);
        await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing' && window.__sisyphusDebug().sceneryReady);
        await page.waitForTimeout(1000);
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);
        const first = await page.screenshot({path:path.join(out,`${name}-${altitude}.png`)});
        await page.waitForTimeout(500);
        const second = await page.screenshot({path:path.join(out,`${name}-${altitude}-motion.png`)});
        assert.notDeepEqual(first,second,'Scene must continue animating');
        const stats = await page.evaluate(()=>({debug:window.__sisyphusDebug(),perf:window.__sisyphusQa.frameStats(),canvas:{width:game.width,height:game.height,displayWidth:game.getBoundingClientRect().width,displayHeight:game.getBoundingClientRect().height,smoothing:game.getContext('2d').imageSmoothingEnabled},overflow:document.documentElement.scrollWidth>innerWidth}));
        assert.equal(stats.debug.loopError,'');
        assert.equal(stats.debug.mode,'endless');
        assert.equal(stats.canvas.smoothing,false);
        assert.equal(stats.canvas.displayWidth/stats.canvas.width,stats.canvas.displayHeight/stats.canvas.height);
        assert.equal(Number.isInteger(stats.canvas.displayWidth/stats.canvas.width),true);
        assert.equal(stats.overflow,false);
        const pixelCount = await page.evaluate(()=>{
          const pixels=game.getContext('2d').getImageData(0,0,game.width,game.height).data;
          const colors=new Set();
          for(let i=0;i<pixels.length;i+=4) colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
          return colors.size;
        });
        assert.ok(pixelCount>100,'The actual canvas must contain a rendered world');
        report.viewports.push({name,altitude,perf:stats.perf,canvas:stats.canvas});
      }
      await context.close();
    }
    const smokeContext = await browser.newContext({viewport:{width:430,height:932},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
    const smokePage = await smokeContext.newPage();
    smokePage.on('pageerror',e=>errors.push(e.message));
    for(const mode of ['summit','timed','daily','resolve','rush']) {
      await smokePage.goto(url+'?qa=1&qaStart=1&mode='+mode);
      await smokePage.keyboard.press('Enter');
      await smokePage.waitForTimeout(500);
      await smokePage.keyboard.press('Enter');
      await smokePage.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
      for(let tap=0;tap<8;tap++) {await smokePage.touchscreen.tap(300,500);await smokePage.waitForTimeout(180);}
      const state=await smokePage.evaluate(()=>window.__sisyphusDebug());
      assert.equal(state.mode,mode);
      assert.equal(state.loopError,'');
      assert.ok(state.score>0,'Existing mode must respond to input');
      report.smoke.push({mode,score:state.score});
    }
    for(const look of ['noir','void']) {
      await smokePage.goto(url+'?qa=1&qaStart=1&qaWaterfall=1&qaHoldAltitude=0&qaLook='+look);
      await smokePage.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
      await smokePage.waitForTimeout(1000);
      await smokePage.screenshot({path:path.join(out,`${look}-portrait.png`)});
      await smokePage.setViewportSize({width:932,height:430});
      await smokePage.waitForTimeout(600);
      await smokePage.screenshot({path:path.join(out,`${look}-landscape.png`)});
      assert.equal((await smokePage.evaluate(()=>window.__sisyphusDebug())).loopError,'');
      await smokePage.setViewportSize({width:430,height:932});
      report.smoke.push({look,rotation:true,reducedMotion:true});
    }
    await smokeContext.close();
    const context = await browser.newContext({viewport:{width:430,height:932},hasTouch:true,isMobile:true});
    const page = await context.newPage();
    page.on('pageerror', e=>errors.push(e.message));
    for (const altitude of [20,700,2400]) {
      await page.goto(url+'?qa=1&qaStart=1&qaWaterfall='+altitude);
      await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
      const start = await page.evaluate(()=>window.__sisyphusDebug().score);
      for(let tap=0;tap<20;tap++) {
        await page.touchscreen.tap(300,500);
        await page.waitForTimeout(350);
      }
      const pushed = await page.evaluate(()=>window.__sisyphusDebug());
      assert.ok(pushed.score>start+10,'Comfortable taps should produce meaningful progress');
      await page.waitForTimeout(8000);
      const fallen = await page.evaluate(()=>window.__sisyphusDebug());
      assert.ok(fallen.score>0,'No instant reset');
      assert.ok(fallen.score<pushed.score-4,'The stone visibly rolls back when released');
      assert.ok(pushed.score-fallen.score<8*48+1,'Rollback has a gradual speed limit');
      if(altitude===700) {
        await page.waitForTimeout(4000);
        const stillFalling=await page.evaluate(()=>window.__sisyphusDebug());
        assert.ok(stillFalling.score<fallen.score-10,'Rollback must not stop at the old short fall limit');
        fallen.score=stillFalling.score;
      }
      for(let tap=0;tap<8;tap++) { await page.touchscreen.tap(300,500); await page.waitForTimeout(350); }
      const recovered = await page.evaluate(()=>window.__sisyphusDebug());
      assert.ok(recovered.score>fallen.score,'A fall can be recovered with normal tapping');
      report.movement.push({start,pushed:pushed.score,fallen:fallen.score,recovered:recovered.score});
      await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
      const paused = await page.evaluate(()=>window.__sisyphusDebug());
      await page.waitForTimeout(800);
      assert.equal((await page.evaluate(()=>window.__sisyphusDebug())).score,paused.score);
      assert.equal(paused.paused,true);
    }
    // A new browser context has no access to the owner's saves. Only this test's
    // isolated storage receives a fixture, including the V5 preservation sentinel.
    await page.goto(url);
    await page.evaluate(()=>{
      localStorage.setItem('sisyphus5.best.endless','999');
      localStorage.setItem('sisyphus6.journey',JSON.stringify({version:1,altitude:813.25,peak:940,roll:11,gait:7,energy:0.8,resolve:0.4,elapsed:77}));
    });
    await page.reload();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
    const restored = await page.evaluate(()=>window.__sisyphusDebug());
    assert.equal(restored.score,813);
    assert.equal(restored.journey.waiting,true);
    await page.waitForTimeout(1000);
    assert.equal((await page.evaluate(()=>window.__sisyphusDebug())).score,813);
    await page.touchscreen.tap(300,500);
    await page.waitForTimeout(200);
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
    const saved = await page.evaluate(()=>({data:JSON.parse(localStorage.getItem('sisyphus6.journey')),v5:localStorage.getItem('sisyphus5.best.endless')}));
    assert.ok(saved.data.altitude>=813);
    assert.equal(saved.v5,'999');
    report.saves.push({restored:restored.score,saved:saved.data.altitude,v5Untouched:saved.v5==='999'});
    await page.reload();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    assert.equal((await page.locator('#startselected').innerText()).toLowerCase(),'continue climb');
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
    const beforeKey = (await page.evaluate(()=>window.__sisyphusDebug())).score;
    await page.keyboard.press('e');
    assert.equal((await page.evaluate(()=>window.__sisyphusDebug())).score,beforeKey,'Developer jump must not run in production');
    await context.close();
    assert.deepEqual(errors,[]);
    report.errors=errors;
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({...report,errors},null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1});
