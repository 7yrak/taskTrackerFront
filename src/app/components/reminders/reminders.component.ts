import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReminderService } from '../../services/reminder.service';
import { Reminder, ReminderStatus, ReminderComment } from '../../models/reminder.model';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ReminderDialogComponent } from './reminder-dialog.component';

@Component({
  selector: 'app-reminders',
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatSnackBarModule
  ],
  templateUrl: './reminders.component.html',
  styleUrl: './reminders.component.scss'
})
export class RemindersComponent {
  private reminderService = inject(ReminderService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  reminders = signal<Reminder[]>([]);
  displayedColumns = ['title', 'status', 'startDate', 'dueDate', 'actions'];

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

  openEdit(reminder: Reminder) {
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

  delete(id: number) {
    if (confirm('¿Eliminar este recordatorio?')) {
      this.reminderService.deleteReminder(id).subscribe(() => {
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
}
