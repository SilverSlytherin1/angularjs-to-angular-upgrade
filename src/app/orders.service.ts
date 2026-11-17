import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { LoadState, Order, OrderStatus, StatusChange, StatusFilter } from './order.model';

const SEED: Order[] = [
  {
    id: 1001,
    customer: 'Rossi Hardware',
    createdAt: '2026-11-02',
    status: 'pending',
    shipTo: 'Via Emilia Est 112, Modena',
    lines: [
      { product: 'Hinge, steel', quantity: 40, unitPrice: 1.9 },
      { product: 'Wood screws (box)', quantity: 10, unitPrice: 4.5 },
    ],
  },
  {
    id: 1002,
    customer: 'Bianchi Studio',
    createdAt: '2026-11-04',
    status: 'shipped',
    shipTo: 'Via Farini 8, Parma',
    lines: [{ product: 'Desk lamp', quantity: 3, unitPrice: 39 }],
  },
  {
    id: 1003,
    customer: 'Verdi Bakery',
    createdAt: '2026-11-07',
    status: 'pending',
    shipTo: 'Corso Garibaldi 41, Reggio Emilia',
    lines: [
      { product: 'Paper bags (500)', quantity: 2, unitPrice: 22 },
      { product: 'Labels (roll)', quantity: 5, unitPrice: 6.4 },
    ],
  },
  {
    id: 1004,
    customer: 'Neri Bikes',
    createdAt: '2026-11-09',
    status: 'cancelled',
    shipTo: 'Via Roma 3, Carpi',
    lines: [{ product: 'Inner tube', quantity: 12, unitPrice: 5.2 }],
  },
  {
    id: 1005,
    customer: 'Colombo & Figli Joinery',
    createdAt: '2026-11-10',
    status: 'shipped',
    shipTo: 'Via dell’Artigianato 27, Sassuolo',
    lines: [
      { product: 'Oak board, 2 m', quantity: 14, unitPrice: 18.5 },
      { product: 'Wood glue (1 kg)', quantity: 4, unitPrice: 9.9 },
    ],
  },
  {
    id: 1006,
    customer: 'Galli Garden Centre',
    createdAt: '2026-11-12',
    status: 'pending',
    lines: [
      { product: 'Terracotta pot, 30 cm', quantity: 24, unitPrice: 7.8 },
      { product: 'Potting soil (50 l)', quantity: 10, unitPrice: 8.25 },
    ],
  },
  {
    id: 1007,
    customer: 'Esposito Print Shop',
    createdAt: '2026-11-13',
    status: 'pending',
    shipTo: 'Via Saragozza 66, Bologna',
    lines: [{ product: 'Toner cartridge', quantity: 6, unitPrice: 54 }],
  },
  {
    id: 1008,
    customer: 'Romano Coffee Roasters',
    createdAt: '2026-11-14',
    status: 'shipped',
    shipTo: 'Piazza Grande 5, Modena',
    lines: [
      { product: 'Valve bags (100)', quantity: 3, unitPrice: 16 },
      { product: 'Kraft labels (roll)', quantity: 2, unitPrice: 6.4 },
    ],
  },
];

/** Simulated network latency in milliseconds. Tests set it to 0. */
export const ORDERS_LATENCY = new InjectionToken<{ load: number; save: number }>('ORDERS_LATENCY', {
  providedIn: 'root',
  factory: () => ({ load: 700, save: 600 }),
});

