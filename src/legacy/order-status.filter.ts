import { OrderStatus } from '../app/order.model';

const LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
};

/** AngularJS filter: turns a status code into a label. Still AngularJS, to be migrated later as a pipe. */
export function orderStatusLabelFilter() {
  return (status: OrderStatus): string => LABELS[status] ?? status;
}
