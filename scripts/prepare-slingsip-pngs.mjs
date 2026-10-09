import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {SLINGSIP_ASSET_ENTRIES,SLINGSIP_SOURCE_POINTS} from '../src/app/features/companion/animation/slingsip-assets.ts';
import {decodePng} from './lib/png-rgba.mjs';

function simplify(points,epsilon=.7){
  if(points.length<3)return points;const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;let maximum=0,selected=0;
  for(let i=1;i<points.length-1;i++){const p=points[i],t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0,d=Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);if(d>maximum){maximum=d;selected=i;}}
  return maximum>epsilon?[...simplify(points.slice(0,selected+1),epsilon).slice(0,-1),...simplify(points.slice(selected),epsilon)]:[a,b];
}
function contours(mask,w,h){
  const edges=new Map(),put=(a,b,d)=>{const key=a.join(',');const list=edges.get(key)??[];list.push({a,b,d});edges.set(key,list);};
  const on=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(on(x,y)){
    if(!on(x,y-1))put([x,y],[x+1,y],0);if(!on(x+1,y))put([x+1,y],[x+1,y+1],1);
    if(!on(x,y+1))put([x+1,y+1],[x,y+1],2);if(!on(x-1,y))put([x,y+1],[x,y],3);
  }
  const paths=[];while(edges.size){let edge=edges.values().next().value[0];const start=edge.a,points=[start];let guard=0;
    while(edge&&guard++<w*h*4){const key=edge.a.join(','),list=edges.get(key);list.splice(list.indexOf(edge),1);if(!list.length)edges.delete(key);points.push(edge.b);
      if(edge.b[0]===start[0]&&edge.b[1]===start[1])break;
      const next=edges.get(edge.b.join(','));if(!next)break;const priorities=[1,0,3,2];edge=next.reduce((best,item)=>priorities.indexOf((item.d-edge.d+4)%4)<priorities.indexOf((best.d-edge.d+4)%4)?item:best);
    }
    if(points.length>4)paths.push(simplify(points));
  }return paths;
}
const svgPath=(paths,transform=p=>p)=>paths.map(path=>path.map((p,i)=>{const [x,y]=transform(p);return(i?'L':'M')+Number(x.toFixed(2))+','+Number(y.toFixed(2));}).join('')+'Z').join('');
export async function prepareSlingSipPngs(){
  const result={};
  for(const [key,src] of Object.entries(SLINGSIP_ASSET_ENTRIES)){
    const bytes=await readFile('public/'+src),{width:w,height:h,rgba}=decodePng(bytes),points=SLINGSIP_SOURCE_POINTS[key];
    const zeros=Array.from({length:w*h},(_,i)=>rgba[i*4+3]===0).filter(Boolean).length,hasAlpha=zeros>w*h*.15;
    let bottom=h;
    for(let y=h-1;y>h*.5;y--){let opaque=0,dark=0;for(let x=0;x<w;x++){const p=(y*w+x)*4;if(rgba[p+3]>180){opaque++;if(Math.max(...rgba.subarray(p,p+3))<100)dark++;}}if(opaque/w>.9&&dark/w>.35)bottom=y;else break;}
    const crop=points.crop??[hasAlpha?0:8,0,hasAlpha?w:w-13,bottom<h?bottom-2:h],[cx,cy,cw,ch]=crop;
    const mask=new Uint8Array(w*h),background=new Uint8Array(w*h),queue=[];
    const within=(x,y)=>x>=cx&&y>=cy&&x<cx+cw&&y<cy+ch;
    // These sheet crops mix real alpha with opaque gray checker/border islands.
    // Flood only exterior gray pixels: enclosed white eyes/highlights survive.
    const backdrop=(index)=>{const p=index*4,r=rgba[p],g=rgba[p+1],b=rgba[p+2];return rgba[p+3]<16||(Math.max(r,g,b)-Math.min(r,g,b)<45&&Math.min(r,g,b)>70);};
    const enqueue=(x,y)=>{if(!within(x,y))return;const index=y*w+x;if(background[index]||!backdrop(index))return;background[index]=1;queue.push(index);};
    for(let x=cx;x<cx+cw;x++){enqueue(x,cy);enqueue(x,cy+ch-1);}for(let y=cy;y<cy+ch;y++){enqueue(cx,y);enqueue(cx+cw-1,y);}
    for(let i=0;i<queue.length;i++){const p=queue[i],x=p%w,y=Math.floor(p/w);enqueue(x-1,y);enqueue(x+1,y);enqueue(x,y-1);enqueue(x,y+1);}
    for(let y=cy;y<cy+ch;y++)for(let x=cx;x<cx+cw;x++){const p=y*w+x;mask[p]=!background[p]&&rgba[p*4+3]>16?1:0;}
    // Drop disconnected sheet-border fragments; preserve separate scarf/finger pieces.
    const visited=new Uint8Array(w*h);for(let p=0;p<mask.length;p++)if(mask[p]&&!visited[p]){const component=[p];visited[p]=1;for(let i=0;i<component.length;i++){const n=component[i],x=n%w,y=Math.floor(n/w);for(const [nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(within(nx,ny)){const j=ny*w+nx;if(mask[j]&&!visited[j]){visited[j]=1;component.push(j);}}}
      const xs=component.map(n=>n%w),ys=component.map(n=>Math.floor(n/w)),width=Math.max(...xs)-Math.min(...xs)+1,height=Math.max(...ys)-Math.min(...ys)+1;
      if(component.length<24||(width<12&&height>ch*.6))component.forEach(p=>mask[p]=0);
    }
    let x0=w,y0=h,x1=0,y1=0,count=0;for(let i=0;i<mask.length;i++)if(mask[i]){const x=i%w,y=Math.floor(i/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);count++;}
    if(count<100)throw new Error('No usable silhouette for '+src);
    const bw=x1-x0+1,bh=y1-y0+1,target=key==='disappointed'?{x:19,y:8,w:122,h:106}:key==='bottle'?{x:0,y:0,w:bw,h:bh}:{x:5,y:8,w:150,h:186};
    const opaquePoint=p=>{let best=p,distance=Infinity;for(let i=0;i<mask.length;i++)if(mask[i]&&rgba[i*4+3]>180){const x=i%w,y=Math.floor(i/w),d=(x-p[0])**2+(y-p[1])**2;if(d<distance){distance=d;best=[x,y];}}return best;};
    const resolved=Object.fromEntries(Object.entries(points).filter(([name])=>name!=='crop').map(([name,p])=>[name,opaquePoint(p)]));
    const scale=Math.min(target.w/bw,target.h/bh);let tx=target.x+(target.w-bw*scale)/2-x0*scale,ty=target.y+(target.h-bh*scale)/2-y0*scale;
    // Keep each pose's socket on the same code-owned grip, rather than making
    // character travel jump when different-sized/cropped frames are selected.
    tx+=(key==='bottle'?bw/2:125)-(resolved.grip[0]*scale+tx);ty+=(key==='bottle'?0:22)-(resolved.grip[1]*scale+ty);
    const map=p=>[p[0]*scale+tx,p[1]*scale+ty],paths=contours(mask,w,h),socket=p=>{const [x,y]=map(p);return{x,y};};
    result[key]={width:w,height:h,hasAuthoredAlpha:hasAlpha,sourceSha256:createHash('sha256').update(bytes).digest('hex'),crop,bounds:{x:x0,y:y0,width:bw,height:bh},
      transform:{scale,x:tx,y:ty},clipPath:svgPath(paths),hitPath:svgPath(paths,map),anchors:{grip:socket(resolved.grip),freeHand:socket(resolved.hand),head:socket(resolved.head),hit:socket(resolved.hit)},foregroundPixels:count};
  }
  const filename='src/app/features/companion/animation/slingsip-sprite-geometry.ts',body='// Generated vector clipping/geometry; original PNG files are never changed.\nexport const SLINGSIP_SPRITE_GEOMETRY = '+JSON.stringify(result,null,2)+';\n';
  let previous;try{previous=await readFile(filename,'utf8');}catch{}
  if(previous!==body)await writeFile(filename,body);
  await mkdir('docs',{recursive:true});await writeFile('docs/slingsip-png-source-audit.json',JSON.stringify(Object.fromEntries(Object.entries(result).map(([key,value])=>[key,{...value,clipPath:undefined,hitPath:undefined}])),null,2)+'\n');
  return Object.entries(result).map(([key,value])=>({key,width:value.width,height:value.height,hasAuthoredAlpha:value.hasAuthoredAlpha,bounds:value.bounds,foregroundPixels:value.foregroundPixels}));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])console.log(JSON.stringify(await prepareSlingSipPngs()));