/**
 * Migrated first: this service used to be an AngularJS factory.
 * It is now a plain Angular service and is handed back to AngularJS
 * with downgradeInjectable (see legacy/orders.module.ts), so legacy
 * components keep injecting it by name ('ordersService').
 *
 * State lives in signals and is replaced, never mutated. AngularJS reads
 * the signals in its templates like any getter, and Angular OnPush
 * components update because the signals they read change.
 */
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly latency = inject(ORDERS_LATENCY);

  /** Stands in for the server: only load() and the save timers touch it. */
  private readonly db: Order[] = structuredClone(SEED);

  private readonly ordersState = signal<Order[]>([]);
  private readonly loadStateState = signal<LoadState>('idle');
  private readonly lastChangeState = signal<StatusChange | null>(null);
  private loadSeq = 0;
  private changeSeq = 0;
  private readonly undone = new Set<number>();

  readonly orders = this.ordersState.asReadonly();
  readonly loadState = this.loadStateState.asReadonly();
  readonly lastChange = this.lastChangeState.asReadonly();

  readonly counts = computed(() => {
    const counts: Record<StatusFilter, number> = { all: 0, pending: 0, shipped: 0, cancelled: 0 };
    for (const order of this.ordersState()) {
      counts.all++;
      counts[order.status]++;
    }
    return counts;
  });

  /** Loads the orders after a short delay. With `fail` the request errors, to show the error state. */
  load(options: { fail?: boolean } = {}): Promise<void> {
    const seq = ++this.loadSeq;
    this.loadStateState.set('loading');
    return new Promise((resolve) => {
      setTimeout(() => {
        // A newer load started meanwhile: the latest request wins.
        if (seq === this.loadSeq) {
          if (options.fail) {
            this.loadStateState.set('error');
          } else {
            this.ordersState.set(structuredClone(this.db));
            this.loadStateState.set('ready');
          }
        }
        resolve();
      }, this.latency.load);
    });
  }

  list(query = '', status: StatusFilter = 'all'): Order[] {
    const q = query.trim().toLowerCase();
    return this.ordersState().filter(
      (o) =>
        (status === 'all' || o.status === status) &&
        (!q || o.customer.toLowerCase().includes(q) || String(o.id).includes(q)),
    );
  }

  get(id: number): Order | undefined {
    return this.ordersState().find((o) => o.id === id);
  }

  total(order: Order): number {
    const cents = order.lines.reduce((sum, l) => sum + Math.round(l.unitPrice * 100) * l.quantity, 0);
    return cents / 100;
  }

  /**
   * Optimistic update: the order shows as shipped at once, the save runs in
   * the background and is rolled back if the server refuses it.
   */
  markShipped(id: number): Promise<void> {
    const order = this.get(id);
    if (!order) {
      return Promise.reject(new Error(`Order ${id} not found`));
    }
    if (order.status === 'cancelled') {
      return Promise.reject(new Error(`Order ${id} is cancelled and cannot change status`));
    }
    if (order.status !== 'pending') {
      return Promise.resolve();
    }

    const seq = ++this.changeSeq;
    this.patch(id, 'shipped');
    this.lastChangeState.set({ seq, orderId: id, previous: 'pending', state: 'saving' });

    return new Promise((resolve) => {
      setTimeout(() => {
        if (this.undone.delete(seq)) {
          resolve();
          return;
        }
        const stored = this.db.find((o) => o.id === id)!;
        if (stored.shipTo) {
          stored.status = 'shipped';
          this.updateChange(seq, { state: 'saved' });
        } else {
          this.patch(id, 'pending');
          this.updateChange(seq, {
            state: 'failed',
            message: 'the shipping address is missing',
          });
        }
        resolve();
      }, this.latency.save);
    });
  }

  /** Reverts the last change, whether its save is still running or already done. */
  undo(): void {
    const change = this.lastChangeState();
    if (!change || (change.state !== 'saving' && change.state !== 'saved')) {
      return;
    }
    if (change.state === 'saving') {
      this.undone.add(change.seq);
    }
    this.db.find((o) => o.id === change.orderId)!.status = change.previous;
    this.patch(change.orderId, change.previous);
    this.lastChangeState.set({ ...change, state: 'undone' });
  }

  private patch(id: number, status: OrderStatus): void {
    this.ordersState.update((orders) => orders.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  private updateChange(seq: number, patch: Partial<StatusChange>): void {
    const change = this.lastChangeState();
    if (change?.seq === seq) {
      this.lastChangeState.set({ ...change, ...patch });
    }
  }
}
