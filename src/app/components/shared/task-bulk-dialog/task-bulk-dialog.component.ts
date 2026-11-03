import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Task, TaskBulkUpdateRequest, TaskStatus, TaskPriority, STATUS_LABELS, PRIORITY_LABELS } from '../../../models/task.model';
import { Member } from '../../../models/member.model';
import { TaskService } from '../../../services/task.service';

@Component({
  selector: 'app-task-bulk-dialog',
  imports: [CommonModule, FormsModule, MatDialogModule, MatCheckboxModule, MatFormFieldModule,
    MatSelectModule, MatInputModule, MatButtonModule, MatIconModule],
  templateUrl: './task-bulk-dialog.component.html',
  styleUrl: './task-bulk-dialog.component.scss',
})
export class TaskBulkDialogComponent {
  readonly data = inject<{ tasks: Task[]; members: Member[] }>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<TaskBulkDialogComponent>);
  private api = inject(TaskService);
  readonly statusLabels = STATUS_LABELS;
  readonly priorityLabels = PRIORITY_LABELS;
  readonly statuses = Object.keys(STATUS_LABELS) as TaskStatus[];
  readonly priorities = Object.keys(PRIORITY_LABELS) as TaskPriority[];
  statusEnabled = false; status: TaskStatus = 'IN_PROGRESS';
  priorityEnabled = false; priority: TaskPriority = 'MEDIUM';
  assigneesEnabled = false; assigneeIds: number[] = [];
  startEnabled = false; startDate = '';
  dueEnabled = false; dueDate = '';
  preview = signal(false);
  saving = signal(false);
  error = signal('');
  changes = signal<string[]>([]);

  get hasChanges() { return this.statusEnabled || this.priorityEnabled || this.assigneesEnabled || this.startEnabled || this.dueEnabled; }
  review() {
    this.error.set('');
    if (!this.hasChanges || !this.data.tasks.length || this.data.tasks.length > 500) return;
    for (const task of this.data.tasks) {
      const start = this.startEnabled ? this.startDate : task.startDate;
      const due = this.dueEnabled ? this.dueDate : task.dueDate;
      if (start && due && start > due) { this.error.set(`La fecha de inicio queda después del vencimiento de «${task.title}». Ajusta ambas fechas.`); return; }
    }
    const changes: string[] = [];
    if (this.statusEnabled) changes.push(`Estado: ${STATUS_LABELS[this.status]}`);
    if (this.priorityEnabled) changes.push(`Prioridad: ${PRIORITY_LABELS[this.priority]}`);
    if (this.assigneesEnabled) changes.push(`Responsables: ${this.assigneeIds.length ? this.data.members.filter(m => this.assigneeIds.includes(m.id)).map(m => m.name).join(', ') : 'Sin asignar'}`);
    if (this.startEnabled) changes.push(`Inicio: ${this.startDate ? this.startDate.split('-').reverse().join('/') : 'Quitar fecha'}`);
    if (this.dueEnabled) changes.push(`Vencimiento: ${this.dueDate ? this.dueDate.split('-').reverse().join('/') : 'Quitar fecha'}`);
    this.changes.set(changes); this.preview.set(true);
  }
  save() {
    if (this.saving() || !this.preview()) return;
    const request: TaskBulkUpdateRequest = { taskIds: this.data.tasks.map(t => t.id) };
    if (this.statusEnabled) request.status = this.status;
    if (this.priorityEnabled) request.priority = this.priority;
    if (this.assigneesEnabled) { request.updateAssignees = true; request.assigneeIds = this.assigneeIds; }
    if (this.startEnabled) { request.updateStartDate = true; request.startDate = this.startDate || null; }
    if (this.dueEnabled) { request.updateDueDate = true; request.dueDate = this.dueDate || null; }
    this.saving.set(true); this.error.set(''); this.ref.disableClose = true;
    this.api.bulkUpdate(request).subscribe({
      next: tasks => this.ref.close(tasks),
      error: error => { this.error.set(error.error?.message || 'No se pudieron guardar los cambios. Se conservaron las tareas anteriores.'); this.saving.set(false); this.ref.disableClose = false; },
    });
  }
}
