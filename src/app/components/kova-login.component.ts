import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { KovaAuth } from '../core/kova-auth';

@Component({
  standalone: true,
  selector: 'app-kova-login',
  template: `
    <main class="access">
      <section>
        <p class="eyebrow">TASKTRACKER · KOVA</p>
        <h1>Tu trabajo, conectado.</h1>
        <p>Ingresa con tu cuenta KOVA para acceder al espacio de tu organización.</p>
        @if (denied) {
          <p role="alert">No se pudo autorizar el acceso. Comprueba que tu cuenta tenga acceso a esta instalación en KOVA.</p>
        }
        @if (error()) { <p role="alert">{{ error() }}</p> }
        <button type="button" (click)="login()">Ingresar con KOVA</button>
        <a href="/kova/portal">Volver a Mis productos</a>
        <small>El acceso a esta instalación se autoriza desde tu cuenta KOVA.</small>
      </section>
    </main>
  `,
  styles: [`
    .access{min-height:100vh;display:grid;place-items:center;padding:24px;background:#edf2fa;color:#14243c}
    section{max-width:510px;background:white;padding:40px;border-radius:20px;box-shadow:0 20px 70px #183c651a}
    .eyebrow{color:#1463d4;letter-spacing:.18em;font-size:12px}h1{font-size:36px;line-height:1.1}
    p{line-height:1.6}button{background:#155ad7;color:white;border:0;border-radius:8px;padding:15px 22px;font:inherit;cursor:pointer}
    a,small{display:block;margin-top:22px}a{color:#155ad7}small{color:#52637b}
    [role=alert]{background:#fff1ee;padding:14px;border-radius:8px;color:#9c2919}
  `],
})
export class KovaLogin {
  readonly auth = inject(KovaAuth);
  readonly denied = inject(ActivatedRoute).snapshot.queryParamMap.get('estado') === 'denegado';
  readonly error = signal('');
  login() { this.auth.login(); }
}
