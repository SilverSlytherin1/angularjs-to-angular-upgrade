import { Directive, ElementRef, Injector, Input } from '@angular/core';
import { UpgradeComponent } from '@angular/upgrade/static';
import { OrderStatus } from './order.model';

/** Lets Angular templates use the AngularJS statusBadge component until it is migrated. */
@Directive({ selector: 'status-badge' })
export class StatusBadgeDirective extends UpgradeComponent {
  @Input() status!: OrderStatus;

  constructor(elementRef: ElementRef, injector: Injector) {
    super('statusBadge', elementRef, injector);
  }
}
