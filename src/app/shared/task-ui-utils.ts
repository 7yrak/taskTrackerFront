import { TaskStatus, TaskPriority, STATUS_LABELS, PRIORITY_LABELS } from '../models/task.model';
import { ProjectStatus } from '../models/project.model';

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'STOPPED'];
export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.INITIATED,
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.ON_HOLD,
  ProjectStatus.MONITORING,
  ProjectStatus.COMPLETED,
  ProjectStatus.CLOSED
];

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
  [ProjectStatus.PLANNING]: '#2563EB',
  [ProjectStatus.IN_PROGRESS]: '#0E7490',
  [ProjectStatus.ON_HOLD]: '#DC2626',
  [ProjectStatus.MONITORING]: '#7C3AED',
  [ProjectStatus.COMPLETED]: '#047857',
  [ProjectStatus.CLOSED]: '#1E293B'
};

export { STATUS_LABELS, PRIORITY_LABELS };

export function parseIsoDateLike(value?: string | null): Date | null {
  if (!value) return null;
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
