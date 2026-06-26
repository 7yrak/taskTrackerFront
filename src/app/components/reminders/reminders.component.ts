import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { ReminderService } from '../../services/reminder.service';
import { Reminder, ReminderStatus } from '../../models/reminder.model';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ReminderDialogComponent } from './reminder-dialog.component';

@Component({
  selector: 'app-reminders',
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDialogModule, MatSnackBarModule, MatTooltipModule
  ],
  templateUrl: './reminders.component.html',
  styleUrl: './reminders.component.scss'
})
export class RemindersComponent {
  private reminderService = inject(ReminderService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  reminders = signal<Reminder[]>([]);
  editingReminderId = signal<number | null>(null);
  savingReminder = false;
  displayedColumns = ['title', 'status', 'startDate', 'dueDate', 'actions'];

  editForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(180)] }),
    status: new FormControl<ReminderStatus>(ReminderStatus.PENDING, { nonNullable: true }),
    startDate: new FormControl('', { nonNullable: true }),
    dueDate: new FormControl('', { nonNullable: true })
  });

  ngOnInit() {
    this.loadReminders();
  }

  loadReminders() {
    this.reminderService.getAllReminders().subscribe(res => {
      this.reminders.set(res);
    });
  }

  openCreate() {
    this.dialog.open(ReminderDialogComponent, { width: '600px' })
      .afterClosed().subscribe(res => {
        if (res) {
          this.reminderService.createReminder(res).subscribe(() => {
            this.loadReminders();
            this.snack.open('Recordatorio creado', 'OK', { duration: 2500 });
          });
        }
      });
  }

  openEditDialog(reminder: Reminder) {
    this.dialog.open(ReminderDialogComponent, { width: '600px', data: { reminder } })
      .afterClosed().subscribe(res => {
        if (res) {
          this.reminderService.updateReminder(reminder.id!, res).subscribe(() => {
            this.loadReminders();
            this.snack.open('Recordatorio actualizado', 'OK', { duration: 2500 });
          });
        }
      });
  }

  startInlineEdit(reminder: Reminder, event?: MouseEvent) {
    event?.stopPropagation();
    event?.preventDefault();

    this.editingReminderId.set(reminder.id ?? null);
    this.editForm.reset({
      title: reminder.title ?? '',
      status: reminder.status ?? ReminderStatus.PENDING,
      startDate: this.normalizeDate(reminder.startDate),
      dueDate: this.normalizeDate(reminder.dueDate)
    });
  }

  cancelInlineEdit(event?: MouseEvent) {
    event?.stopPropagation();
    event?.preventDefault();

    this.editingReminderId.set(null);
    this.savingReminder = false;
    this.editForm.reset({
      title: '',
      status: ReminderStatus.PENDING,
      startDate: '',
      dueDate: ''
    });
  }

  saveInlineEdit(reminder: Reminder, event?: MouseEvent) {
    event?.stopPropagation();
    event?.preventDefault();

    if (this.savingReminder || reminder.id == null) {
      return;
    }

    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) {
      return;
    }

    const value = this.editForm.getRawValue();
    const payload: Reminder = {
      ...reminder,
      title: value.title.trim(),
      status: value.status,
      startDate: value.startDate || undefined,
      dueDate: value.dueDate || undefined
    };

    this.savingReminder = true;
    this.reminderService.updateReminder(reminder.id, payload).subscribe({
      next: () => {
        this.loadReminders();
        this.editingReminderId.set(null);
        this.snack.open('Recordatorio actualizado', 'OK', { duration: 2500 });
        this.savingReminder = false;
      },
      error: () => {
        this.snack.open('No se pudo actualizar el recordatorio', 'OK', { duration: 2500 });
        this.savingReminder = false;
      }
    });
  }

  delete(id: number) {
    if (confirm('¿Eliminar este recordatorio?')) {
      this.reminderService.deleteReminder(id).subscribe(() => {
        if (this.editingReminderId() === id) {
          this.cancelInlineEdit();
        }
        this.loadReminders();
        this.snack.open('Recordatorio eliminado', 'OK', { duration: 2500 });
      });
    }
  }

  getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      'PENDING': 'Pendiente',
      'IN_PROGRESS': 'En Progreso',
      'COMPLETED': 'Completado',
      'OVERDUE': 'Vencido'
    };
    return labels[status] || status;
  }

  isEditing(reminder: Reminder): boolean {
    return this.editingReminderId() === reminder.id;
  }

  normalizeDate(value?: string): string {
    if (!value) {
      return '';
    }

    const raw = value.includes('T') ? value : `${value}T00:00:00`;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return value.slice(0, 10);
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
