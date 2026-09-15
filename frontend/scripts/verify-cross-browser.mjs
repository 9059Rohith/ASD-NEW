import { chromium, firefox } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
const base = process.env.CROSS_BROWSER_URL || 'http://127.0.0.1:5173'
const out = path.resolve(`../.runlogs/cross-browser-experience${process.env.CROSS_BROWSER_ONLY ? '-'+process.env.CROSS_BROWSER_ONLY : ''}${process.env.CROSS_FORCE_FALLBACK ? '-fallback' : process.env.CROSS_CAPTURE_ONLY ? '-capture' : ''}.json`)
const report = { base, started: new Date().toISOString(), scope: 'Native browser synthetic microphone capture; fixture auth/session/results, no server writes, no ML accuracy claim', browsers: [] }
const vowels = ['a','aa','i','ii','u','uu','e','ee','ai','o','oo','au'].map((id,i)=>[id,String.fromCodePoint([0xb85,0xb86,0xb87,0xb88,0xb89,0xb8a,0xb8e,0xb8f,0xb90,0xb92,0xb93,0xb94][i])])
for (const name of (process.env.CROSS_BROWSER_ONLY ? [process.env.CROSS_BROWSER_ONLY] : ['chromium','edge','firefox'])) {
  const result = { name, checks: [], pageErrors: [], consoleErrors: [], failedRequests: [] }
  report.browsers.push(result)
  const check = (label, ok, evidence) => { result.checks.push({name:label,passed:!!ok,evidence}); fs.writeFileSync(out,JSON.stringify(report,null,2)); console.log(name,label,!!ok); if(!ok) throw Error(`${label}: ${JSON.stringify(evidence)}`) }
  let browser
  try {
    browser = await (name === 'firefox' ? firefox : chromium).launch(name === 'firefox' ? {...(process.env.FIREFOX_EXECUTABLE ? {executablePath:process.env.FIREFOX_EXECUTABLE} : {}),firefoxUserPrefs:{'media.navigator.streams.fake':true,'media.navigator.permission.disabled':true}} : { ...(name === 'edge' ? {channel:'msedge'} : {}), args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--disable-gpu'] })
    result.version = browser.version()
    const context = await browser.newContext({viewport:{width:1440,height:1000}, ...(name==='firefox'?{}:{permissions:['microphone']})})
    await context.addInitScript(() => {
      window.__proof = {tracks:[],durations:[],recorders:[],contexts:[],uploads:[],workletEvents:[]}
      const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async (...args) => {const stream=await get(...args);window.__proof.tracks.push(...stream.getTracks());return stream}
      const Native = window.MediaRecorder
      window.MediaRecorder = class extends Native {start(...args){this.started=performance.now();window.__proof.recorders.push(this);return super.start(...args)}stop(){window.__proof.durations.push(performance.now()-this.started);return super.stop()}}
      const AC = window.AudioContext
      window.AudioContext = class extends AC {constructor(...args){super(...args);window.__proof.contexts.push(this)}}
      const AN=window.AudioWorkletNode
      window.AudioWorkletNode=class extends AN {constructor(...args){super(...args);window.__proof.workletEvents.push({event:'node-created',at:performance.now(),rate:args[0].sampleRate,state:args[0].state});this.addEventListener('processorerror',event=>window.__proof.workletEvents.push({event:'processorerror',message:event.message,at:performance.now()}));this.port.addEventListener('message',event=>window.__proof.workletEvents.push({event:'received',type:event.data.type,count:event.data.samples?.length,at:performance.now()}));const post=this.port.postMessage.bind(this.port);this.port.postMessage=(data,...rest)=>{window.__proof.workletEvents.push({event:'sent',type:data.type,at:performance.now()});return post(data,...rest)}}}
      const add=Worklet.prototype.addModule
      Worklet.prototype.addModule=function(...args){window.__proof.workletEvents.push({event:'addModule',url:String(args[0]),at:performance.now()});return add.apply(this,args).then(value=>{window.__proof.workletEvents.push({event:'module-loaded',at:performance.now()});return value},error=>{window.__proof.workletEvents.push({event:'module-failed',message:String(error),at:performance.now()});throw error})}
      const send=XMLHttpRequest.prototype.send
      XMLHttpRequest.prototype.send=function(body){const audio=body instanceof FormData?body.get('audio'):null;if(audio){const entry={name:audio.name,type:audio.type,size:audio.size};window.__proof.uploads.push(entry);audio.slice(0,44).arrayBuffer().then(bytes=>{const view=new DataView(bytes);entry.containerHeader=Array.from(new Uint8Array(bytes).slice(0,4),b=>b.toString(16).padStart(2,'0')).join('');if(entry.type==='audio/wav'){entry.format=view.getUint16(20,true);entry.sampleRate=view.getUint32(24,true);entry.bits=view.getUint16(34,true)}})}return send.call(this,body)}
    })
    const page=await context.newPage()
    page.setDefaultTimeout(60000)
    page.setDefaultNavigationTimeout(90000)
    page.on('pageerror',e=>result.pageErrors.push(e.message))
    page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text())})
    page.on('requestfailed',r=>result.failedRequests.push({url:r.url(),error:r.failure()?.errorText}))
    let uploads=0
    const screenshot = async label => {
      const pause=page.getByRole('button',{name:'Pause slideshow',exact:true})
      if(await pause.count())await pause.click()
      await page.evaluate(async () => { for (const image of document.images) { image.loading = 'eager' } await Promise.race([Promise.all([...document.images].map(image => image.decode().catch(() => {}))),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Image decode timed out before screenshot')),10000))]) })
      const file=path.resolve(`../.runlogs/cross-${name}-${label}.png`)
      await page.screenshot({path:file,animations:'disabled'})
      ;(result.screenshots ||= []).push(file)
    }
    await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',body:''}))
    if(process.env.CROSS_FORCE_FALLBACK)await page.route('**/assets/floatPcmWorklet-*.js',r=>r.fulfill({status:503,contentType:'text/javascript',body:'/* Deliberate worklet load failure to exercise native fallback. */'}))
    await page.route('**/api/**',async route=>{
      const req=route.request(), pathname=new URL(req.url()).pathname
      if(pathname==='/api/auth/me')return route.fulfill({json:{id:'isolated-cross-browser',role:'user',full_name:'Isolated QA',child_name:'QA',child_age:8}})
      if(pathname==='/api/tamil/catalog')return route.fulfill({json:{items:vowels.map(([id,text])=>({id:`letter-${id}`,kind:'vowel',text,transliteration:id,phoneme_target:id,studio_target:id,tip:'Say one vowel naturally.'}))}})
      if(pathname==='/api/tamil/progress')return route.fulfill({json:{total_attempts:0,by_kind:{},recent_attempts:[]}})
      if(pathname==='/api/vowels/progress')return route.fulfill({json:{total_attempts:0,per_vowel:[],recent_scores:[]}})
      if(pathname==='/api/vowels/sessions')return route.fulfill({json:{id:'isolated-session',session_id:'isolated-session',mode:'practice',challenges:[{index:0,target_phoneme:'a',identity:'A',length:'short',symbol:vowels[0][1],tip:'Say one vowel.'}]}})
      if(pathname==='/api/vowels/analyze'){uploads++;if(process.env.CROSS_FORCE_FALLBACK){const form=await new Response(req.postDataBuffer(),{headers:{'content-type':req.headers()['content-type']}}).formData();const audio=form.get('audio');fs.writeFileSync(path.resolve(`../.runlogs/${name}-fallback.webm`),Buffer.from(await audio.arrayBuffer()))}return route.fulfill({json:{result:{scorable:false,accuracy:null,validation_status:'no_speech',feedback:'Synthetic test capture received. Try a real vowel when practising.'}}})}
      return route.fulfill({status:404,json:{detail:`Unexpected fixture path: ${pathname}`}})
    })
    for(const width of (process.env.CROSS_CAPTURE_ONLY ? [] : [360,768,1440])) {
      await page.setViewportSize({width,height:1000});await page.goto(base);await page.locator('#voice-home-title').waitFor();await page.evaluate(()=>document.fonts.ready)
      check(`home fits ${width}`,await page.evaluate(()=>document.documentElement.scrollWidth)<=width)
      check(`Tamil font ${width}`,await page.evaluate(()=>document.fonts.check('500 24px "Noto Sans Tamil"',String.fromCodePoint(0xb90,0xb94,0xba4,0xbae,0xbbf,0xbb4,0xbcd))))
      if(width!==768)await screenshot(`home-${width}`)
      await page.goto(`${base}/tamil`);await page.locator('.tamil-learning-page').waitFor();await page.getByText(vowels[0][1],{exact:true}).first().waitFor()
      check(`Tamil hub fits ${width}`,await page.evaluate(()=>document.documentElement.scrollWidth)<=width)
      if(width!==768)await screenshot(`tamil-${width}`)
    }
    await page.goto(`${base}/practice?target=a`)
    await page.getByRole('button',{name:'Start recording',exact:true}).waitFor()
    check('Pippin rendered',await page.locator('[data-testid="pippin-story-svg"]').count()===1)
    for(const width of (process.env.CROSS_CAPTURE_ONLY ? [] : [360,768,1440])) {await page.setViewportSize({width,height:1000});check(`Practice fits ${width}`,await page.evaluate(()=>document.documentElement.scrollWidth)<=width);if(width!==768)await screenshot(`practice-${width}`)}
    await page.getByRole('button',{name:'Start recording',exact:true}).click()
    await page.locator('.vowel-studio[data-state="RECORDING"]').waitFor({timeout:15000})
    check('No Stop/Pause capture button',await page.getByRole('button',{name:/Stop|Pause|Cancel analysis/}).count()===0)
    check('Pippin listens',await page.locator('[data-testid="pippin-story-svg"]').getAttribute('data-mood')==='listening')
    await page.getByRole('button',{name:'Try again',exact:true}).waitFor({timeout:20000})
    await page.waitForTimeout(200)
    result.capture=await page.evaluate(()=>({durations:window.__proof.durations,tracks:window.__proof.tracks.map(t=>t.readyState),recorders:window.__proof.recorders.map(r=>({state:r.state,mime:r.mimeType})),contexts:window.__proof.contexts.map(c=>c.state),uploads:window.__proof.uploads,worklet:typeof AudioWorkletNode==='function',workletEvents:window.__proof.workletEvents}))
    check('Exactly one seven-second native capture',result.capture.durations.length===1&&result.capture.durations[0]>=6700&&result.capture.durations[0]<9500,result.capture.durations)
    check('Microphone tracks released',result.capture.tracks.length>0&&result.capture.tracks.every(s=>s==='ended'),result.capture.tracks)
    check('Audio contexts closed',result.capture.contexts.every(s=>s==='closed'),result.capture.contexts)
    if(process.env.CROSS_FORCE_FALLBACK)check('Native WebM fallback upload',uploads===1&&result.capture.uploads[0]?.type==='audio/webm;codecs=opus'&&result.capture.uploads[0]?.size>1000,result.capture.uploads)
    else check('Float WAV upload',uploads===1&&result.capture.uploads[0]?.format===3&&result.capture.uploads[0]?.bits===32,result.capture.uploads)
    check('Pippin retry from unscored result',await page.locator('[data-testid="pippin-story-svg"]').getAttribute('data-mood')==='retry')
    await page.emulateMedia({reducedMotion:'reduce'})
    await page.locator('.pippin-story-scene[data-motion="minimal"]').waitFor()
    check('Pippin reduced animation stops',await page.locator('.pippin-story-scene').getAttribute('data-motion')==='minimal')
    await page.goto(base);await page.getByRole('button',{name:'Play slideshow'}).waitFor()
    check('Reduced carousel explicitly disabled',await page.getByRole('button',{name:'Play slideshow'}).isDisabled())
    check('No page errors',result.pageErrors.length===0,result.pageErrors)
  } catch(error) {result.error=error.stack} finally {await browser?.close();fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(name,JSON.stringify({checks:result.checks.length,error:result.error,capture:result.capture}))}
}
console.log(out)
process.exitCode=report.browsers.some(b=>b.error)?1:0
