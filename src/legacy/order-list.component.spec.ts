import { TestBed } from '@angular/core/testing';
import { createAngularJSTestingModule } from '@angular/upgrade/static/testing';
import * as angular from 'angular';
import { AppModule } from '../app/app.module';
import { ORDERS_LATENCY, OrdersService } from '../app/orders.service';
import { OrderListController } from './order-list.component';
import { ORDERS_APP } from './orders.module';

// AngularJS side of the hybrid, tested with the real downgraded Angular service.
// createAngularJSTestingModule wires the Angular injector (TestBed) into AngularJS.
// The downgraded <order-detail> needs a bootstrapped Angular app, so the test
// module removes that directive: the list renders on its own.
const NO_DETAIL = 'orderListTestOverrides';
angular.module(NO_DETAIL, []).config([
  '$provide',
  ($provide: angular.auto.IProvideService) => $provide.decorator('orderDetailDirective', () => []),
]);

describe('orderList (AngularJS) with the downgraded OrdersService', () => {
  let $injector: angular.auto.IInjectorService;
  let scope: angular.IScope;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: ORDERS_LATENCY, useValue: { load: 0, save: 0 } }],
    });
    $injector = angular.injector(['ng', createAngularJSTestingModule([AppModule]), ORDERS_APP, NO_DETAIL]);
    scope = $injector.get('$rootScope').$new();
  });

  /** Lets the zero-latency timers and the $q callbacks run, then digests. */
  async function settle() {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
    }
    scope.$digest();
  }

  async function renderList() {
    const element = $injector.get('$compile')('<order-list></order-list>')(scope);
    scope.$digest();
    const ctrl = element.controller('orderList') as OrderListController;
    return { el: element[0] as HTMLElement, ctrl };
  }

  const rows = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('.row-select'));
  const summary = (el: HTMLElement) => el.querySelector('.results-summary')!.textContent!.trim();

  it('gets the same OrdersService instance that Angular uses', () => {
    expect($injector.get('ordersService')).toBe(TestBed.inject(OrdersService));
  });

  it('shows a busy skeleton while loading, then the orders with the first one selected', async () => {
    const { el, ctrl } = await renderList();
    expect(el.querySelector('table')!.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelectorAll('.skeleton-row')).toHaveLength(5);
    expect(summary(el)).toBe('Loading orders');

    await settle();

    expect(el.querySelector('table')!.getAttribute('aria-busy')).toBe('false');
    expect(rows(el)).toHaveLength(8);
    expect(ctrl.selectedId).toBe(1001);
    expect(summary(el)).toBe('8 orders');
  });

  it('filters by status and text, and says how many are shown', async () => {
    const { el, ctrl } = await renderList();
    await settle();

    ctrl.status = 'pending';
    scope.$digest();
    expect(rows(el).map((r) => r.id)).toEqual(['order-row-1001', 'order-row-1003', 'order-row-1006', 'order-row-1007']);

    ctrl.query = 'galli';
    scope.$digest();
    expect(rows(el).map((r) => r.id)).toEqual(['order-row-1006']);
    expect(summary(el)).toBe('Showing 1 of 8 orders');
  });

  it('shows an empty state that names the filters and clears them', async () => {
    const { el, ctrl } = await renderList();
    await settle();

    ctrl.query = 'zzz';
    ctrl.status = 'shipped';
    scope.$digest();

    const empty = el.querySelector('.state-empty')!;
    expect(el.querySelector('table')).toBeNull();
    expect(empty.textContent).toContain('"zzz"');
    expect(empty.textContent).toContain('with status shipped');

    empty.querySelector('button')!.click();
    expect(rows(el)).toHaveLength(8);
    expect(ctrl.query).toBe('');
    expect(ctrl.status).toBe('all');
  });

  it('shows an error with a retry that loads again', async () => {
    const { el } = await renderList();
    await settle();

    void TestBed.inject(OrdersService).load({ fail: true });
    await settle();
    const alert = el.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('Orders could not be loaded');

    alert.querySelector('button')!.click();
    await settle();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(rows(el)).toHaveLength(8);
  });

  it('marks the selected row with aria-current and makes the rows a single Tab stop', async () => {
    const { el, ctrl } = await renderList();
    await settle();

    ctrl.select(TestBed.inject(OrdersService).get(1003)!);
    scope.$digest();

    const current = rows(el).filter((r) => r.getAttribute('aria-current') === 'true');
    expect(current.map((r) => r.id)).toEqual(['order-row-1003']);
    const tabStops = rows(el).filter((r) => r.getAttribute('tabindex') === '0');
    expect(tabStops.map((r) => r.id)).toEqual(['order-row-1003']);
  });

  it('moves focus between rows with the arrow keys, Home and End', async () => {
    const { el } = await renderList();
    await settle();
    document.body.append(el);
    try {
      const [first, second] = rows(el);
      const press = (key: string) =>
        document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

      first.focus();
      press('ArrowDown');
      expect(document.activeElement).toBe(second);
      press('End');
      expect(document.activeElement).toBe(rows(el)[7]);
      press('Home');
      expect(document.activeElement).toBe(first);
    } finally {
      el.remove();
    }
  });

  it('switches to the detail view on narrow screens and back to the list on close', async () => {
    const matchMedia = vi.fn(() => ({ matches: false }) as MediaQueryList);
    vi.stubGlobal('matchMedia', matchMedia);
    try {
      const { el, ctrl } = await renderList();
      await settle();

      ctrl.select(TestBed.inject(OrdersService).get(1003)!);
      scope.$digest();
      expect(el.querySelector('.workspace')!.getAttribute('data-view')).toBe('detail');

      ctrl.closeDetail();
      scope.$digest();
      expect(el.querySelector('.workspace')!.getAttribute('data-view')).toBe('list');
      expect(ctrl.selectedId).toBe(1003);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('renders the AngularJS status badge through the legacy filter', () => {
    const element = $injector.get('$compile')('<status-badge status="\'shipped\'"></status-badge>')(scope);
    scope.$digest();
    expect(element.text().trim()).toBe('Shipped');
    expect(element.find('span').hasClass('badge-shipped')).toBe(true);
  });
});
