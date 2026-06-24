import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Task, PRIORITY_LABELS, STATUS_LABELS } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Member } from '../../models/member.model';
import { TaskService } from '../../services/task.service';
import { TaskDialogComponent } from '../shared/task-dialog/task-dialog.component';

export type DashboardTaskBucket = 'global' | 'blocked' | 'behind' | 'overdue' | 'active' | 'done';

export interface DashboardTaskBucketDialogData {
  title: string;
  subtitle?: string;
  bucket: DashboardTaskBucket;
  tasks: Task[];
  projects: Project[];
  members: Member[];
  allTasks: Task[];
  emptyText: string;
  onSaved?: () => void;
}

@Component({
  selector: 'app-dashboard-tasks-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatSnackBarModule,
    DatePipe
  ],
  template: `
    <div class="bucket-dialog">
      <div class="bucket-header">
        <div>
          <div class="bucket-kicker">Detalle de tarjeta</div>
          <h2 mat-dialog-title>{{ data.title }}</h2>
          @if (data.subtitle) {
            <p class="bucket-subtitle">{{ data.subtitle }}</p>
          }
        </div>
        <button mat-icon-button mat-dialog-close aria-label="Cerrar">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div mat-dialog-content class="bucket-content">
        @if (data.tasks.length === 0) {
          <div class="empty-state">
            <mat-icon>inbox</mat-icon>
            <p>{{ data.emptyText }}</p>
          </div>
        } @else {
          <div class="task-list">
            @for (task of data.tasks; track task.id) {
              <article class="task-row">
                <div class="task-main">
                  <div class="task-title-row">
                    <strong>{{ task.title }}</strong>
                    <span class="status-chip" [ngClass]="task.status">{{ statusLabel(task.status) }}</span>
                  </div>
                  <div class="task-meta">
                    <span class="project-pill" [style.border-color]="task.projectColor || '#CBD5E1'">
                      <span class="dot" [style.background]="task.projectColor || '#94A3B8'"></span>
                      {{ task.projectName ?? 'Sin proyecto' }}
                    </span>
                    <span>{{ (task.assigneeNames ?? []).length > 0 ? (task.assigneeNames ?? []).join(', ') : 'Sin asignar' }}</span>
                    <span>{{ task.priority ? priorityLabel(task.priority) : 'Sin prioridad' }}</span>
                  </div>
                  <div class="progress-line">
                    <mat-progress-bar mode="determinate" [value]="task.progressActual || 0"></mat-progress-bar>
                    <span>{{ task.progressActual || 0 }}%</span>
                  </div>
                </div>

                <div class="task-side">
                  <div class="dates">
                    <span><mat-icon>event</mat-icon> {{ task.startDate ? (task.startDate | date:'dd/MM/yy') : 'Sin inicio' }}</span>
                    <span><mat-icon>schedule</mat-icon> {{ task.dueDate ? (task.dueDate | date:'dd/MM/yy') : 'Sin vencimiento' }}</span>
                  </div>
                  <button mat-stroked-button color="primary" (click)="editTask(task)">
                    <mat-icon>edit</mat-icon>
                    Editar
                  </button>
                </div>
              </article>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .bucket-dialog { width: min(1120px, calc(100vw - 32px)); }
    .bucket-header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
      padding: 6px 4px 14px;
    }
    .bucket-kicker {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #64748B;
      margin-bottom: 4px;
    }
    h2 {
      margin: 0;
      font-size: 24px;
    }
    .bucket-subtitle {
      margin: 6px 0 0;
      color: #64748B;
      font-size: 14px;
    }
    .bucket-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: min(72vh, 780px);
      padding: 0 4px 4px;
    }
    .task-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: auto;
      padding-right: 4px;
    }
    .task-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      padding: 14px 16px;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.95));
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
    }
    .task-main {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .task-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .task-title-row strong {
      font-size: 15px;
      color: #0F172A;
    }
    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      border: 1px solid #CBD5E1;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: #F8FAFC;
      color: #334155;
    }
    .status-chip.DONE { background: #ECFDF5; color: #047857; border-color: #A7F3D0; }
    .status-chip.BLOCKED { background: #FEF2F2; color: #B91C1C; border-color: #FECACA; }
    .status-chip.IN_PROGRESS { background: #FFF7ED; color: #C2410C; border-color: #FED7AA; }
    .status-chip.IN_REVIEW { background: #F5F3FF; color: #6D28D9; border-color: #DDD6FE; }
    .status-chip.TODO { background: #EFF6FF; color: #1D4ED8; border-color: #BFDBFE; }
    .status-chip.STOPPED { background: #F1F5F9; color: #475569; border-color: #CBD5E1; }
    .task-meta {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      color: #64748B;
      font-size: 12px;
    }
    .project-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid;
      background: #FFFFFF;
      color: #0F172A;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      flex-shrink: 0;
    }
    .progress-line {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #334155;
      font-size: 12px;
    }
    .progress-line mat-progress-bar {
      flex: 1;
      min-width: 160px;
    }
    .task-side {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-end;
      min-width: 180px;
    }
    .dates {
      display: flex;
      flex-direction: column;
      gap: 6px;
      color: #475569;
      font-size: 12px;
    }
    .dates span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      justify-content: flex-end;
    }
    .dates mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .empty-state {
      padding: 42px 24px;
      text-align: center;
      color: #64748B;
      border: 1px dashed #CBD5E1;
      border-radius: 16px;
      background: #F8FAFC;
    }
    .empty-state mat-icon {
      font-size: 38px;
      width: 38px;
      height: 38px;
      margin-bottom: 8px;
      opacity: 0.35;
    }
    .empty-state p {
      margin: 0;
    }
    @media (max-width: 860px) {
      .task-row { grid-template-columns: 1fr; }
      .task-side { align-items: flex-start; min-width: 0; }
      .dates span { justify-content: flex-start; }
    }
  `]
})
export class DashboardTasksDialogComponent {
  data: DashboardTaskBucketDialogData = inject(MAT_DIALOG_DATA);
  private taskService = inject(TaskService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  statusLabel(status: Task['status']): string {
    return STATUS_LABELS[status] ?? status;
  }

  priorityLabel(priority: Task['priority']): string {
    return PRIORITY_LABELS[priority] ?? priority;
  }

  editTask(task: Task) {
    this.dialog.open(TaskDialogComponent, {
      width: '1000px',
      maxWidth: '95vw',
      maxHeight: '95vh',
      data: { task, projects: this.data.projects, members: this.data.members, allTasks: this.data.allTasks }
    }).afterClosed().subscribe(result => {
      if (!result) return;
      this.taskService.update(task.id, result).subscribe({
        next: (updated) => {
          Object.assign(task, updated);
          this.data.onSaved?.();
          this.snack.open('Tarea actualizada', 'OK', { duration: 2500 });
        },
        error: (e) => this.snack.open(e?.error?.message || 'Error al actualizar', 'OK', { duration: 3000 })
      });
    });
  }
}
