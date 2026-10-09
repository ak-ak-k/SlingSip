import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {placeholderCharacter,placeholderBottle} from './placeholder-3d.mjs';
// Node export support; models have no external images or third-party art.
globalThis.FileReader=class{async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.();}async readAsDataURL(blob){this.result='data:'+blob.type+';base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64');this.onloadend?.();}};
const dir='public/assets/character/temporary-3d';await mkdir(dir,{recursive:true});
const exporter=new GLTFExporter(),character=placeholderCharacter();
const model=await exporter.parseAsync(character.root,{binary:true,animations:character.clips});
const bottle=await exporter.parseAsync(placeholderBottle(),{binary:true});
await writeFile(dir+'/guardian.glb',Buffer.from(model));await writeFile(dir+'/bottle.glb',Buffer.from(bottle));
console.log(JSON.stringify({characterBytes:model.byteLength,bottleBytes:bottle.byteLength,bones:character.skeleton.bones.length,bodyTriangles:character.triangles,clips:character.clips.map(c=>c.name)}));
