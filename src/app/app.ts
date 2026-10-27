import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
export class App {
  // Instanciarlo aquí aplica el tema guardado también en el login.
  protected readonly theme = inject(ThemeService);
}
