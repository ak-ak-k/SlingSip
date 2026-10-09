import electron from 'electron';
import { spawn } from 'node:child_process';
import { watch, existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { buildElectron } from './build-electron.mjs';
import { prepareSlingSipPngs } from './prepare-slingsip-pngs.mjs';
import { DevelopmentWorkflow } from './dev-workflow.mjs';

// Canonicalize Windows short-name paths before Vite computes its asset allow list.
process.chdir(await realpath(process.cwd()));
await prepareSlingSipPngs();
await buildElectron();
const port=Number(process.env.SLINGSIP_DEV_PORT??4200);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('SLINGSIP_DEV_PORT must be an integer from 1024 to 65535.');
const rendererUrl='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['node_modules/@angular/cli/bin/ng.js','serve','--host','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe'],windowsHide:true});
const environment={...process.env,ELECTRON_RENDERER_URL:rendererUrl,SLINGSIP_DEV_SUPERVISED:'1'};
delete environment.ELECTRON_RUN_AS_NODE;
const watchers=[];
const workflow=new DevelopmentWorkflow({
  launch:()=>spawn(electron,['.',...process.argv.slice(2)],{stdio:['inherit','inherit','inherit','ipc'],env:environment,windowsHide:true}),
  build:buildElectron,prepareAssets:prepareSlingSipPngs,
  stopServer:code=>{watchers.forEach(watcher=>watcher.close());server.kill();process.exitCode=code;if(process.connected)process.disconnect();},
});
let output='';
server.stdout.on('data',chunk=>{
  process.stdout.write(chunk);output+=chunk.toString().replace(/\x1b\[[0-9;]*m/g,'');
  const lines=output.split(/\r?\n/);output=lines.pop();
  for(const line of lines){
    if(/Building\.\.\.|Changes detected.*Rebuilding/.test(line))workflow.angularBuilding=true;
    if(/Application bundle generation complete|Changes sent to client/.test(line))workflow.angularBuilt();
    if(/Application bundle generation failed/.test(line))workflow.angularBuilding=false;
  }
});
server.stderr.on('data',chunk=>process.stderr.write(chunk));
server.on('error',error=>{console.error(error);workflow.stop(1);});
server.on('exit',code=>{if(!workflow.stopping)workflow.stop(code??1);});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>workflow.stop());
if(typeof process.send==='function'){
  process.on('message',message=>{if(message?.type==='slingsip:quit')workflow.stop();});
  process.once('disconnect',()=>workflow.stop());
}

try{
  const deadline=Date.now()+90_000;let ready=false;
  while(!workflow.stopping&&Date.now()<deadline){
    try{const response=await fetch(rendererUrl,{signal:AbortSignal.timeout(1500)});if(response.ok){ready=true;break;}}
    catch{/* Angular is still starting. */}
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  if(!workflow.stopping){
    if(!ready)throw new Error('Angular did not become ready within 90 seconds.');
    for(const directory of ['electron','shared'])watchers.push(watch(directory,{recursive:true},(_event,file)=>{
      if(file&&/\.ts$/.test(String(file)))workflow.invalidate('electron');
    }));
    for(const directory of ['public','src/assets'])if(existsSync(directory))watchers.push(watch(directory,{recursive:true},()=>workflow.invalidate('assets')));
    workflow.start();
    console.log('[SlingSip dev] Angular HMR enabled. Main/preload changes restart Electron; assets regenerate masks and refresh both renderers. Ctrl+Alt+Shift+R restarts the app.');
  }
}catch(error){console.error(error);workflow.stop(1);}
