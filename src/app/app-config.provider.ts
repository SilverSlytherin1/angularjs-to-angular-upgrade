import { InjectionToken, Provider } from '@angular/core';
import { APP_CONFIG_NAME, AppConfig } from '../legacy/app-config';

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

/**
 * Upgraded provider: Angular code injects APP_CONFIG while the value still
 * lives in the AngularJS injector. '$injector' is available because the
 * app is bootstrapped with UpgradeModule.
 */
export const appConfigProvider: Provider = {
  provide: APP_CONFIG,
  useFactory: (injector: { get(name: string): unknown }) => injector.get(APP_CONFIG_NAME),
  deps: ['$injector'],
};
