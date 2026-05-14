export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'BLOCKED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TaskComment {
  author: string;
  text: string;
  date: Date | string;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId?: number;
  projectName?: string;
  projectColor?: string;
  assigneeIds?: number[];
  assigneeNames?: string[];
  startDate?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  progressActual: number;
  progressExpected?: number | null;
  parentId?: number | null;
  hasChildren: boolean;
  comments?: TaskComment[];
}

export interface TaskNode extends Task {
  level: number;
  expanded: boolean;
  childrenNodes: TaskNode[];
  hierarchyPath?: string[];
}

export interface TaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: number;
  assigneeIds?: number[];
  startDate?: string;
  dueDate?: string;
  progressActual?: number;
  parentId?: number | null;
  comments?: TaskComment[];
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW: 'En revisión',
  DONE: 'Completada',
  BLOCKED: 'Bloqueada'
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica'
};
