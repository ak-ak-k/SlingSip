import { Injectable } from '@angular/core';

/** Rendering-only hit test; native ownership continues through the existing IPC. */
@Injectable()
export class CompanionVisualHitTestService {
  private test?: (x:number,y:number)=>boolean;
  register(test:(x:number,y:number)=>boolean):()=>void{this.test=test;return()=>{if(this.test===test)this.test=undefined;};}
  hit(x:number,y:number):boolean{return this.test?.(x,y)??false;}
}
