import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DemoToolbarComponent } from './demo-toolbar.component';
import { ORDERS_LATENCY, OrdersService } from './orders.service';
import { THEME_STORAGE_KEY, applyTheme, boundariesFromUrl, readTheme } from './preferences';

describe('DemoToolbarComponent', () => {
  let fixture: ComponentFixture<DemoToolbarComponent>;
  let host: HTMLElement;
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
    root.removeAttribute('data-boundaries');
    TestBed.configureTestingModule({
      imports: [DemoToolbarComponent],
      providers: [{ provide: ORDERS_LATENCY, useValue: { load: 0, save: 0 } }],
    });
    fixture = TestBed.createComponent(DemoToolbarComponent);
    fixture.detectChanges();
    host = fixture.nativeElement;
  });

  const toggle = () => host.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
  const radio = (value: string) => host.querySelector<HTMLInputElement>(`input[name="theme"][value="${value}"]`)!;

  it('shows framework boundaries as a pressed toggle with a legend', () => {
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector<HTMLElement>('#boundary-legend')!.hidden).toBe(true);

    toggle().click();
    fixture.detectChanges();

    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(root.hasAttribute('data-boundaries')).toBe(true);
    expect(host.querySelector<HTMLElement>('#boundary-legend')!.hidden).toBe(false);
  });

  it('applies and remembers a manual theme, and "System" forgets it', () => {
    expect(radio('system').checked).toBe(true);

    radio('dark').click();
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    radio('system').click();
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('triggers a failed load for the error state demo', async () => {
    const orders = TestBed.inject(OrdersService);
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Simulate a failed load'))!
      .click();
    expect(orders.loadState()).toBe('loading');
    await new Promise((resolve) => setTimeout(resolve));
    expect(orders.loadState()).toBe('error');
  });
});

describe('preferences', () => {
  const throwing = () => {
    throw new DOMException('blocked', 'SecurityError');
  };

  it('falls back to the system theme when storage is unavailable', () => {
    expect(readTheme(throwing)).toBe('system');
    expect(readTheme(() => null)).toBe('system');
  });

  it('still applies the theme when storage throws', () => {
    const el = document.createElement('div');
    expect(() => applyTheme(el, throwing, 'dark')).not.toThrow();
    expect(el.getAttribute('data-theme')).toBe('dark');
  });

  it('turns boundaries on from the URL', () => {
    expect(boundariesFromUrl('?boundaries=on')).toBe(true);
    expect(boundariesFromUrl('')).toBe(false);
  });
});
