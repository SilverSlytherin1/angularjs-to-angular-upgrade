import { IComponentOptions, IQService, ITimeoutService, IWindowService } from 'angular';
import { LoadState, Order, StatusFilter } from '../app/order.model';
import { OrdersService } from '../app/orders.service';
import { AppConfig } from './app-config';

/** Matches the CSS breakpoint where the list and the detail sit side by side. */
export const WIDE_QUERY = '(min-width: 56rem)';

export class OrderListController {
  static $inject = ['ordersService', 'appConfig', '$q', '$timeout', '$window'];

  query = '';
  status: StatusFilter = 'all';
  selectedId: number | null = null;
  /** Last row that had focus: with selectedId it decides the table's single Tab stop. */
  focusedId: number | null = null;
  /** Only matters on narrow screens, where the list and the detail take turns. */
  view: 'list' | 'detail' = 'list';

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  // ordersService is the Angular service, downgraded with downgradeInjectable.
  // Its state is in signals, which AngularJS reads like any other getter.
  constructor(
    private readonly ordersService: OrdersService,
    readonly config: AppConfig,
    private readonly $q: IQService,
    private readonly $timeout: ITimeoutService,
    private readonly $window: IWindowService,
  ) {}

  $onInit(): void {
    this.reload();
  }

  get loadState(): LoadState {
    return this.ordersService.loadState();
  }

  get isLoading(): boolean {
    return this.loadState === 'idle' || this.loadState === 'loading';
  }

  get orders(): Order[] {
    return this.ordersService.list(this.query, this.status);
  }

  get counts(): Record<StatusFilter, number> {
    return this.ordersService.counts();
  }

  /**
   * Roving tabindex: the rows are one Tab stop, arrow keys move inside.
   * The stop is the last focused row, else the selected one, else the first.
   */
  get tabStopId(): number | null {
    const orders = this.orders;
    const visible = (id: number | null) => id !== null && orders.some((o) => o.id === id);
    if (visible(this.focusedId)) {
      return this.focusedId;
    }
    if (visible(this.selectedId)) {
      return this.selectedId;
    }
    return orders[0]?.id ?? null;
  }

  /** Names what was filtered, so the empty state is not a dead end. */
  get emptyMessage(): string {
    const parts: string[] = [];
    if (this.query.trim()) {
      parts.push(`"${this.query.trim()}"`);
    }
    if (this.status !== 'all') {
      parts.push(`with status ${this.status}`);
    }
    return `Nothing matches ${parts.join(' ')}.`;
  }

  /** Text for the polite live region above the table. */
  get summary(): string {
    if (this.isLoading) {
      return 'Loading orders';
    }
    if (this.loadState === 'error') {
      return 'Orders could not be loaded';
    }
    const shown = this.orders.length;
    const total = this.counts.all;
    if (!shown) {
      return 'No orders match the filters';
    }
    return shown === total ? `${total} orders` : `Showing ${shown} of ${total} orders`;
  }

  /** $q.when wraps the Angular promise so AngularJS digests when it settles, zone or not. */
  reload(): void {
    this.$q.when(this.ordersService.load()).then(() => {
      if (this.selectedId === null && this.loadState === 'ready') {
        this.selectedId = this.ordersService.orders()[0]?.id ?? null;
      }
    });
  }

  total(order: Order): number {
    return this.ordersService.total(order);
  }

  select(order: Order): void {
    this.selectedId = order.id;
    if (!this.isWide()) {
      // Master-detail on small screens: show the detail and move focus to its heading.
      this.view = 'detail';
      this.focusLater('order-detail-heading');
    }
  }

  /** Called by the Angular detail through its (closed) output. */
  closeDetail(): void {
    const id = this.selectedId;
    if (this.isWide()) {
      this.selectedId = null;
    } else {
      this.view = 'list';
    }
    if (id !== null) {
      this.focusLater(`order-row-${id}`);
    }
  }

  clearFilters(): void {
    this.query = '';
    this.status = 'all';
    this.focusLater('order-search');
  }

  /** Arrow keys, Home and End move between rows; Tab still leaves the table. */
  onRowKeydown(event: KeyboardEvent): void {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    const current = event.target as HTMLElement;
    if (!keys.includes(event.key) || !current.classList.contains('row-select')) {
      return;
    }
    const buttons = Array.from(
      current.closest('tbody')!.querySelectorAll<HTMLButtonElement>('.row-select'),
    );
    const index = buttons.indexOf(current as HTMLButtonElement);
    const next = {
      ArrowDown: Math.min(index + 1, buttons.length - 1),
      ArrowUp: Math.max(index - 1, 0),
      Home: 0,
      End: buttons.length - 1,
    }[event.key]!;
    event.preventDefault();
    buttons[next].focus();
  }

  private isWide(): boolean {
    return this.$window.matchMedia?.(WIDE_QUERY).matches ?? true;
  }

