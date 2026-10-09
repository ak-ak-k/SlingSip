import {readFile,writeFile,mkdir} from 'node:fs/promises';

const paths=['src/assets/3d/character/slingsip-character.glb','src/assets/3d/props/slingsip-bottle.glb'];
const assets=[];
for(const path of paths){
  try{
    const bytes=await readFile(path);
    if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Invalid glTF 2.0 binary header');
    const length=bytes.readUInt32LE(12);if(bytes.readUInt32LE(16)!==0x4e4f534a)throw new Error('Missing GLB JSON chunk');
    const gltf=JSON.parse(bytes.toString('utf8',20,20+length));
    assets.push({path,status:'present',bytes:bytes.length,generator:gltf.asset?.generator,
      clips:(gltf.animations??[]).map(clip=>({name:clip.name,channels:(clip.channels??[]).map(channel=>({node:gltf.nodes?.[channel.target.node]?.name,path:channel.target.path}))})),
      nodes:(gltf.nodes??[]).map(node=>({name:node.name,skin:node.skin,mesh:node.mesh,children:node.children})),
      skins:(gltf.skins??[]).map(skin=>({name:skin.name,joints:skin.joints?.length})),
      morphs:(gltf.meshes??[]).filter(mesh=>mesh.primitives?.some(primitive=>primitive.targets?.length)).map(mesh=>({mesh:mesh.name,names:mesh.extras?.targetNames??[],targetCounts:mesh.primitives.map(primitive=>primitive.targets?.length??0)})),
      extensions:gltf.extensionsUsed??[],externalResources:[...(gltf.buffers??[]),...(gltf.images??[])].map(resource=>resource.uri).filter(uri=>uri&&!uri.startsWith('data:')),
    });
  }catch(error){assets.push({path,status:error.code==='ENOENT'?'missing':'incompatible',error:error.message});}
}
const report={assets,finalCompatibilityVerified:false,note:'Inventory only; run native GLTFLoader validation after providing actual GLBs. Existing development placeholders are not final assets.'};
if(process.argv[2]){await mkdir('docs',{recursive:true});await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
