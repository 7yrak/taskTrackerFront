import { DOCUMENT } from '@angular/common';
import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface KovaSession { organizationName: string; organizationId: string; role: string; status: string; }
@Injectable({ providedIn: 'root' })
export class KovaAuth {
  private readonly document = inject(DOCUMENT);
  private readonly http = inject(HttpClient);
  readonly pilot = true; // Every deployment requires KOVA, including the private installation.
  readonly account = signal<KovaSession | null>(null);
  private readonly base = new URL('./', this.document.baseURI);
  endpoint(path: string) { return new URL(path, this.base).toString(); }
  session() {
    return this.http.get<KovaSession>(this.endpoint('auth/session')).pipe(
      map(value => { this.account.set(value); return value; }),
    );
  }
  login() { this.document.location.assign(this.endpoint('oauth2/authorization/kova')); }
  logout() {
    return this.http.get<{headerName: string; token: string}>(this.endpoint('auth/csrf')).pipe(
      switchMap(csrf => this.http.post(this.endpoint('auth/logout'), null, {
        headers: { [csrf.headerName]: csrf.token },
      })),
      map(() => { this.account.set(null); }),
    );
  }
}

export const kovaGuard: CanActivateFn = () => {
  const auth = inject(KovaAuth);
  const router = inject(Router);
    return auth.session().pipe(map(() => true), catchError(() => of(router.createUrlTree(['/acceso']))));
};

export const kovaInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(KovaAuth);
  const router = inject(Router);
  const raw = new HttpClient(inject(HttpBackend));
  const api = API_BASE_URL.replace(/\/$/, '');
  if (!auth.pilot || !(request.url === api || request.url.startsWith(api + '/'))) return next(request);
  const submit = ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
    ? next(request)
    : raw.get<{headerName: string; token: string}>(auth.endpoint('auth/csrf')).pipe(
        switchMap(csrf => next(request.clone({ setHeaders: { [csrf.headerName]: csrf.token } }))),
      );
  return submit.pipe(catchError((error: HttpErrorResponse) => {
    if (error.status === 401 || error.status === 403) {
      auth.account.set(null);
      void router.navigate(['/acceso'], { queryParams: { estado: 'denegado' } });
    }
    return throwError(() => error);
  }));
};
