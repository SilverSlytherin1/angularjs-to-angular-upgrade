import { IComponentOptions } from 'angular';

/**
 * AngularJS component, not migrated yet. Angular reuses it inside
 * order-detail through an UpgradeComponent wrapper (app/status-badge.directive.ts).
 * To be upgradable it uses only one-way '<' bindings and an inline template.
 */
export const statusBadgeComponent: IComponentOptions = {
  bindings: { status: '<' },
  template: `<span class="badge badge-{{ $ctrl.status }}">{{ $ctrl.status | orderStatusLabel }}</span>`,
};
