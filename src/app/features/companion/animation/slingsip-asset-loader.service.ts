import { Injectable, isDevMode, signal } from '@angular/core';
import { SLINGSIP_ASSET_ENTRIES, type SlingSipAssetKey } from './slingsip-assets';
import { SLINGSIP_SPRITE_GEOMETRY } from './slingsip-sprite-geometry';

/** One decoded cache shared by the hero, companion and isolated Animation lab. */
@Injectable({providedIn:'root'})
export class SlingSipAssetLoader {
  readonly status=signal<'loading'|'ready'|'failed'>('loading');
  readonly failures=signal<string[]>([]);
  readonly failedKeys=signal<ReadonlySet<SlingSipAssetKey>>(new Set());
  private readonly images:HTMLImageElement[]=[];
  private loading?:Promise<void>;
  load():Promise<void>{
    return this.loading??=Promise.all(Object.entries(SLINGSIP_ASSET_ENTRIES).map(async([name,src])=>{
      const image=new Image();this.images.push(image);image.src=src;
      try{
        await image.decode();const geometry=SLINGSIP_SPRITE_GEOMETRY[name as SlingSipAssetKey];
        if(image.naturalWidth!==geometry.width||image.naturalHeight!==geometry.height)throw new Error('Dimensions changed; regenerate sprite geometry with the asset preparation script.');
      }catch(error){this.fail(name as SlingSipAssetKey,src+(error instanceof Error?': '+error.message:''));}
    })).then(()=>{if(this.status()!=='failed')this.status.set('ready');});
  }
  fail(key:SlingSipAssetKey,source='SlingSip PNG unavailable.'):void{
    this.failedKeys.update(keys=>new Set([...keys,key]));
    if(!this.failures().includes(source)){
      this.failures.update(list=>[...list,source]);
      if(isDevMode())console.warn('[SlingSip assets] '+SLINGSIP_ASSET_ENTRIES[key]+': '+source);
    }
    this.status.set('failed');
  }
  /** Never substitute another character. Head strips and props cannot be body fallbacks. */
  select(key:SlingSipAssetKey):SlingSipAssetKey|null{
    const failed=this.failedKeys();
    if(!failed.has(key))return key;
    if(key==='bottle'||key==='disappointed')return null;
    return (['idle','ask','happy','swing5','swing4','swing3','swing2','swing1','upsideDown'] as const).find(candidate=>!failed.has(candidate))??null;
  }
}
