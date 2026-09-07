const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const Realms=require('../realm-catalog.js');
const root=path.resolve(__dirname,'..'),out='/tmp/sisyphus-realm-routing-qa';
(async()=>{
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--allow-file-access-from-files']});
  const errors=[],views=[],normalModes=[];
  const url=pathToFileURL(path.join(root,'index.html')).href;
  try{
    for(const viewport of (process.env.QA_MENU_ONLY ? [] : [{name:'portrait',width:430,height:932},{name:'landscape',width:932,height:430},{name:'desktop',width:1440,height:900},{name:'wide',width:1920,height:1080}])){
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      for(const realm of Realms.entries){
        await page.goto(url+'?qa=1&qaRealmArt=1&qaRealm='+realm.id+'&qaStart=1&qaWaterfall=1&qaHoldAltitude=0');
        await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
        await page.waitForTimeout(1800);
        const state=await page.evaluate(()=>window.__sisyphusDebug());
        assert.equal(state.realm,realm.id);assert.equal(state.score,0);assert.equal(state.loopError,'');
        await page.keyboard.press('Space');await page.waitForTimeout(300);
        await page.screenshot({path:path.join(out,viewport.name+'-'+realm.id+'.png')});
        views.push({viewport:viewport.name,realm:realm.id,score:state.score});
        if(viewport.name==='portrait') {
          await page.goto(url+'?qa=1&qaRealmArt=1&qaRealm='+realm.id+'&qaStart=1&qaWaterfall=1&qaHoldAltitude=3000');
          await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
          await page.waitForTimeout(1400);
          const high=await page.evaluate(()=>({state:window.__sisyphusDebug(),terrain:JSON.parse(document.body.getAttribute('data-v6-terrain')||'{}')}));
          assert.equal(high.state.realm,realm.id);assert.equal(high.state.score,3000);assert.equal(high.state.loopError,'');
          assert.ok(!['canyon','volcanic','void','elysium'].includes(high.terrain.first),'Selected realm cannot change material at height');
          await page.screenshot({path:path.join(out,viewport.name+'-'+realm.id+'-3000.png')});
        }
      }
      await context.close();
    }
    const context=await browser.newContext({viewport:{width:430,height:932},hasTouch:true,isMobile:true});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);
    await page.evaluate(()=>{
      localStorage.setItem('sisyphus6.journey',JSON.stringify({version:1,altitude:813,peak:940}));
      localStorage.setItem('sisyphus6.best.endless','940');
      localStorage.setItem('sisyphus5.best.endless','777');
      localStorage.setItem('sisyphus6.ghost.endless',JSON.stringify({score:940,samples:[{t:0,s:0},{t:4,s:30},{t:8,s:80}]}));
    });
    await page.reload();await page.locator('#enterstart').click();
    await page.waitForFunction(()=>document.querySelector('#startscreen').classList.contains('menu-ready'));
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('.realm-choice').count(),6);
    await page.screenshot({path:path.join(out,'menu-portrait.png')});
    await page.locator('[data-realm="snow"]').click();
    assert.equal(await page.locator('#startselected').textContent(),'start the snow at 0m');
    await page.screenshot({path:path.join(out,'menu-snow-portrait.png')});
    await page.locator('#startselected').click();
    await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
    assert.equal((await page.evaluate(()=>window.__sisyphusDebug())).score,0);
    assert.equal((await page.evaluate(()=>window.__sisyphusDebug())).ghostLoaded,false,'Legacy ghost must not appear in a fresh realm');
    for(let i=0;i<10;i++){await page.touchscreen.tap(300,500);await page.waitForTimeout(220);}
    await page.locator('#mpause').click();await page.locator('#pausemenu').click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('sisyphus6.realm.snow.journey')));
    assert.ok(saved.altitude>0);assert.equal(saved.realm,'snow');
    await page.evaluate(()=>localStorage.setItem('sisyphus6.realm.snow.ghost',JSON.stringify({score:300,samples:[{t:0,s:0},{t:5,s:40},{t:10,s:90}]})));
    await page.locator('[data-realm="moon-rome"]').click();await page.locator('#startselected').click();
    await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
    assert.equal((await page.evaluate(()=>window.__sisyphusDebug())).score,0);
    await page.locator('#mpause').click();await page.locator('#pausemenu').click();
    await page.locator('[data-realm="snow"]').click();await page.locator('#realmcontinue').click();
    await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
    assert.equal((await page.evaluate(()=>window.__sisyphusDebug())).score,Math.round(saved.altitude));
    assert.equal((await page.evaluate(()=>window.__sisyphusDebug())).ghostLoaded,true,'Continue loads the matching realm ghost');
    for(let i=0;i<10;i++){await page.touchscreen.tap(300,500);await page.waitForTimeout(220);}
    await page.locator('#mpause').click();await page.locator('#pauserestart').click();
    await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
    assert.equal((await page.evaluate(()=>window.__sisyphusDebug())).score,0,'Restart returns the same realm to zero');
    const remembered=await page.evaluate(()=>JSON.parse(localStorage.getItem('sisyphus6.runs.v1')));
    assert.equal(remembered[0].realm,'snow','Completed climbs retain their realm identity');
    await page.locator('#mpause').click();await page.locator('#pausemenu').click();
    await page.locator('[data-realm="snow"]').click();await page.locator('#startselected').click();
    await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
    assert.equal((await page.evaluate(()=>window.__sisyphusDebug())).score,0,'Fresh start must not silently resume the same realm');
    const stored=await page.evaluate(()=>({legacy:JSON.parse(localStorage.getItem('sisyphus6.journey')).altitude,best:localStorage.getItem('sisyphus6.best.endless'),v5:localStorage.getItem('sisyphus5.best.endless')}));
    assert.deepEqual(stored,{legacy:813,best:'940',v5:'777'});
    await page.goto(url+'?qa=1&realm=snow');
    await page.locator('#enterstart').click();
    await page.waitForFunction(()=>document.querySelector('#startscreen').classList.contains('menu-ready'));
    await page.locator('#sharebtn').evaluate(button=>button.click());
    const link=await page.getAttribute('body','data-sisyphus-last-link');
    assert.equal(new URL(link).searchParams.get('realm'),'snow');
    await page.goto(link);
    await page.locator('#enterstart').click();
    await page.waitForFunction(()=>document.querySelector('#startscreen').classList.contains('menu-ready'));
    await page.locator('#startselected').click();
    await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
    const linked=await page.evaluate(()=>window.__sisyphusDebug());
    assert.equal(linked.realm,'snow');assert.equal(linked.score,0);
    await page.locator('#mpause').click();await page.locator('#pausemenu').click();
    for(const mode of ['endless','daily','summit','resolve','timed','rush']) {
      if(!await page.locator('#othermodes').evaluate(el=>el.open))await page.locator('#othermodes summary').click();
      await page.locator('.mode-card[data-mode="'+mode+'"]').click();
      await page.locator('#startselected').click();
      await page.waitForFunction(()=>window.__sisyphusDebug?.().state==='playing');
      let current=await page.evaluate(()=>window.__sisyphusDebug());
      assert.equal(current.mode,mode);assert.equal(current.realm,null,'Other modes clear realm selection');
      if(mode==='endless') assert.equal(current.score,813,'Legacy Continue remains accessible from Other modes');
      else {
        for(let i=0;i<8;i++){await page.touchscreen.tap(300,500);await page.waitForTimeout(220);}
        current=await page.evaluate(()=>window.__sisyphusDebug());assert.ok(current.score>0,'Normal menu mode accepts input');
      }
      normalModes.push({mode,score:current.score});
      await page.locator('#mpause').click();await page.locator('#pausemenu').click();
    }
    await page.evaluate(()=>localStorage.removeItem('sisyphus6.selectedRealm'));
    for(const viewport of [{name:'portrait',width:430,height:932},{name:'landscape',width:932,height:430},{name:'desktop',width:1440,height:900}]) {
      await page.setViewportSize({width:viewport.width,height:viewport.height});
      await page.goto(url+'?qa=1&realmsPreview=1');await page.waitForTimeout(2200);
      await page.screenshot({path:path.join(out,'opening-'+viewport.name+'.png')});
    }
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(out,process.env.QA_MENU_ONLY?'menu-report.json':'report.json'),JSON.stringify({views,saved,stored,normalModes,errors},null,2));
    console.log(JSON.stringify({views:views.length,saved:saved.altitude,stored,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
