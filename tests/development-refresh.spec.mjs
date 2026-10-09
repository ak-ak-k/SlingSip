import { test, expect, chromium } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile, appendFile, symlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { seedExistingUserProfile } from './helpers/existing-user-electron.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function metadataPng(bytes){
  // Add only a standard text chunk; never edit the supplied raster/artwork.
  const payload=Buffer.from('SlingSipDevTest\0'+randomUUID()),type=Buffer.from('tEXt'),data=Buffer.concat([type,payload]);let crc=0xffffffff;
  for(const b of data){crc^=b;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}
  const chunk=Buffer.alloc(payload.length+12);chunk.writeUInt32BE(payload.length);data.copy(chunk,4);chunk.writeUInt32BE((crc^0xffffffff)>>>0,chunk.length-4);
  return Buffer.concat([bytes.subarray(0,-12),chunk,bytes.subarray(-12)]);
}
async function nativeShortcut(inspectorPort,modifiers){
  const targets=await(await fetch(`http://127.0.0.1:${inspectorPort}/json/list`)).json();
  const socket=new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>socket.close(),5000);
    socket.addEventListener('error',error=>{clearTimeout(timeout);reject(error);},{once:true});socket.addEventListener('close',()=>{clearTimeout(timeout);resolve();},{once:true});
    socket.addEventListener('message',event=>{const response=JSON.parse(event.data);if(response.id===1){clearTimeout(timeout);socket.close();const error=response.error?.message??response.result?.exceptionDetails?.text;error?reject(new Error(error)):resolve();}});
    socket.addEventListener('open',()=>socket.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{
      expression:`process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('#/dashboard')).webContents.sendInputEvent({type:'keyDown',keyCode:'R',modifiers:${JSON.stringify(modifiers)}})`,
    }})),{once:true});
  });
}

