import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project.model';
import { ProjectDialogComponent } from '../shared/project-dialog/project-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-projects',
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatProgressBarModule,
    MatSnackBarModule, MatTooltipModule
  ],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent {
  private projectService = inject(ProjectService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  private refresh$ = new Subject<void>();

  projects = toSignal(
    this.refresh$.pipe(
      startWith(undefined),
      switchMap(() => this.projectService.getAll())
    ),
    { initialValue: [] as Project[] }
  );

  openCreate() {
    this.dialog.open(ProjectDialogComponent, { width: '480px', data: null })
      .afterClosed().subscribe(result => {
        if (result) {
          this.projectService.create(result).subscribe({
            next: () => { this.refresh$.next(); this.snack.open('Proyecto creado', 'OK', { duration: 2500 }); },
            error: (e) => this.snack.open(e.error?.message || 'Error', 'OK', { duration: 3000 })
          });
        }
      });
  }

  openEdit(project: Project) {
    this.dialog.open(ProjectDialogComponent, { width: '480px', data: project })
      .afterClosed().subscribe(result => {
        if (result) {
          this.projectService.update(project.id, result).subscribe({
            next: () => { this.refresh$.next(); this.snack.open('Proyecto actualizado', 'OK', { duration: 2500 }); },
            error: (e) => this.snack.open(e.error?.message || 'Error', 'OK', { duration: 3000 })
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
          next: () => { this.refresh$.next(); this.snack.open('Proyecto eliminado', 'OK', { duration: 2500 }); },
          error: (e) => this.snack.open(e.error?.message || 'Error', 'OK', { duration: 3000 })
        });
      }
    });
  }

  getProgress(project: Project): number {
    return project.progressActual ?? 0;
  }
}
