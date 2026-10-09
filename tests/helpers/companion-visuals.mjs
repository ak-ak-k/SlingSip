import {expect}from'@playwright/test';

// Exercise an unavailable approved pose through the real load-error handler.
export async function useApprovedFallback(page){
  await page.getByTestId('slingsip-asset-probe').dispatchEvent('error');
  await expect(page.getByTestId('character')).toHaveAttribute('data-assets','failed');
  await expect(page.locator('canvas, app-body-sprite-renderer')).toHaveCount(0);
}

export async function failBodyArtwork(page){
  // There are nine full-body PNGs. Disappointed is a separate face, bottle a prop.
  for(let i=0;i<9;i++){
    const image=page.locator('.current-pose .pose-image'),key=await image.getAttribute('data-asset-key');
    await image.dispatchEvent('error');
    if(i<8)await expect(image).not.toHaveAttribute('data-asset-key',key);
  }
  await expect(page.getByTestId('character')).toHaveAttribute('data-renderer','brand-mark');
  await expect(page.locator('.current-pose .brand-fallback')).toBeVisible();
}

export async function ambientPose(page){return page.locator('.mascot').evaluate(node=>getComputedStyle(node).transform);}
export async function connectionDistance(page,kind){return page.evaluate(kind=>{

  const svg=document.querySelector('.mascot'),p=svg.createSVGPoint();p.x=kind==='grip'?Number(svg.dataset.webGripX??125):Number(svg.dataset.handX);p.y=kind==='grip'?Number(svg.dataset.webGripY??22):Number(svg.dataset.handY);
  const hand=p.matrixTransform(svg.querySelector('.png-look')?.getScreenCTM()??svg.getScreenCTM()),web=document.querySelector(kind==='grip'?'.swing-web':'.bottle-web');
  const endpoint=web.getPointAtLength(kind==='grip'?web.getTotalLength():0);
  const point=svg.createSVGPoint();point.x=endpoint.x;point.y=endpoint.y;
  const actual=point.matrixTransform(web.getScreenCTM());
  return Math.hypot(hand.x-actual.x,hand.y-actual.y);
},kind);}
export async function expectBottleVisible(page){await expect(page.getByTestId('companion-bottle')).toBeVisible();}
export async function expectWebVisible(page){await expect(page.getByTestId('swing-web')).toBeVisible();}
