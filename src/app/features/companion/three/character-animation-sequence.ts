import { CharacterState } from '../animation/character.model';
import type { BodyCue } from '../animation/body-animation.model';
import type { CharacterAnimationRole } from './character-animation-controller';
import type { FacialExpression } from './character-facial-controller';

/** Visual sequences resample the existing phases; they never create business timers. */
export function characterAnimationSequence(state:CharacterState,cue:BodyCue,progress:number,elapsed:number,reduced:boolean,has:(role:CharacterAnimationRole)=>boolean){
  let role:CharacterAnimationRole='Idle',time=0,expression:FacialExpression='neutral',intensity=1;
  if(state===CharacterState.SwingingIn){
    const detailed=cue.state as CharacterAnimationRole;
    role=has(detailed)?detailed:'SwingIn';time=has(detailed)?cue.progress:progress;
  }else if(state===CharacterState.Arriving){role='ArriveSettle';time=progress;}
  else if(state===CharacterState.Reminder){
    role=elapsed<2?'AskGesture':has('hanging')?'hanging':'Wait';
    time=elapsed<2?elapsed/2:((elapsed-2)%4.2)/4.2;
    if(elapsed>=2)expression='waiting';
  }else if(state===CharacterState.Success){role='Smile';time=Math.min(1,elapsed/.45);expression='smile';}
  else if(state===CharacterState.DeliveringBottle){
    expression='happy';
    if(progress<.18){role='WebShoot';time=progress/.18;}
    else if(progress<.70){role='BottlePresent';time=(progress-.18)/.52;}
    else if(progress<.86){role='Success';time=(progress-.70)/.16;expression='excited';}
    else{role='retract';time=(progress-.86)/.14;}
  }else if(state===CharacterState.Waiting){
    role=elapsed<.5?'Wait':'Disappointed';time=elapsed<.5?elapsed/.5:Math.min(1,(elapsed-.5)/.5);
    expression='disappointed';intensity=.75;
  }else if(state===CharacterState.SwingingOutRight||state===CharacterState.SwingingBackLeft){
    const detailed=cue.state as CharacterAnimationRole;
    role=cue.web!=='second'&&has(detailed)?detailed:state===CharacterState.SwingingOutRight?'SwingExitRight':'SwingExitLeft';
    time=role===detailed?cue.progress:has(detailed)&&cue.web==='second'?(progress-.32)/.68:progress;
    expression=state===CharacterState.SwingingOutRight?'happy':'disappointed';intensity=state===CharacterState.SwingingOutRight?1:.75;
  }
  if(reduced){role='Idle';time=0;}
  return{role,progress:Math.max(0,Math.min(1,time)),expression,intensity};
}
