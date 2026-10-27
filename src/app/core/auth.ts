import { DOCUMENT } from '@angular/common';
import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface AuthSession { username: string; }
interface CsrfToken { headerName: string; token: string; }

/** Ruta interna segura para volver tras el login (evita redirecciones abiertas). */
export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.length > 512) return '/dashboard';
  return value.startsWith('/acceso') ? '/dashboard' : value;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly document = inject(DOCUMENT);
  private readonly http = inject(HttpClient);
  private readonly base = new URL('./', this.document.baseURI);
  readonly account = signal<AuthSession | null>(null);

  endpoint(path: string) { return new URL(path, this.base).toString(); }

  csrf() { return this.http.get<CsrfToken>(this.endpoint('auth/csrf')); }

  session() {
    return this.http.get<AuthSession>(this.endpoint('auth/session')).pipe(tap(value => this.account.set(value)));
  }

  login(username: string, password: string) {
    const body = new URLSearchParams({ username, password }).toString();
    return this.csrf().pipe(
      switchMap(csrf => this.http.post(this.endpoint('auth/login'), body, {
        headers: { [csrf.headerName]: csrf.token, 'Content-Type': 'application/x-www-form-urlencoded' },
      })),
      switchMap(() => this.session()),
    );
  }

  logout() {
    return this.csrf().pipe(
      switchMap(csrf => this.http.post(this.endpoint('auth/logout'), null, { headers: { [csrf.headerName]: csrf.token } })),
      map(() => { this.account.set(null); }),
    );
  }
}

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  return auth.session().pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/acceso'], { queryParams: state.url === '/' ? {} : { volver: state.url } }))),
  );
};

/** Añade el token CSRF a las escrituras y devuelve al login cuando la sesión expira. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const raw = new HttpClient(inject(HttpBackend));
  const api = API_BASE_URL.replace(/\/$/, '');
  if (!(request.url === api || request.url.startsWith(api + '/'))) return next(request);
  const send = ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
    ? next(request)
    : raw.get<CsrfToken>(auth.endpoint('auth/csrf')).pipe(
        switchMap(csrf => next(request.clone({ setHeaders: { [csrf.headerName]: csrf.token } }))),
      );
  return send.pipe(catchError((error: HttpErrorResponse) => {
    if (error.status === 401) {
      auth.account.set(null);
      void router.navigate(['/acceso'], { queryParams: { estado: 'expirada', volver: safeReturnUrl(router.url) } });
    }
    return throwError(() => error);
  }));
};
