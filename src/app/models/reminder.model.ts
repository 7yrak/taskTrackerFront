export enum ReminderStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE'
}

export interface ReminderComment {
  id?: number;
  text: string;
  date?: string;
}

export interface Reminder {
  id?: number;
  title: string;
  description?: string;
  status: ReminderStatus;
  startDate?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  comments?: ReminderComment[];
}