  /** Waits for the digest (and the Angular view it triggers) before moving focus. */
  private focusLater(id: string): void {
    this.$timeout(() => this.$window.document.getElementById(id)?.focus(), 0, false);
  }
}

/** AngularJS 1.5+ component that still owns the page. It hosts a migrated Angular component. */
export const orderListComponent: IComponentOptions = {
  controller: OrderListController,
  template: `
    <div class="workspace" data-view="{{ $ctrl.view }}">
      <section class="panel list-panel boundary boundary-ajs" aria-labelledby="orders-heading">
        <span class="boundary-tag">AngularJS &lt;order-list&gt;</span>
        <div class="list-header">
          <h2 id="orders-heading">Order list</h2>
          <p class="results-summary" role="status">{{ $ctrl.summary }}</p>
        </div>

        <div class="filters">
          <div class="field">
            <label for="order-search">Search</label>
            <div class="search-input">
              <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="9" cy="9" r="5.5" /><path d="m13 13 4 4" /></svg>
              <input id="order-search" type="search" ng-model="$ctrl.query"
                     placeholder="Name or number" autocomplete="off" spellcheck="false" />
            </div>
          </div>
          <fieldset class="segmented status-filter">
            <legend>Status</legend>
            <label ng-repeat="option in ::$ctrl.statusOptions track by option.value">
              <input type="radio" name="status-filter" ng-model="$ctrl.status" ng-value="option.value" />
              <span>{{ ::option.label }} <span class="count">{{ $ctrl.counts[option.value] }}</span></span>
            </label>
          </fieldset>
        </div>

        <div class="list-body" ng-switch="$ctrl.loadState">
          <div ng-switch-when="error" class="state state-error" role="alert">
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4.5M12 17.2v.3" /></svg>
            <h3>Orders could not be loaded</h3>
            <p>The server did not answer in time. Your search and filters are kept.</p>
            <button type="button" class="button button-secondary" ng-click="$ctrl.reload()">Try again</button>
          </div>

          <div ng-switch-default>
            <table class="orders-table" ng-if="$ctrl.isLoading || $ctrl.orders.length"
                   aria-labelledby="orders-heading" aria-busy="{{ $ctrl.isLoading }}">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col" class="col-date">Placed</th>
                  <th scope="col">Status</th>
                  <th scope="col" class="num">Total</th>
                </tr>
              </thead>
              <tbody ng-if="$ctrl.isLoading">
                <tr class="skeleton-row" aria-hidden="true" ng-repeat="n in ::[1, 2, 3, 4, 5]">
                  <td><span class="skeleton skeleton-title"></span><span class="skeleton skeleton-meta"></span></td>
                  <td class="col-date"><span class="skeleton skeleton-meta"></span></td>
                  <td><span class="skeleton skeleton-badge"></span></td>
                  <td class="num"><span class="skeleton skeleton-meta"></span></td>
                </tr>
              </tbody>
              <tbody ng-if="!$ctrl.isLoading" ng-keydown="$ctrl.onRowKeydown($event)">
                <tr ng-repeat="order in $ctrl.orders track by order.id"
                    ng-class="{ 'is-selected': order.id === $ctrl.selectedId }">
                  <td>
                    <button type="button" class="row-select" id="order-row-{{ order.id }}"
                            ng-attr-aria-current="{{ order.id === $ctrl.selectedId ? 'true' : undefined }}"
                            tabindex="{{ order.id === $ctrl.tabStopId ? 0 : -1 }}"
                            ng-focus="$ctrl.focusedId = order.id"
                            ng-click="$ctrl.select(order)">
                      <span class="customer">{{ order.customer }}</span>
                      <span class="order-no">No. {{ order.id }}</span>
                    </button>
                  </td>
                  <td class="col-date">{{ order.createdAt | date:'d MMM' }}</td>
                  <td><status-badge status="order.status"></status-badge></td>
                  <td class="num">{{ $ctrl.total(order) | currency:$ctrl.config.currencySymbol }}</td>
                </tr>
              </tbody>
            </table>

            <div class="state state-empty" ng-if="!$ctrl.isLoading && !$ctrl.orders.length">
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5M8 10.5h5" /></svg>
              <h3>No orders match</h3>
              <p>{{ $ctrl.emptyMessage }}</p>
              <button type="button" class="button button-secondary" ng-click="$ctrl.clearFilters()">Clear filters</button>
            </div>
          </div>
        </div>
      </section>

      <div class="detail-slot">
        <!-- Angular component used from AngularJS through downgradeComponent. -->
        <order-detail ng-if="$ctrl.selectedId !== null" [order-id]="$ctrl.selectedId" (closed)="$ctrl.closeDetail()"></order-detail>
        <section class="panel detail-placeholder" ng-if="$ctrl.selectedId === null">
          <p ng-if="$ctrl.isLoading">Loading order details</p>
          <p ng-if="!$ctrl.isLoading">Select an order to see its lines and ship it.</p>
        </section>
      </div>
    </div>
  `,
};
