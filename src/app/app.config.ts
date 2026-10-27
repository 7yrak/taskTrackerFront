import { ApplicationConfig, provideBrowserGlobalErrorListeners, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { SpanishDateAdapter } from './core/spanish-date-adapter';
import { SpanishPaginatorIntl } from './core/spanish-paginator-intl';
import { routes } from './app.routes';
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';

registerLocaleData(localeEsAr, 'es-AR');

const ES_DATE_FORMATS = {
  parse: { dateInput: { year: 'numeric', month: 'numeric', day: 'numeric' } },
  display: {
    dateInput: { year: 'numeric', month: '2-digit', day: '2-digit' },
    monthYearLabel: { year: 'numeric', month: 'long' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  }
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    { provide: LOCALE_ID, useValue: 'es-AR' },
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
    { provide: DateAdapter, useClass: SpanishDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: ES_DATE_FORMATS },
    { provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }
  ]
};
