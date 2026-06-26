import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../../services/theme.service';
import { LogoComponent } from '../shared/logo/logo.component';

@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule,
    MatIconModule, MatButtonModule, MatTooltipModule,
    LogoComponent
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  theme = inject(ThemeService);

  navItems = [
    { label: 'Dashboard',     icon: 'dashboard',     route: '/dashboard' },
    { label: 'Proyectos',     icon: 'folder',        route: '/projects' },
    { label: 'Tareas',        icon: 'task_alt',      route: '/tasks' },
    { label: 'Equipo',        icon: 'group',         route: '/team' },
    { label: 'Recordatorios', icon: 'notifications', route: '/reminders' }
  ];
}
