import { computed, Injectable, signal } from '@angular/core';
import { canTransition, CharacterState, type CharacterDirection } from './character.model';

@Injectable()
export class CharacterStateService {
  private readonly state = signal(CharacterState.Hidden);
  private readonly facing = signal<CharacterDirection>('left');
  readonly current = this.state.asReadonly();
  readonly direction = this.facing.asReadonly();
  readonly visible = computed(() => this.current() !== CharacterState.Hidden);

  transition(next: CharacterState): void {
    if (!canTransition(this.state(), next)) throw new Error(`Invalid character transition: ${this.state()} → ${next}`);
    this.state.set(next);
  }

  face(direction: CharacterDirection): void { this.facing.set(direction); }

  reset(): void {
    // Explicit cancellation is the escape from the normal interaction/animation sequence.
    this.state.set(CharacterState.Hidden);
    this.facing.set('left');
  }
}