test('Real dev workflow replaces main/preload without stale instances, preserves data, supports HMR and refreshes updated PNG bytes',async()=>{
  test.setTimeout(360000);
  // Avoid Windows short-name TEMP aliases in Vite's filesystem allow list.
  const root=await mkdtemp(path.resolve('.cache/dev-refresh-')),profile='dev-refresh-'+randomUUID(),rendererPort=await port(),debugPort=await port(),inspectorPort=await port();
  await seedExistingUserProfile(profile);
  for(const file of ['scripts','electron','shared','src','public','angular.json','package.json','tsconfig.json','tsconfig.app.json','tsconfig.electron.json'])await cp(path.resolve(file),path.join(root,file),{recursive:true});
  await symlink(path.resolve('node_modules'),path.join(root,'node_modules'),process.platform==='win32'?'junction':'dir');
  const env={...process.env,SLINGSIP_DEV_PORT:String(rendererPort)};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
  const dev=spawn(process.execPath,['scripts/dev.mjs','--companion-test',`--companion-test-profile=${profile}`,`--remote-debugging-port=${debugPort}`,`--inspect=${inspectorPort}`],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
  let logs='',browser;
  dev.stdout.on('data',bytes=>logs+=bytes);dev.stderr.on('data',bytes=>logs+=bytes);
  const readyPids=()=>[...logs.matchAll(/Electron ready \(PID (\d+)\)/g)].map(m=>Number(m[1]));
  const connect=async()=>{
    await expect.poll(async()=>{try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);return true;}catch{return false;}},{timeout:60000}).toBe(true);
    await expect.poll(()=>browser.contexts()[0].pages().filter(p=>/#\/(dashboard|companion)$/.test(p.url())).length,{timeout:60000}).toBe(2);
    const pages=browser.contexts()[0].pages();return{dashboard:pages.find(p=>p.url().endsWith('#/dashboard')),overlay:pages.find(p=>p.url().endsWith('#/companion'))};
  };
  try{
    await expect.poll(()=>readyPids().length,{timeout:120000}).toBe(1);let{dashboard,overlay}=await connect();
    await dashboard.evaluate(async()=>{const s=await window.desktopCompanion.getHydrationSettings();await window.desktopCompanion.updateHydrationSettings({...s,workingStart:'00:00',workingEnd:'00:01'});});
    await dashboard.getByTestId('drink-water').click();await expect(dashboard.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');
    await appendFile(path.join(root,'electron/main.ts'),'\n// Isolated development main-watch verification.\n');
    await expect.poll(()=>readyPids().length,{timeout:60000}).toBe(2);({dashboard,overlay}=await connect());
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');
    await appendFile(path.join(root,'electron/preload.ts'),'\n// Isolated development preload-watch verification.\n');
    await expect.poll(()=>readyPids().length,{timeout:60000}).toBe(3);({dashboard,overlay}=await connect());
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');
    // Renderer edits use Angular HMR/live reload and keep the same main PID.
    const hero=path.join(root,'src/app/features/dashboard/overview-hero.component.ts');await writeFile(hero,(await readFile(hero,'utf8')).replace('YOUR DAILY SIDEKICK','YOUR DAILY SIDEKICK TEST'));
    await expect(dashboard.locator('app-overview-hero .eyebrow')).toHaveText('YOUR DAILY SIDEKICK TEST',{timeout:30000});expect(readyPids()).toHaveLength(3);
    const image=path.join(root,'public/assets/companion/slingsip/poses/idle.png'),updated=metadataPng(await readFile(image));
    const assetRefresh=Promise.all([dashboard,overlay].map(page=>page.waitForEvent('framenavigated',{predicate:frame=>frame===page.mainFrame(),timeout:30000})));
    await writeFile(image,updated);await assetRefresh;
    await expect.poll(async()=>sha(Buffer.from(await dashboard.evaluate(async()=>Array.from(new Uint8Array(await(await fetch('assets/companion/slingsip/poses/idle.png',{cache:'no-store'})).arrayBuffer()))))),{timeout:30000}).toBe(sha(updated));
    await expect.poll(()=>logs.includes('Changes detected')||logs.includes('Changes sent to client'),{timeout:30000}).toBe(true);
    await expect(dashboard.getByTestId('slingsip-hero-mascot')).toHaveAttribute('data-asset-key','idle');
    await expect(dashboard.getByTestId('slingsip-hero-mascot')).toHaveAttribute('data-source-hash',sha(updated));
    expect((await fetch(`http://127.0.0.1:${rendererPort}/assets/companion/slingsip/poses/idle.png`)).headers.get('cache-control')).toBe('no-store');expect(readyPids()).toHaveLength(3);
    // Full restart shortcut is explicit; ordinary Ctrl+Shift+R keeps the owner.
    // CDP keyboard events bypass Electron's before-input-event. Use its native
    // input API through the isolated test's loopback Node inspector instead.
    await nativeShortcut(inspectorPort,['control','shift']);await pause(500);expect(readyPids()).toHaveLength(3);
    await nativeShortcut(inspectorPort,['control','alt','shift']);await expect.poll(()=>readyPids().length,{timeout:60000}).toBe(4);({dashboard,overlay}=await connect());
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');expect(new Set(readyPids()).size).toBe(4);
    expect((await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).tray.available).toBe(true);
    await dashboard.getByTestId('open-companion').click();await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','reminder');
    expect(await overlay.getByTestId('character').getAttribute('data-renderer')).toBe('png-2.5d');
    expect(browser.contexts()[0].pages().filter(p=>/#\/(dashboard|companion)$/.test(p.url()))).toHaveLength(2);
  }finally{
    const exit=new Promise(resolve=>dev.once('exit',resolve));dev.send({type:'slingsip:quit'});
    await Promise.race([exit,pause(10000)]);if(dev.exitCode===null)dev.kill();
    await browser?.close().catch(()=>{});await writeFile(path.resolve('.cache/development-refresh-native.log'),logs);
  }
});
