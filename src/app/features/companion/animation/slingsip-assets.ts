/** Relative URLs work under both Angular's server and Electron's file:// build. */
export const SLINGSIP_ASSETS = Object.freeze({
  idle: 'assets/companion/slingsip/poses/idle.png',
  ask: 'assets/companion/slingsip/poses/ask.png',
  happy: 'assets/companion/slingsip/poses/happy.png',
  disappointed: 'assets/companion/slingsip/poses/disappointed.png',
  upsideDown: 'assets/companion/slingsip/poses/upside-down.png',
  swingFrames: Object.freeze([
    'assets/companion/slingsip/swing/swing-1.png',
    'assets/companion/slingsip/swing/swing-2.png',
    'assets/companion/slingsip/swing/swing-3.png',
    'assets/companion/slingsip/swing/swing-4.png',
    'assets/companion/slingsip/swing/swing-5.png',
  ]),
  bottle: 'assets/companion/slingsip/props/bottle.png',
});

export type SlingSipAssetKey = 'idle'|'ask'|'happy'|'disappointed'|'upsideDown'|'swing1'|'swing2'|'swing3'|'swing4'|'swing5'|'bottle';
export const SLINGSIP_ASSET_ENTRIES: Readonly<Record<SlingSipAssetKey,string>> = {
  idle:SLINGSIP_ASSETS.idle,ask:SLINGSIP_ASSETS.ask,happy:SLINGSIP_ASSETS.happy,
  disappointed:SLINGSIP_ASSETS.disappointed,upsideDown:SLINGSIP_ASSETS.upsideDown,
  swing1:SLINGSIP_ASSETS.swingFrames[0],swing2:SLINGSIP_ASSETS.swingFrames[1],swing3:SLINGSIP_ASSETS.swingFrames[2],
  swing4:SLINGSIP_ASSETS.swingFrames[3],swing5:SLINGSIP_ASSETS.swingFrames[4],bottle:SLINGSIP_ASSETS.bottle,
};

/** Measured sockets in the supplied PNGs. No paths live in the renderer. */
export const SLINGSIP_SOURCE_POINTS: Readonly<Record<SlingSipAssetKey,{grip:[number,number];webHand?:[number,number];hand:[number,number];head:[number,number];hit:[number,number];crop?:[number,number,number,number]}>> = {
  idle:{grip:[86,3],webHand:[34,175],hand:[34,175],head:[86,63],hit:[86,145]},
  ask:{grip:[99,3],webHand:[45,125],hand:[45,125],head:[112,61],hit:[111,146],crop:[10,0,170,230]},
  happy:{grip:[99,3],webHand:[174,74],hand:[25,99],head:[98,62],hit:[93,142],crop:[12,0,168,230]},
  disappointed:{grip:[168,3],hand:[168,115],head:[169,60],hit:[169,67],crop:[98,0,145,123]},
  upsideDown:{grip:[85,5],hand:[122,81],head:[86,164],hit:[86,70]},
  swing1:{grip:[80,7],hand:[51,86],head:[74,69],hit:[53,104],crop:[0,0,139,146]},
  swing2:{grip:[118,5],hand:[41,90],head:[81,67],hit:[57,102],crop:[0,0,125,146]},
  swing3:{grip:[143,6],hand:[22,102],head:[100,69],hit:[76,106]},
  swing4:{grip:[102,23],hand:[20,94],head:[113,77],hit:[78,116]},
  swing5:{grip:[130,12],hand:[53,108],head:[102,72],hit:[84,113]},
  bottle:{grip:[52,6],hand:[52,6],head:[52,6],hit:[52,85],crop:[10,0,85,171]},
};
