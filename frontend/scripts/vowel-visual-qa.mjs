import { chromium } from 'playwright'
import fs from 'node:fs'
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--disable-gpu']})
const context=await browser.newContext({viewport:{width:1536,height:1024},reducedMotion:'reduce'})
const account=JSON.parse(fs.readFileSync('../.runlogs/vowel-browser-account.log','utf8'))
const login=await context.request.post('http://127.0.0.1:5181/api/auth/login',{data:{email:account.email,password:account.password}})
console.log('Login',login.status())
if (login.status() !== 200) throw new Error('Visual QA login failed')
const page=await context.newPage()
const issues=[]
page.on('pageerror',e=>issues.push(e.message))
for (const [slug,url] of [['home','/'],['practice','/practice'],['games','/games'],['evaluate','/evaluate'],['progress','/progress'],['training','/training'],['care','/dashboard']]) {
 await page.goto('http://127.0.0.1:5181'+url)
 await page.locator('h1,h2').first().waitFor({timeout:30000})
 if(slug === 'practice') await page.getByRole('button',{name:'Start recording'}).waitFor({timeout:60000})
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(im=>{im.loading='eager';return im.decode().catch(()=>{})}))})
 await page.screenshot({path:'../.runlogs/vowel-'+slug+'-desktop.png',fullPage:true})
 console.log(slug,await page.title(),await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))
}
await page.setViewportSize({width:390,height:844})
for(const [slug,url] of [['home','/'],['practice','/practice'],['games','/games'],['evaluate','/evaluate'],['progress','/progress']]) {
 await page.goto('http://127.0.0.1:5181'+url)
 await page.locator('h1,h2').first().waitFor({timeout:30000})
 if(slug === 'practice') await page.getByRole('button',{name:'Start recording'}).waitFor({timeout:60000})
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(im=>{im.loading='eager';return im.decode().catch(()=>{})}))})
 await page.screenshot({path:'../.runlogs/vowel-'+slug+'-mobile.png',fullPage:true})
 console.log('mobile',slug,'overflow',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))
}
console.log('pageErrors',JSON.stringify(issues))
await browser.close()
