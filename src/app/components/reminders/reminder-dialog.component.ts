import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { ReminderService } from '../../services/reminder.service';
import { ReminderStatus } from '../../models/reminder.model';
import { SpanishDateAdapter } from '../../core/spanish-date-adapter';

@Component({
  selector: 'app-reminder-dialog',
  imports: [
    CommonModule, FormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatDatepickerModule, MatNativeDateModule
  ],
  providers: [
    { provide: DateAdapter, useClass: SpanishDateAdapter },
    { provide: MAT_DATE_LOCALE, useValue: 'es-ES' }
  ],
  template: `
    <h2 mat-dialog-title>{{ data?.reminder ? 'Editar Recordatorio' : 'Nuevo Recordatorio' }}</h2>
    <mat-dialog-content style="display: flex; flex-direction: column; gap: 16px; padding-top: 16px;">
      <mat-form-field appearance="outline">
        <mat-label>Título</mat-label>
        <input matInput [(ngModel)]="form.title" required />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Descripción</mat-label>
        <textarea matInput [(ngModel)]="form.description" rows="3"></textarea>
      </mat-form-field>

      <div style="display: flex; gap: 16px;">
        <mat-form-field appearance="outline" style="flex: 1;">
          <mat-label>Estado</mat-label>
          <mat-select [(ngModel)]="form.status">
            <mat-option value="PENDING">Pendiente</mat-option>
            <mat-option value="IN_PROGRESS">En Progreso</mat-option>
            <mat-option value="COMPLETED">Completado</mat-option>
            <mat-option value="OVERDUE">Vencido</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div style="display: flex; gap: 16px;">
        <mat-form-field appearance="outline" style="flex: 1;">
          <mat-label>Fecha de Inicio</mat-label>
          <input matInput [matDatepicker]="pickerStart" [(ngModel)]="startDate" />
          <mat-datepicker-toggle matIconSuffix [for]="pickerStart"></mat-datepicker-toggle>
          <mat-datepicker #pickerStart></mat-datepicker>
        </mat-form-field>
        <mat-form-field appearance="outline" style="flex: 1;">
          <mat-label>Fecha de Vencimiento</mat-label>
          <input matInput [matDatepicker]="pickerDue" [(ngModel)]="dueDate" />
          <mat-datepicker-toggle matIconSuffix [for]="pickerDue"></mat-datepicker-toggle>
          <mat-datepicker #pickerDue></mat-datepicker>
        </mat-form-field>
      </div>

      @if (data?.reminder) {
        <div style="margin-top: 16px;">
          <h3>Comentarios</h3>
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <mat-form-field appearance="outline" style="flex: 1; margin-bottom: -1.25em;">
              <input matInput placeholder="Nuevo comentario..." [(ngModel)]="newComment" />
            </mat-form-field>
            <button mat-icon-button color="primary" (click)="addComment()" style="margin-top: 8px;">
              <mat-icon>send</mat-icon>
            </button>
          </div>
          <div style="max-height: 150px; overflow-y: auto;">
            @for (c of data.reminder.comments; track c.id) {
              <div style="background: #F8FAFC; padding: 8px 12px; border-radius: 8px; margin-bottom: 8px; font-size: 13px;">
                <div style="color: #64748B; font-size: 11px; margin-bottom: 4px;">{{ c.date | date:'short' }}</div>
                <div>{{ c.text }}</div>
              </div>
            }
          </div>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="!form.title">Guardar</button>
    </mat-dialog-actions>
  `
})
export class ReminderDialogComponent {
  data = inject(MAT_DIALOG_DATA);
  private reminderService = inject(ReminderService);
  private dialogRef = inject(MatDialogRef<ReminderDialogComponent>);

  form = {
    title: '',
    description: '',
    status: ReminderStatus.PENDING
  };

  startDate: Date | null = null;
  dueDate: Date | null = null;
  newComment = '';

  ngOnInit() {
    if (this.data?.reminder) {
      this.form = {
        title: this.data.reminder.title,
        description: this.data.reminder.description || '',
        status: this.data.reminder.status
      };
      
      this.startDate = this.data.reminder.startDate ? new Date(this.data.reminder.startDate + 'T00:00:00') : null;
      this.dueDate = this.data.reminder.dueDate ? new Date(this.data.reminder.dueDate + 'T00:00:00') : null;
    }
  }

  save() {
    const formatDate = (d: Date | null) => {
      if (!d) return undefined;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    this.dialogRef.close({
      ...this.form,
      startDate: formatDate(this.startDate),
      dueDate: formatDate(this.dueDate)
    });
  }

  addComment() {
    if (!this.newComment.trim() || !this.data.reminder?.id) return;
    this.reminderService.addComment(this.data.reminder.id, { text: this.newComment }).subscribe(updatedReminder => {
      this.data.reminder.comments = updatedReminder.comments;
      this.newComment = '';
    });
  }
}
