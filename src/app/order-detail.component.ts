import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LongDatePipe, MoneyPipe } from './format.pipes';
import { OrdersService } from './orders.service';
import { StatusBadgeDirective } from './status-badge.directive';

/**
 * First leaf component migrated to Angular. AngularJS renders it through
 * downgradeComponent and binds [order-id] and (closed) in its template.
 *
 * Signal inputs and OnPush work here: the downgrade adapter in
 * @angular/upgrade/static writes signal inputs through the signal node and
 * marks the view for check when an AngularJS binding changes. The input is
 * an id, not the order object, so the component reads the order from the
 * service signal and never depends on AngularJS mutating a shared object.
 */
@Component({
  selector: 'order-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LongDatePipe, MoneyPipe, StatusBadgeDirective],
  host: { '(keydown.escape)': 'closed.emit()' },
  template: `
    @if (order(); as order) {
      <section class="panel detail boundary boundary-ng" aria-labelledby="order-detail-heading">
        <span class="boundary-tag">Angular &lt;order-detail&gt;</span>
        <button type="button" class="back-button" (click)="closed.emit()">
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>
          Back to orders
        </button>
        <header class="detail-header">
          <div class="detail-title">
            <p class="detail-number">Order {{ order.id }}</p>
            <h2 id="order-detail-heading" tabindex="-1">{{ order.customer }}</h2>
          </div>
          <button type="button" class="icon-button close-button" aria-label="Close order details" (click)="closed.emit()">
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" /></svg>
          </button>
        </header>

        <dl class="facts">
          <div>
            <dt>Status</dt>
            <dd class="status-cell">
              <status-badge class="boundary boundary-ajs boundary-inline" [status]="order.status" />
              <span class="boundary-tag boundary-tag-inline">AngularJS &lt;status-badge&gt;</span>
            </dd>
          </div>
          <div>
            <dt>Placed</dt>
            <dd>{{ order.createdAt | longDate }}</dd>
          </div>
          <div class="facts-wide">
            <dt>Ship to</dt>
            <dd>
              @if (order.shipTo) {
                {{ order.shipTo }}
              } @else {
                <span class="text-danger">Missing address</span>
              }
            </dd>
          </div>
        </dl>

        <table class="lines">
          <caption class="visually-hidden">Order lines</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" class="num">Qty</th>
              <th scope="col" class="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            @for (line of order.lines; track line.product) {
              <tr>
                <td>
                  {{ line.product }}
                  <span class="line-unit">{{ line.unitPrice | money }} each</span>
                </td>
                <td class="num">{{ line.quantity }}</td>
                <td class="num">{{ line.quantity * line.unitPrice | money }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colspan="2">Total</th>
              <td class="num" data-testid="total">{{ total() | money }}</td>
            </tr>
          </tfoot>
        </table>

        <div class="detail-actions">
          @if (order.status === 'cancelled') {
            <p class="note">Cancelled orders cannot be shipped.</p>
          } @else {
            <!-- aria-disabled, not disabled: the button keeps focus after shipping, so Tab reaches Undo next. -->
            <button
              type="button"
              class="button button-primary ship-button"
              [id]="'ship-button-' + order.id"
              [attr.aria-disabled]="order.status !== 'pending' || null"
              [attr.aria-describedby]="failure() ? 'ship-error' : null"
              (click)="ship()"
            >
              @if (order.status === 'shipped') {
                <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
                Shipped
              } @else {
                Mark as shipped
              }
            </button>
            @if (saving()) {
              <span class="saving" aria-hidden="true">Saving</span>
            }
          }
          @if (failure(); as message) {
            <p id="ship-error" class="inline-error">Not shipped: {{ message }}. The order is pending again.</p>
          }
        </div>
      </section>
    }
  `,
})
export class OrderDetailComponent {
  readonly orderId = input.required<number>();
  readonly closed = output<void>();

  private readonly orders = inject(OrdersService);

  protected readonly order = computed(() => this.orders.get(this.orderId()));
  protected readonly total = computed(() => {
    const order = this.order();
    return order ? this.orders.total(order) : 0;
  });
  private readonly change = computed(() => {
    const change = this.orders.lastChange();
    return change?.orderId === this.orderId() ? change : null;
  });
  protected readonly saving = computed(() => this.change()?.state === 'saving');
  protected readonly failure = computed(() => {
    const change = this.change();
    return change?.state === 'failed' ? (change.message ?? '') : '';
  });

  ship(): void {
    const order = this.order();
    if (order?.status === 'pending') {
      // The promise never rejects for a pending order: a refused save is
      // rolled back by the service and reported through lastChange.
      void this.orders.markShipped(order.id);
    }
  }
}
