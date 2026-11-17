import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  DOCUMENT,
} from '@angular/core';
import { StatusChange } from './order.model';
import { OrdersService } from './orders.service';

const VISIBLE_MS = { action: 8000, info: 5000 };

/**
 * Confirms status changes and offers Undo. The status line is a polite live
 * region that stays in the DOM, so screen readers announce every change;
 * the buttons sit outside it so they are not read as part of the message.
 * The timer pauses while the pointer or focus is inside the toast.
 */
@Component({
  selector: 'undo-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(mouseenter)': 'pause()',
    '(mouseleave)': 'resume()',
    '(focusin)': 'pause()',
    '(focusout)': 'resume()',
  },
  template: `
    <div class="toast boundary boundary-ng" [class.is-visible]="visible()" [class.is-error]="change()?.state === 'failed'">
      @if (visible()) {
        <span class="boundary-tag">Angular &lt;undo-toast&gt;</span>
      }
      <p class="toast-message" role="status">{{ visible() ? message() : '' }}</p>
      @if (visible()) {
        @if (canUndo()) {
          <button type="button" class="toast-action" (click)="undo()">Undo</button>
        }
        <button type="button" class="icon-button toast-close" aria-label="Dismiss notification" (click)="dismiss()">
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" /></svg>
        </button>
      }
    </div>
  `,
})
export class UndoToastComponent {
  private readonly orders = inject(OrdersService);
  private readonly document = inject(DOCUMENT);

  protected readonly change = this.orders.lastChange;
  protected readonly visible = signal(false);
  protected readonly canUndo = computed(() => {
    const state = this.change()?.state;
    return state === 'saving' || state === 'saved';
  });
  protected readonly message = computed(() => describe(this.change()));

  private timer: ReturnType<typeof setTimeout> | undefined;
  private remaining = 0;
  private startedAt = 0;
  private paused = false;

  constructor() {
    // Show the toast for every new change and every change of state.
    // Timers leave the Angular world, which is what effects are for.
    effect(() => {
      const change = this.change();
      untracked(() => {
        if (change && change.state !== 'saved') {
          this.show(change.state === 'saving' ? VISIBLE_MS.action : VISIBLE_MS.info);
        }
      });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  undo(): void {
    const change = this.change();
    if (!change) {
      return;
    }
    this.returnFocus(change);
    this.orders.undo();
  }

  dismiss(): void {
    const change = this.change();
    if (change && this.document.activeElement?.closest('undo-toast')) {
      this.returnFocus(change);
    }
    clearTimeout(this.timer);
    this.paused = false;
    this.visible.set(false);
  }

  /** Moves focus out before the toast buttons disappear, so it never falls to <body>. */
  private returnFocus(change: StatusChange): void {
    const target =
      this.document.getElementById(`ship-button-${change.orderId}`) ??
      this.document.getElementById(`order-row-${change.orderId}`);
    target?.focus();
  }

  pause(): void {
    if (!this.visible() || this.paused) {
      return;
    }
    this.paused = true;
    clearTimeout(this.timer);
    this.remaining -= Date.now() - this.startedAt;
  }

  resume(): void {
    if (!this.paused) {
      return;
    }
    this.paused = false;
    this.start(Math.max(this.remaining, 2000));
  }

  private show(ms: number): void {
    this.visible.set(true);
    this.paused = false;
    this.start(ms);
  }

  private start(ms: number): void {
    clearTimeout(this.timer);
    this.remaining = ms;
    this.startedAt = Date.now();
    this.timer = setTimeout(() => this.visible.set(false), ms);
  }
}

function describe(change: StatusChange | null): string {
  switch (change?.state) {
    case 'saving':
    case 'saved':
      return `Order ${change.orderId} marked as shipped.`;
    case 'undone':
      return `Order ${change.orderId} is ${change.previous} again.`;
    case 'failed':
      return `Order ${change.orderId} was not shipped: ${change.message ?? 'the server refused the change'}.`;
    default:
      return '';
  }
}
