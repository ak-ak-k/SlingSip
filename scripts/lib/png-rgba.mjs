import {inflateSync} from 'node:zlib';

/** Offline inspection only. Does not modify or re-encode the supplied artwork. */
export function decodePng(bytes){
  if(bytes.toString('hex',0,8)!=='89504e470d0a1a0a')throw new Error('Not a PNG');
  let width,height,colour,depth,interlaced;const chunks=[];
  for(let p=8;p<bytes.length;){const length=bytes.readUInt32BE(p),type=bytes.toString('ascii',p+4,p+8),chunk=bytes.subarray(p+8,p+8+length);
    if(type==='IHDR'){width=chunk.readUInt32BE(0);height=chunk.readUInt32BE(4);depth=chunk[8];colour=chunk[9];interlaced=chunk[12];}
    if(type==='IDAT')chunks.push(chunk);p+=12+length;
  }
  if(depth!==8||![2,6].includes(colour)||interlaced)throw new Error('Expected non-interlaced 8-bit RGB/RGBA PNG');
  const channels=colour===6?4:3,stride=width*channels,raw=inflateSync(Buffer.concat(chunks)),scan=Buffer.alloc(stride*height);let offset=0;
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){const filter=raw[offset++];if(filter>4)throw new Error('Invalid PNG filter');for(let x=0;x<stride;x++){
    const index=y*stride+x,a=x>=channels?scan[index-channels]:0,b=y?scan[index-stride]:0,c=y&&x>=channels?scan[index-stride-channels]:0;
    scan[index]=(raw[offset++]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;
  }}
  const rgba=new Uint8Array(width*height*4);for(let p=0;p<width*height;p++){rgba[p*4]=scan[p*channels];rgba[p*4+1]=scan[p*channels+1];rgba[p*4+2]=scan[p*channels+2];rgba[p*4+3]=channels===4?scan[p*channels+3]:255;}
  return{width,height,rgba};
}
