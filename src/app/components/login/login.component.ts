import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Auth, safeReturnUrl } from '../../core/auth';
import { LogoComponent } from '../shared/logo/logo.component';

@Component({
  selector: 'app-login',
  imports: [FormsModule, MatIconModule, LogoComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  username = '';
  password = '';
  readonly showPassword = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = this.route.snapshot.queryParamMap.get('estado') === 'expirada'
    ? 'Tu sesión expiró. Ingresa de nuevo para continuar.' : '';

  submit() {
    if (this.busy() || !this.username.trim() || !this.password) return;
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.username.trim(), this.password).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('volver'))),
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.password = '';
        this.error.set(e.status === 429
          ? 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.'
          : e.status === 401 ? 'Usuario o contraseña incorrectos.'
          : 'No se pudo conectar con el servidor. Inténtalo nuevamente.');
      },
    });
  }
}
