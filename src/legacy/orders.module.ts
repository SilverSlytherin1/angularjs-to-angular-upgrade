import * as angular from 'angular';
import { downgradeComponent, downgradeInjectable, setAngularJSGlobal } from '@angular/upgrade/static';
import { DemoToolbarComponent } from '../app/demo-toolbar.component';
import { OrderDetailComponent } from '../app/order-detail.component';
import { OrdersService } from '../app/orders.service';
import { UndoToastComponent } from '../app/undo-toast.component';
import { APP_CONFIG_NAME, appConfig } from './app-config';
import { orderListComponent } from './order-list.component';
import { orderStatusLabelFilter } from './order-status.filter';
import { statusBadgeComponent } from './status-badge.component';

export const ORDERS_APP = 'ordersApp';

// AngularJS comes from npm, not from a global <script> tag, so tell ngUpgrade where it is.
setAngularJSGlobal(angular);

angular
  .module(ORDERS_APP, [])
  // Still AngularJS
  .value(APP_CONFIG_NAME, appConfig)
  .filter('orderStatusLabel', orderStatusLabelFilter)
  .component('statusBadge', statusBadgeComponent)
  .component('orderList', orderListComponent)
  // Already Angular, handed back to AngularJS
  .factory('ordersService', downgradeInjectable(OrdersService))
  .directive('orderDetail', downgradeComponent({ component: OrderDetailComponent }))
  // New features are written in Angular from the start
  .directive('demoToolbar', downgradeComponent({ component: DemoToolbarComponent }))
  .directive('undoToast', downgradeComponent({ component: UndoToastComponent }));
