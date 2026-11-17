import { TestBed } from '@angular/core/testing';
import { ORDERS_LATENCY, OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ORDERS_LATENCY, useValue: { load: 0, save: 0 } }],
    });
    service = TestBed.inject(OrdersService);
    await service.load();
  });

  it('filters by customer name or order number, ignoring case', () => {
    expect(service.list('bakery').map((o) => o.id)).toEqual([1003]);
    expect(service.list('1002').map((o) => o.customer)).toEqual(['Bianchi Studio']);
    expect(service.list('  ')).toHaveLength(8);
  });

  it('combines the text query with the status filter', () => {
    expect(service.list('', 'cancelled').map((o) => o.id)).toEqual([1004]);
    expect(service.list('ro', 'pending').map((o) => o.id)).toEqual([1001]);
    expect(service.list('bakery', 'shipped')).toEqual([]);
  });

  it('counts orders per status', () => {
    expect(service.counts()).toEqual({ all: 8, pending: 4, shipped: 3, cancelled: 1 });
  });

  it('computes totals in cents to avoid floating point drift', () => {
    // 2 x 22.00 + 5 x 6.40 = 76.00 exactly, not 75.99999
    expect(service.total(service.get(1003)!)).toBe(76);
  });

  it('goes through loading to error on a failed load, and recovers on retry', async () => {
    const failed = service.load({ fail: true });
    expect(service.loadState()).toBe('loading');
    await failed;
    expect(service.loadState()).toBe('error');

    await service.load();
    expect(service.loadState()).toBe('ready');
  });

  it('lets the latest load win when two overlap', async () => {
    const first = service.load({ fail: true });
    const second = service.load();
    await Promise.all([first, second]);
    expect(service.loadState()).toBe('ready');
  });

  it('marks an order as shipped at once and keeps it after the save', async () => {
    const saved = service.markShipped(1001);
    expect(service.get(1001)!.status).toBe('shipped');
    expect(service.lastChange()).toMatchObject({ orderId: 1001, state: 'saving' });

    await saved;
    expect(service.lastChange()!.state).toBe('saved');
    await service.load();
    expect(service.get(1001)!.status).toBe('shipped');
  });

  it('undoes a change while its save is still running', async () => {
    const saved = service.markShipped(1001);
    service.undo();
    await saved;

    expect(service.get(1001)!.status).toBe('pending');
    expect(service.lastChange()!.state).toBe('undone');
    await service.load();
    expect(service.get(1001)!.status).toBe('pending');
  });

  it('rolls back when the server refuses the save', async () => {
    await service.markShipped(1006);

    expect(service.get(1006)!.status).toBe('pending');
    expect(service.lastChange()).toMatchObject({ state: 'failed', message: 'the shipping address is missing' });
    service.undo();
    expect(service.lastChange()!.state).toBe('failed');
  });

  it('refuses to change the status of a cancelled order', async () => {
    await expect(service.markShipped(1004)).rejects.toThrowError(/cancelled/);
    expect(service.get(1004)!.status).toBe('cancelled');
  });
});
