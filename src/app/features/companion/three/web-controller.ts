import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial } from 'three';
import type { Point } from '../animation/swing-motion';

export class WebController {
  readonly root=new Group();
  private readonly segments=256;
  private readonly lines=Array.from({length:3},()=>new Line(new BufferGeometry().setAttribute('position',new Float32BufferAttribute(new Float32Array(6),3)),new LineBasicMaterial({color:0xc7dce8,transparent:true,opacity:1,depthTest:false})));
  private readonly braids=this.lines.map(()=>{
    const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(new Float32Array((this.segments+1)*12),3));
    const indices:number[]=[];
    for(let i=0;i<this.segments;i++)for(let strand=0;strand<2;strand++){const p=i*4+strand*2;indices.push(p,p+4,p+1,p+1,p+4,p+5);}
    geometry.setIndex(indices);geometry.setDrawRange(0,0);
    const mesh=new Mesh(geometry,new MeshBasicMaterial({color:0xf6fcff,transparent:true,depthTest:false,depthWrite:false,side:DoubleSide}));
    mesh.name='BraidedWebDetail';mesh.frustumCulled=false;return mesh;
  });
  private readonly endpoints:(string|undefined)[]=[];
  constructor(){this.root.name='CompanionWebs';this.root.add(...this.lines);this.lines.forEach((line,i)=>{line.frustumCulled=false;line.add(this.braids[i]);});}
  set(index:number,a:Point,b:Point,opacity:number):void{
    const line=this.lines[index],position=line.geometry.getAttribute('position');position.setXYZ(0,a.x,-a.y,1);position.setXYZ(1,b.x,-b.y,1);position.needsUpdate=true;
    line.visible=opacity>0;line.material.opacity=opacity;
    const braid=this.braids[index];braid.material.opacity=opacity;
    if(opacity<=0)return;
    const key=[a.x,a.y,b.x,b.y].join(',');if(this.endpoints[index]===key)return;this.endpoints[index]=key;
    const dx=b.x-a.x,dy=a.y-b.y,length=Math.hypot(dx,dy),count=Math.min(this.segments,Math.max(1,Math.ceil(length/5)));
    const nx=length?-dy/length:0,ny=length?dx/length:0,vertices=braid.geometry.getAttribute('position');
    // Two thin interwoven ribbons share the socket endpoints. Reuse their buffers;
    // they follow the existing web sample and have no separate clock or hit area.
    for(let i=0;i<=count;i++){
      const t=i/count,envelope=Math.sin(Math.PI*t),twist=Math.sin(t*length*Math.PI*2/18)*.68*envelope;
      for(let strand=0;strand<2;strand++)for(let edge=0;edge<2;edge++){
        const offset=(strand?-twist:twist)+(edge?.30:-.30)*envelope;
        vertices.setXYZ(i*4+strand*2+edge,a.x+dx*t+nx*offset,-a.y+dy*t+ny*offset,1.01);
      }
    }
    vertices.needsUpdate=true;braid.geometry.setDrawRange(0,count*12);
  }
  dispose():void{this.lines.forEach(line=>{line.geometry.dispose();line.material.dispose();});this.braids.forEach(mesh=>{mesh.geometry.dispose();mesh.material.dispose();});this.root.removeFromParent();}
}
