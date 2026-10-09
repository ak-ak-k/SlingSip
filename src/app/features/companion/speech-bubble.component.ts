import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SWING_CONFIG } from './animation/swing-config';

@Component({
  selector: 'app-speech-bubble',
  templateUrl: './speech-bubble.component.html',
  styleUrl: './speech-bubble.component.scss',
  host: { '[style.height.px]': 'motion.bubbleHeight' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeechBubbleComponent {
  readonly motion = SWING_CONFIG;
  readonly heading = input('Drink 250 ml');
  readonly message = input('Time to hydrate. Your sidekick is here.');
  readonly state = input('reminder');
  readonly visible = input(false);
  readonly error = input<string | null>(null);
  readonly preview = input(false);
  /** Presentation only: amounts and goal/retry copy still come from the coordinator. */
  readonly copy = computed(() => {
    const heading=this.heading(),amount=/^Drink (\d+) ml$/.exec(heading),added=/^Nice! \+(\d+) ml/.exec(heading);
    if(this.state()==='reminder'&&amount)return{title:heading,body:this.message(),confirmed:false};
    if((this.state()==='success'||this.state()==='delivering-bottle')&&added)return{title:'Great choice!',body:`+ ${added[1]} ml`,confirmed:true};
    return{title:heading,body:this.message(),confirmed:false};
  });
}
