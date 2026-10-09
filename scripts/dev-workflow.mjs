import { DEV_PROFILE_CONFLICT_EXIT_CODE, DEV_RESTART_EXIT_CODE } from '../shared/development-contract.ts';

/** One parent owns one Electron child. Compilation and replacement never overlap. */
export class DevelopmentWorkflow {
  constructor({ launch, build, prepareAssets, stopServer, log=console.log, debounceMs=250 }) {
    Object.assign(this,{launch,build,prepareAssets,stopServer,log,debounceMs});
    this.pending=new Set();this.stopping=false;this.busy=false;this.needsLaunch=false;
  }
  start() {
    if(this.stopping||this.child)return;
    const child=this.launch();this.child=child;this.ready=false;
    child.on('message',message=>{
      if(message?.type==='slingsip:ready'&&this.child===child){
        this.ready=true;this.log(`[SlingSip dev] Electron ready (PID ${message.pid}).`);
        if(this.pendingReload){this.pendingReload=false;this.send('slingsip:reload-assets');}
      }
    });
    child.on('error',error=>{this.log(error);this.stop(1);});
    child.once('exit',(code,signal)=>{
      if(this.child!==child)return;
      this.child=undefined;this.ready=false;
      if(this.forceStopTimer){clearTimeout(this.forceStopTimer);this.forceStopTimer=undefined;}
      if(this.stopping)return;
      if(code===DEV_RESTART_EXIT_CODE){this.needsLaunch=true;if(!this.busy)this.replace();}
      else{
        if(code===DEV_PROFILE_CONFLICT_EXIT_CODE)this.log('[SlingSip dev] Another SlingSip instance owns this profile. Quit that instance from its tray, then run npm run dev. No second tray or scheduler was created.');
        this.stop(code??(signal?1:0));
      }
    });
  }
  send(type) {
    const child=this.child;
    if(!child?.connected)return false;
    child.send({type},error=>{if(error&&!this.stopping&&this.child===child)this.log(error);});return true;
  }
  invalidate(kind) {
    if(this.stopping)return;
    this.pending.add(kind);clearTimeout(this.debounce);
    this.debounce=setTimeout(()=>{this.debounce=undefined;void this.flush();},this.debounceMs);
  }
  async flush() {
    if(this.busy||this.stopping)return;
    this.busy=true;let restart=false,reload=false;
    try{
      while(this.pending.size&&!this.stopping){
        const pending=this.pending;this.pending=new Set();
        if(pending.has('electron')){
          try{await this.build();restart=true;this.log('[SlingSip dev] Main/preload built; requesting a clean restart.');}
          catch(error){this.log('[SlingSip dev] Build failed; the running Electron instance is kept.');this.log(error);restart=false;}
        }
        if(pending.has('assets')){
          try{await this.prepareAssets();}
          catch(error){this.log('[SlingSip dev] Asset preparation failed; refreshing to expose the approved-only fallback.');this.log(error);}
          reload=true;
        }
      }
      if(!this.stopping){
        if(restart)this.send('slingsip:restart');
        if(reload){
          this.pendingReload=true;
          clearTimeout(this.assetRefreshTimer);
          // Static-only edits may not need an Angular bundle rebuild.
          this.assetRefreshTimer=setTimeout(()=>{if(!this.angularBuilding)this.angularBuilt();},1500);
        }
      }
    }finally{this.busy=false;if(this.needsLaunch&&!this.stopping)this.replace();}
  }
  angularBuilt() {
    this.angularBuilding=false;
    if(this.stopping)return;
    // Angular must finish the rebuild containing regenerated geometry first.
    if(this.pendingReload&&!this.busy&&this.ready){this.pendingReload=false;this.send('slingsip:reload-assets');}
  }
  replace() {
    if(this.child||this.stopping)return;
    this.needsLaunch=false;this.start();
  }
  stop(code=0) {
    if(this.stopping)return;
    this.stopping=true;clearTimeout(this.debounce);clearTimeout(this.assetRefreshTimer);this.pending.clear();this.stopServer(code);
    if(this.child){
      this.send('slingsip:quit');
      // Only our owned child is terminated if graceful shutdown cannot finish.
      this.forceStopTimer=setTimeout(()=>this.child?.kill(),5000);
    }
  }
}
