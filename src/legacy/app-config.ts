/** Legacy configuration, still owned by AngularJS. Angular reads it through an upgraded provider. */
export interface AppConfig {
  currency: string;
  currencySymbol: string;
}

export const APP_CONFIG_NAME = 'appConfig';

export const appConfig: AppConfig = {
  currency: 'EUR',
  currencySymbol: '€',
};
