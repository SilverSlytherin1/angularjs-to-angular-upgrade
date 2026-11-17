export type OrderStatus = 'pending' | 'shipped' | 'cancelled';

/** Status filter used by the list: one status, or all of them. */
export type StatusFilter = OrderStatus | 'all';

/** Lifecycle of the (simulated) request that loads the orders. */
export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface OrderLine {
  product: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: number;
  customer: string;
  createdAt: string;
  status: OrderStatus;
  /** Missing on purpose for one order, so the demo can show a failed save. */
  shipTo?: string;
  lines: OrderLine[];
}

/** The last status change made from the UI, kept so it can be undone or rolled back. */
export interface StatusChange {
  seq: number;
  orderId: number;
  previous: OrderStatus;
  state: 'saving' | 'saved' | 'undone' | 'failed';
  /** Why a save failed, as a sentence fragment ("the shipping address is missing"). */
  message?: string;
}
