import { ChangeDetectionStrategy, Component, inject, signal, DOCUMENT } from '@angular/core';
import { OrdersService } from './orders.service';
import {
  ThemeChoice,
  applyBoundaries,
  applyTheme,
  boundariesFromUrl,
  readTheme,
} from './preferences';

/**
 * New code goes straight to Angular, even while AngularJS owns the page:
 * this bar is an Angular component placed in index.html and rendered by
 * AngularJS through downgradeComponent, like order-detail.
 */
@Component({
  selector: 'demo-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="demo-bar boundary boundary-ng" aria-labelledby="demo-bar-title">
      <span class="boundary-tag">Angular &lt;demo-toolbar&gt;</span>
      <h2 id="demo-bar-title" class="visually-hidden">Demo controls</h2>
      <div class="demo-bar-row">
        <button
          type="button"
          class="switch"
          [attr.aria-pressed]="boundaries()"
          aria-controls="boundary-legend"
          (click)="toggleBoundaries()"
        >
          <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
          Show framework boundaries
        </button>
        <button type="button" class="button button-quiet" (click)="simulateFailedLoad()">
          Simulate a failed load
        </button>
        <fieldset class="segmented theme-picker">
          <legend>Theme</legend>
          @for (option of themes; track option.value) {
            <label>
              <input
                type="radio"
                name="theme"
                [value]="option.value"
                [checked]="theme() === option.value"
                (change)="setTheme(option.value)"
              />
              <span>{{ option.label }}</span>
            </label>
          }
        </fieldset>
      </div>
      <div id="boundary-legend" class="legend" [hidden]="!boundaries()">
        <p class="legend-item">
          <span class="swatch swatch-ajs" aria-hidden="true"></span>
          <span><strong>Dashed outline: AngularJS 1.8.</strong> Legacy code that still owns the page:
            the order list, its filters and the status badge.</span>
        </p>
        <p class="legend-item">
          <span class="swatch swatch-ng" aria-hidden="true"></span>
          <span><strong>Solid outline: Angular 21.</strong> Migrated code: the order detail, this bar
            and the notifications, rendered inside AngularJS with <code>downgradeComponent</code>.</span>
        </p>
        <p class="legend-note">
          The badge inside the order detail goes the other way: an AngularJS component reused by
          Angular through <code>UpgradeComponent</code>.
        </p>
      </div>
    </section>
  `,
})
export class DemoToolbarComponent {
  private readonly orders = inject(OrdersService);
  private readonly document = inject(DOCUMENT);
  private readonly storage = () => this.document.defaultView?.localStorage ?? null;

  protected readonly themes: { value: ThemeChoice; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  protected readonly theme = signal<ThemeChoice>(readTheme(this.storage));
  protected readonly boundaries = signal(boundariesFromUrl(this.document.location?.search ?? ''));

  constructor() {
    applyBoundaries(this.document.documentElement, this.boundaries());
  }

  toggleBoundaries(): void {
    this.boundaries.update((on) => !on);
    applyBoundaries(this.document.documentElement, this.boundaries());
  }

  setTheme(theme: ThemeChoice): void {
    this.theme.set(theme);
    applyTheme(this.document.documentElement, this.storage, theme);
  }

  simulateFailedLoad(): void {
    void this.orders.load({ fail: true });
  }
}
