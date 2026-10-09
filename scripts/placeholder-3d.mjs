// Original development model. Final production artwork belongs in a separate pack.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const unit=.01;
const point=(x,y,z=0)=>new T.Vector3((x-125)*unit,(22-y)*unit,z*unit);
const colours={navy:0x152338,coral:0xee344e,mint:0x86f4d3,cyan:0x08d7ec,dark:0x080f1b,white:0xf0fffc};
const material=(colour,extra={})=>new T.MeshStandardMaterial({color:colour,roughness:.65,metalness:.12,...extra});
function morph(geometry,name,transform){
  const src=geometry.getAttribute('position'),array=Float32Array.from(src.array);
  for(let i=0;i<src.count;i++){const p=transform(new T.Vector3(src.getX(i),src.getY(i),src.getZ(i)));array.set([p.x,p.y,p.z],i*3);}
  geometry.morphAttributes.position??=[];geometry.morphAttributes.position.push(new T.Float32BufferAttribute(array,3));
  return name;
}
export function placeholderCharacter(){
  const root=new T.Group();root.name='SlingSip_Guardian_Placeholder';root.userData={temporary:true,author:'SlingSip development placeholder',height:2.2};
  const specs=[['RigRoot',null,125,22],['Hand_R','RigRoot',125,22],['Forearm_R','RigRoot',119,60],['Shoulder_R','RigRoot',98,91],['Chest','RigRoot',77,95],['Hips','Chest',79,151],['Thigh_L','Hips',67,151],['Shin_L','Thigh_L',57,179],['Foot_L','Shin_L',54,204],['Thigh_R','Hips',86,151],['Shin_R','Thigh_R',104,173],['Foot_R','Shin_R',103,201],['UpperArm_L','Chest',58,91],['Forearm_L','UpperArm_L',44,108],['Hand_L','Forearm_L',30,125],['Head','Chest',80,56],['Scarf','Chest',75,96]];
  const bones=[],byName={},world={};
  for(const [name,parent,x,y]of specs){const b=new T.Bone();b.name=name;world[name]=point(x,y);b.position.copy(world[name]).sub(parent?world[parent]:new T.Vector3());byName[name]=b;bones.push(b);if(parent)byName[parent].add(b);else root.add(b);}
  const gripSocket=new T.Object3D();gripSocket.name='WebGrip';gripSocket.position.z=.06;byName.Hand_R.add(gripSocket);
  const bottleSocket=new T.Object3D();bottleSocket.name='BottleGrip';bottleSocket.position.set(-.02,-.06,.08);byName.Hand_L.add(bottleSocket);
  const skeleton=new T.Skeleton(bones),parts=[],materials=[material(colours.navy),material(colours.coral),material(colours.mint),material(colours.dark),material(colours.cyan)];
  function skin(geometry,bone,mat){
    const count=geometry.getAttribute('position').count,index=bones.indexOf(byName[bone]);
    const indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
    for(let i=0;i<count;i++){indices[i*4]=index;weights[i*4]=1;}
    geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));parts.push({geometry,mat});
  }
  function sphere(at,size,bone,mat){const g=new T.SphereGeometry(1,12,8);g.scale(...size.map(n=>n*unit));g.translate(...point(...at).toArray());skin(g,bone,mat);}
  function limb(a,b,r,bone,mat){const av=point(...a),bv=point(...b),length=av.distanceTo(bv);const g=new T.CapsuleGeometry(r*unit,Math.max(.01,length-r*unit*2),3,8);const matrix=new T.Matrix4().compose(av.clone().add(bv).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),bv.clone().sub(av).normalize()),new T.Vector3(1,1,1));g.applyMatrix4(matrix);skin(g,bone,mat);}
  sphere([78,121,0],[24,34,14],'Chest',0);sphere([79,151,0],[22,12,13],'Hips',0);
  for(const [a,b,r,bone]of [[[67,151,0],[57,179,0],10,'Thigh_L'],[[57,179,0],[54,204,1],8,'Shin_L'],[[86,151,-1],[104,173,-2],9,'Thigh_R'],[[104,173,-2],[103,201,0],8,'Shin_R'],[[58,91,0],[44,108,2],8,'UpperArm_L'],[[44,108,2],[30,125,4],6,'Forearm_L'],[[98,91,0],[119,60,0],8,'Shoulder_R'],[[119,60,0],[125,22,0],6,'Forearm_R']])limb(a,b,r,bone,0);
  sphere([54,205,4],[11,8,15],'Foot_L',1);sphere([103,202,3],[10,8,14],'Foot_R',1);
  sphere([30,125,4],[7,8,7],'Hand_L',1);sphere([125,22,0],[7,8,7],'Hand_R',1);
  // Separate fingers give the shooting/presenting hand a readable silhouette.
  for(let i=0;i<3;i++)limb([27+i*3,127,8],[25+i*4,134,8],1.4,'Hand_L',2);
  limb([56,151,12],[98,151,12],3,'Hips',1);limb([56,110,10],[53,136,10],1.5,'Chest',2);limb([97,111,10],[102,132,10],1.5,'Chest',4);
  const emblem=new T.Shape();emblem.moveTo(0,.09);emblem.bezierCurveTo(-.07,0,-.085,-.1,0,-.1);emblem.bezierCurveTo(.085,-.1,.07,0,0,.09);
  const eg=new T.ExtrudeGeometry(emblem,{depth:.018,bevelEnabled:false,curveSegments:8});eg.translate(...point(78,121,15).toArray());skin(eg,'Chest',2);
  const scarf=new T.Shape();scarf.moveTo(0,0);scarf.lineTo(-.68,.16);scarf.lineTo(-.51,-.07);scarf.lineTo(-.67,-.15);scarf.lineTo(0,-.1);const sg=new T.ExtrudeGeometry(scarf,{depth:.025,bevelEnabled:false});sg.translate(...point(75,96,-3).toArray());skin(sg,'Scarf',1);
  // Batch body primitives by material to avoid a draw call for every limb segment.
  const batches=[...new Set(parts.map(p=>p.mat))].map(mat=>({mat,geometry:mergeGeometries(parts.filter(p=>p.mat===mat).map(p=>p.geometry.index?p.geometry.toNonIndexed():p.geometry))}));
  const merged=mergeGeometries(batches.map(p=>p.geometry),true);merged.groups.forEach((g,i)=>g.materialIndex=batches[i].mat);
  const body=new T.SkinnedMesh(merged,materials);body.name='GuardianBody';root.add(body);root.updateMatrixWorld(true);body.bind(skeleton);
  const head=byName.Head;
  // Reference-guided development hood; this is deliberately separate from final art.
  const hood=new T.Mesh(new T.SphereGeometry(1,24,16),material(colours.navy,{roughness:.48}));hood.scale.set(.385,.425,.31);hood.position.z=-.05;hood.name='TemporaryHood';head.add(hood);
  const helmet=new T.Mesh(new T.SphereGeometry(1,24,16),material(colours.dark,{roughness:.38}));helmet.scale.set(.315,.335,.25);helmet.position.z=.09;helmet.name='GuardianFace';head.add(helmet);
  const band=new T.Mesh(new T.TorusGeometry(.30,.025,8,32),material(colours.coral));band.scale.y=1.12;band.position.z=.205;band.name='TemporaryHoodTrim';head.add(band);
  const almond=new T.Shape();almond.moveTo(-.115,.01);almond.bezierCurveTo(-.06,.12,.02,.095,.11,-.015);almond.bezierCurveTo(.05,-.095,-.05,-.10,-.115,.01);
  for(const [name,x]of [['Eye_L',-.12],['Eye_R',.12]]){
    const geometry=new T.ExtrudeGeometry(almond,{depth:.008,bevelEnabled:false,curveSegments:10});morph(geometry,'blink',p=>p.setY(p.y*.05));
    const eye=new T.Mesh(geometry,material(colours.white,{roughness:.3,emissive:colours.cyan,emissiveIntensity:.15}));eye.name=name;eye.position.set(x,.04,.33);eye.rotation.z=x<0?.17:-.17;eye.morphTargetDictionary={blink:0};head.add(eye);
    const rim=new T.Mesh(geometry.clone(),material(colours.cyan,{emissive:colours.cyan,emissiveIntensity:.4}));rim.name=name+'_Rim';rim.scale.set(1.10,1.12,1);rim.position.copy(eye.position);rim.position.z-=.01;rim.rotation.copy(eye.rotation);rim.morphTargetDictionary={blink:0};head.add(rim);
    const pupil=new T.Mesh(new T.SphereGeometry(.021,8,6),material(colours.dark));pupil.name=name+'_Pupil';pupil.position.set(x,.035,.352);pupil.userData={temporaryExpressionVisibility:['happy','curious','excited']};head.add(pupil);
  }
  const mouthGeometry=new T.PlaneGeometry(.14,.025,12,1);morph(mouthGeometry,'smile',p=>p.setY(p.y+(p.x/.07)**2*.045));morph(mouthGeometry,'frown',p=>p.setY(p.y-(p.x/.07)**2*.035));
  const mouth=new T.Mesh(mouthGeometry,material(colours.white,{side:T.DoubleSide}));mouth.name='Mouth';mouth.position.set(0,-.16,.32);mouth.morphTargetDictionary={smile:0,frown:1};head.add(mouth);
  const groups={
    'swing-grab':[0,.35,.55],'swing-down':[.55,.85,1],'swing-bottom':[1,1.2,1], 'swing-up':[1,.65,.3],release:[.3,.65,.9], 'mid-air':[.9,1.2,.9],attach:[.9,.7,.55],settle:[.3,-.15,.12,0],idle:[0,.035,0,-.035,0],success:[0,.35,.55,.35], 'web-shot':[.35,.2,.2], 'bottle-hold':[.2,.1,.15,.1],retract:[.1,.35,.55],hanging:[0,.035,0,-.035,0],asking:[0,.2,.15,0],waiting:[0,.08,.04,0],disappointed:[0,-.1,-.15,0],'exit-swing':[.55,1,1.1,.4],
  };
  const clips=[];
  for(const [name,energies]of Object.entries(groups)){
    const duration=name==='idle'||name==='hanging'?4.2:name==='success'?.45:name==='settle'?.42:1;
    const times=energies.map((_,i)=>i*duration/(energies.length-1)),tracks=[];
    const rotationTrack=(bone,axis,fn)=>{const values=energies.flatMap((e,i)=>{const angle=fn(e,i),v=new T.Vector3(...axis);return new T.Quaternion().setFromAxisAngle(v,angle).toArray();});tracks.push(new T.QuaternionKeyframeTrack(bone+'.quaternion',times,values));};
    rotationTrack('Thigh_L',[1,0,0],e=>e*.85);rotationTrack('Shin_L',[1,0,0],e=>-e*1.05);rotationTrack('Thigh_R',[1,0,0],e=>-e*.5);rotationTrack('Shin_R',[1,0,0],e=>e*.85);
    rotationTrack('UpperArm_L',[0,0,1],e=>name==='web-shot'||name==='bottle-hold'?-.65:-e*.8);rotationTrack('Forearm_L',[0,0,1],e=>name==='web-shot'||name==='bottle-hold'?-.2:-e*.25);
    rotationTrack('Head',[0,0,1],e=>(name==='waiting'||name==='disappointed'?-.12:e*.10));rotationTrack('Scarf',[0,1,0],e=>e*.7);
    const releaseAngle=t=>name==='release'?.7*t:name==='mid-air'?.7+.4*Math.sin(Math.PI*t):name==='attach'?.7*(1-t):0;
    rotationTrack('Forearm_R',[0,0,1],(_,i)=>releaseAngle(i/(energies.length-1)));
    tracks.push(new T.VectorKeyframeTrack('Hand_R.position',times,energies.flatMap((_,i)=>{
      const angle=releaseAngle(i/(energies.length-1)),elbow=world.Forearm_R,reach=world.Hand_R.clone().sub(elbow).applyAxisAngle(new T.Vector3(0,0,1),angle);
      return elbow.clone().add(reach).toArray();
    })));
    tracks.push(new T.VectorKeyframeTrack('Chest.position',times,energies.flatMap(e=>byName.Chest.position.clone().add(new T.Vector3(e*.025,e*.015,0)).toArray())));
    clips.push(new T.AnimationClip(name,duration,tracks));
  }
  root.animations=clips;return {root,clips,skeleton,triangles:merged.getAttribute('position').count/3};
}
export function placeholderBottle(){
  const root=new T.Group();root.name='SlingSip_Bottle_Placeholder';root.userData={temporary:true,topAnchor:[0,0,0]};
  const glass=material(0x16cde8,{transparent:true,opacity:.24,roughness:.22,metalness:.15,depthWrite:false});
  const body=new T.Mesh(new T.CylinderGeometry(.22,.22,.72,24),glass);body.position.y=-.57;root.add(body);
  const water=new T.Mesh(new T.CylinderGeometry(.196,.196,.43,24),material(0x00b9df,{transparent:true,opacity:.42,emissive:0x007d99,emissiveIntensity:.55,depthWrite:false}));water.position.y=-.70;root.add(water);
  const shoulder=new T.Mesh(new T.SphereGeometry(.22,24,12),glass);shoulder.position.y=-.23;shoulder.scale.y=.55;root.add(shoulder);
  const cap=new T.Mesh(new T.CylinderGeometry(.19,.19,.12,24),material(0x163447,{roughness:.35,metalness:.4}));cap.position.y=-.095;root.add(cap);
  const glow=new T.MeshBasicMaterial({color:0x76f6ff});
  for(const y of [-.17,-.24,-.925]){const ring=new T.Mesh(new T.TorusGeometry(y===-.17?.18:.212,.008,6,32),glow);ring.rotation.x=Math.PI/2;ring.position.y=y;root.add(ring);}
  const handle=new T.Mesh(new T.TorusGeometry(.085,.018,6,20),material(colours.cyan,{emissive:colours.cyan,emissiveIntensity:.5}));handle.position.set(0,-.02,0);handle.scale.x=1.25;root.add(handle);
  for(const x of [-.19,.19]){const highlight=new T.Mesh(new T.CylinderGeometry(.005,.005,.66,6),glow);highlight.position.set(x,-.58,.09);root.add(highlight);}
  const label=new T.Mesh(new T.PlaneGeometry(.36,.48),material(0xffffff,{transparent:true,depthWrite:false,emissive:0xffffff,emissiveIntensity:.2}));label.name='BottleLabel';label.position.set(0,-.58,.224);root.add(label);
  return root;
}
