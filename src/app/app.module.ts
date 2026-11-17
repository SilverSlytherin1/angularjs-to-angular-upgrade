import { DoBootstrap, NgModule, provideZoneChangeDetection } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { UpgradeModule } from '@angular/upgrade/static';
import { ORDERS_APP } from '../legacy/orders.module';
import { appConfigProvider } from './app-config.provider';

/**
 * Hybrid root module. There is no Angular root component: Angular boots
 * first, then hands the page to AngularJS in ngDoBootstrap.
 */
@NgModule({
  imports: [BrowserModule, UpgradeModule],
  // UpgradeModule relies on NgZone to run AngularJS digests after Angular
  // events, so the hybrid app opts back into zone based change detection.
  providers: [provideZoneChangeDetection(), appConfigProvider],
})
export class AppModule implements DoBootstrap {
  constructor(private readonly upgrade: UpgradeModule) {}

  ngDoBootstrap(): void {
    this.upgrade.bootstrap(document.body, [ORDERS_APP], { strictDi: true });
  }
}
