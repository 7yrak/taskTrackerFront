import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ProjectService } from '../../services/project.service';
import { Project, ProjectStatus } from '../../models/project.model';
import { ProjectDialogComponent } from '../shared/project-dialog/project-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.INITIATED]: 'Iniciado',
  [ProjectStatus.PLANNING]: 'Planificación',
  [ProjectStatus.IN_PROGRESS]: 'En Ejecución',
  [ProjectStatus.ON_HOLD]: 'Detenido',
  [ProjectStatus.MONITORING]: 'Seguimiento y Control',
  [ProjectStatus.COMPLETED]: 'Finalizado',
  [ProjectStatus.CLOSED]: 'Cerrado'
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  [ProjectStatus.INITIATED]: '#64748B',
  [ProjectStatus.PLANNING]: '#3B82F6',
  [ProjectStatus.IN_PROGRESS]: '#F59E0B',
  [ProjectStatus.ON_HOLD]: '#EF4444',
  [ProjectStatus.MONITORING]: '#8B5CF6',
  [ProjectStatus.COMPLETED]: '#10B981',
  [ProjectStatus.CLOSED]: '#1E293B'
};

@Component({
  selector: 'app-projects',
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatProgressBarModule, MatMenuModule,
    MatSnackBarModule, MatTooltipModule,
    MatSelectModule, MatFormFieldModule
  ],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent {
  private projectService = inject(ProjectService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  private refresh$ = new Subject<void>();
  recentlyUpdatedProjectIds = signal<Set<number>>(new Set());

  projects = toSignal(
    this.refresh$.pipe(
      startWith(undefined),
      switchMap(() => this.projectService.getAll())
    ),
    { initialValue: [] as Project[] }
  );

  // Signal para almacenar el filtro actual
  selectedStatusFilter = signal<ProjectStatus | 'ALL'>('ALL');

  // Lista de proyectos filtrada y reactiva
  filteredProjects = computed(() => {
    const status = this.selectedStatusFilter();
    const allProjects = this.projects();
    
    if (status === 'ALL') return allProjects;
    return allProjects.filter(p => p.status === status);
  });

  statusLabels = PROJECT_STATUS_LABELS;
  statusColors = PROJECT_STATUS_COLORS;

  getStatuses(): ProjectStatus[] {
    return [
      ProjectStatus.INITIATED, 
      ProjectStatus.PLANNING, 
      ProjectStatus.IN_PROGRESS, 
      ProjectStatus.ON_HOLD, 
      ProjectStatus.MONITORING, 
      ProjectStatus.COMPLETED, 
      ProjectStatus.CLOSED
    ];
  }

  changeProjectStatus(project: Project, newStatus: ProjectStatus) {
    if (project.status === newStatus) return;

    const oldStatus = project.status;
    project.status = newStatus; // Actualizamos la UI inmediatamente

    const updatePayload = {
      name: project.name,
      description: project.description ?? undefined,
      color: project.color ?? undefined,
      status: newStatus
    };

    this.projectService.update(project.id, updatePayload).subscribe({
      next: () => {
        this.flashProject(project.id);
        this.openInfoSnack('Estado del proyecto actualizado', 'success');
      },
      error: (err) => {
        project.status = oldStatus; // Revertir si hay error
        this.openInfoSnack('Error al guardar en el servidor', 'error');
      }
    });
  }

  openCreate() {
    this.dialog.open(ProjectDialogComponent, { width: '480px', data: null })
      .afterClosed().subscribe(result => {
        if (result) {
          this.projectService.create(result).subscribe({
            next: () => { this.refresh$.next(); this.openInfoSnack('Proyecto creado', 'success'); },
            error: (e) => this.openInfoSnack(e.error?.message || 'Error', 'error')
          });
        }
      });
  }

  openEdit(project: Project) {
    this.dialog.open(ProjectDialogComponent, { width: '480px', data: project })
      .afterClosed().subscribe(result => {
        if (result) {
          this.projectService.update(project.id, result).subscribe({
            next: () => { this.refresh$.next(); this.flashProject(project.id); this.openInfoSnack('Proyecto actualizado', 'success'); },
            error: (e) => this.openInfoSnack(e.error?.message || 'Error', 'error')
          });
        }
      });
  }

  confirmDelete(project: Project) {
    this.dialog.open(ConfirmDialogComponent, {
      data: { message: `¿Eliminar el proyecto "${project.name}"? Se perderán todas sus tareas.` }
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.projectService.delete(project.id).subscribe({
          next: () => { this.refresh$.next(); this.openInfoSnack('Proyecto eliminado', 'warning'); },
          error: (e) => this.openInfoSnack(e.error?.message || 'Error', 'error')
        });
      }
    });
  }

  getProgress(project: Project): number {
    return project.progressActual ?? 0;
  }

  private flashProject(projectId: number) {
    this.recentlyUpdatedProjectIds.update(set => {
      const next = new Set(set);
      next.add(projectId);
      return next;
    });
    setTimeout(() => {
      this.recentlyUpdatedProjectIds.update(set => {
        const next = new Set(set);
        next.delete(projectId);
        return next;
      });
    }, 1600);
  }

  isRecentlyUpdated(projectId: number): boolean {
    return this.recentlyUpdatedProjectIds().has(projectId);
  }

  private openInfoSnack(message: string, tone: 'success' | 'warning' | 'error' | 'info' = 'info') {
    this.snack.open(message, 'OK', {
      duration: 2500,
      panelClass: [`snack-${tone}`]
    });
  }
}
