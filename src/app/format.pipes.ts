import { Pipe, PipeTransform, inject } from '@angular/core';
import { APP_CONFIG } from './app-config.provider';

/**
 * Small Intl based pipes instead of CurrencyPipe and DatePipe: the browser
 * already ships the formatting rules, so @angular/common stays out of the
 * bundle. Pure pipes, so each value is formatted once per change.
 */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private readonly format = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: inject(APP_CONFIG).currency,
  });

  transform(value: number): string {
    return this.format.format(value);
  }
}

/** Formats an ISO date (yyyy-mm-dd) as "2 Nov 2026", independent of the visitor's time zone. */
@Pipe({ name: 'longDate' })
export class LongDatePipe implements PipeTransform {
  private static readonly format = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  transform(isoDate: string): string {
    return LongDatePipe.format.format(new Date(isoDate));
  }
}
