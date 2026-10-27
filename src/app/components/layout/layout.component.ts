import { Component, inject } from '@angular/core';
import { Auth } from '../../core/auth';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../../services/theme.service';
import { LogoComponent } from '../shared/logo/logo.component';

@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule,
    MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule,
    LogoComponent
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  theme = inject(ThemeService);
  readonly auth = inject(Auth);
  private router = inject(Router);

  get initial(): string {
    return (this.auth.account()?.username ?? '?').charAt(0).toUpperCase();
  }

  logout() {
    this.auth.logout().subscribe({ next: () => void this.router.navigateByUrl('/acceso') });
  }

  navItems = [
    { label: 'Dashboard',     icon: 'dashboard',     route: '/dashboard' },
    { label: 'Proyectos',     icon: 'folder',        route: '/projects' },
    { label: 'Tareas',        icon: 'task_alt',      route: '/tasks' },
    { label: 'Horas extras', icon: 'more_time', route: '/overtime' },
    { label: 'Incidentes',   icon: 'bug_report',    route: '/incidents' },
    { label: 'Equipo',        icon: 'group',         route: '/team' },
    { label: 'Recordatorios', icon: 'notifications', route: '/reminders' }
  ];

  isTasksRoute(): boolean {
    return this.router.url.includes('/tasks');
  }
  isOvertimeRoute(): boolean {
    return this.router.url.split('?')[0] === '/overtime';
  }
}
