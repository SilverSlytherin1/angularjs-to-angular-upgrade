import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ORDERS_LATENCY, OrdersService } from './orders.service';
import { UndoToastComponent } from './undo-toast.component';

describe('UndoToastComponent', () => {
  let fixture: ComponentFixture<UndoToastComponent>;
  let host: HTMLElement;
  let orders: OrdersService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [UndoToastComponent],
      providers: [{ provide: ORDERS_LATENCY, useValue: { load: 0, save: 0 } }],
    });
    orders = TestBed.inject(OrdersService);
    await orders.load();
    fixture = TestBed.createComponent(UndoToastComponent);
    fixture.detectChanges();
    host = fixture.nativeElement;
  });

  afterEach(() => vi.useRealTimers());

  const status = () => host.querySelector('[role="status"]');
  const undoButton = () =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Undo');

  it('keeps an empty polite live region in the DOM before anything happens', () => {
    expect(status()).not.toBeNull();
    expect(status()!.textContent).toBe('');
    expect(undoButton()).toBeUndefined();
  });

  it('announces a shipped order and undoes it', () => {
    void orders.markShipped(1001);
    fixture.detectChanges();
    expect(status()!.textContent).toBe('Order 1001 marked as shipped.');
    // The button is outside the live region, so it is not read as part of the message.
    expect(status()!.contains(undoButton()!)).toBe(false);

    undoButton()!.click();
    fixture.detectChanges();

    expect(orders.get(1001)!.status).toBe('pending');
    expect(status()!.textContent).toBe('Order 1001 is pending again.');
    expect(undoButton()).toBeUndefined();
  });

  it('returns focus to the ship button before the Undo button goes away', () => {
    const shipButton = document.createElement('button');
    shipButton.id = 'ship-button-1001';
    document.body.append(shipButton);
    try {
      void orders.markShipped(1001);
      fixture.detectChanges();
      undoButton()!.click();
      expect(document.activeElement).toBe(shipButton);
    } finally {
      shipButton.remove();
    }
  });

  it('hides itself after a while', () => {
    vi.useFakeTimers();
    void orders.markShipped(1001);
    fixture.detectChanges();
    expect(status()!.textContent).not.toBe('');

    vi.advanceTimersByTime(8000);
    fixture.detectChanges();
    expect(status()!.textContent).toBe('');
  });
});
