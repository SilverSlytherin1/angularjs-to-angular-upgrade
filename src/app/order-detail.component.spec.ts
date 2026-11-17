import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_CONFIG } from './app-config.provider';
import { OrderDetailComponent } from './order-detail.component';
import { ORDERS_LATENCY, OrdersService } from './orders.service';
import { StatusBadgeDirective } from './status-badge.directive';

// The real status-badge is an upgraded AngularJS component and needs a
// running AngularJS injector. In an Angular unit test we swap it for a stub.
@Component({ selector: 'status-badge', template: '<span class="badge">{{ status }}</span>' })
class StatusBadgeStub {
  @Input() status = '';
}

describe('OrderDetailComponent', () => {
  let fixture: ComponentFixture<OrderDetailComponent>;
  let host: HTMLElement;
  let orders: OrdersService;

  async function render(orderId: number) {
    fixture = TestBed.createComponent(OrderDetailComponent);
    fixture.componentRef.setInput('orderId', orderId);
    fixture.detectChanges();
    host = fixture.nativeElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderDetailComponent],
      providers: [
        { provide: APP_CONFIG, useValue: { currency: 'EUR', currencySymbol: '€' } },
        { provide: ORDERS_LATENCY, useValue: { load: 0, save: 0 } },
      ],
    })
      .overrideComponent(OrderDetailComponent, {
        remove: { imports: [StatusBadgeDirective] },
        add: { imports: [StatusBadgeStub] },
      })
      .compileComponents();

    orders = TestBed.inject(OrdersService);
    await orders.load();
  });

  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === name,
    );
  const badge = () => host.querySelector('.badge')?.textContent;

  it('renders the order with a labelled heading, total and status', async () => {
    await render(1001);
    const section = host.querySelector('section')!;
    expect(section.getAttribute('aria-labelledby')).toBe('order-detail-heading');
    expect(host.querySelector('#order-detail-heading')?.textContent).toBe('Rossi Hardware');
    expect(host.querySelector('[data-testid="total"]')?.textContent).toContain('121.00');
    expect(badge()).toBe('pending');
  });

  it('follows the order id input, as AngularJS changes the selection', async () => {
    await render(1001);
    fixture.componentRef.setInput('orderId', 1003);
    fixture.detectChanges();
    expect(host.querySelector('#order-detail-heading')?.textContent).toBe('Verdi Bakery');
  });

  it('ships optimistically and keeps the button focusable with aria-disabled', async () => {
    await render(1001);
    button('Mark as shipped')!.click();
    fixture.detectChanges();

    expect(orders.get(1001)!.status).toBe('shipped');
    expect(badge()).toBe('shipped');
    const shipped = button('Shipped')!;
    expect(shipped.disabled).toBe(false);
    expect(shipped.getAttribute('aria-disabled')).toBe('true');
    expect(shipped.id).toBe('ship-button-1001');
  });

  it('shows the rollback reason next to the button when the save fails', async () => {
    await render(1006);
    button('Mark as shipped')!.click();
    fixture.detectChanges();
    expect(badge()).toBe('shipped');

    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(badge()).toBe('pending');
    expect(host.querySelector('#ship-error')?.textContent).toContain('shipping address is missing');
    expect(button('Mark as shipped')!.getAttribute('aria-describedby')).toBe('ship-error');
  });

  it('offers no ship action for a cancelled order', async () => {
    await render(1004);
    expect(button('Mark as shipped')).toBeUndefined();
    expect(host.textContent).toContain('Cancelled orders cannot be shipped.');
  });

  it('emits closed from the close button and from Escape', async () => {
    await render(1001);
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);

    button('Close order details')!.click();
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toBe(2);
  });
});
