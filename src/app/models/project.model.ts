export enum ProjectStatus {
  INITIATED = 'INITIATED',
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  MONITORING = 'MONITORING',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED'
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  color: string;
  status: ProjectStatus;
  createdAt: string;
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  memberCount: number;
  progressActual?: number;
  progressExpected?: number;
}

export interface ProjectRequest {
  name: string;
  description?: string;
  color?: string;
  status?: ProjectStatus;
}

export interface ProjectDetail {
  project: Project;
  tasks: import('./task.model').Task[];
  members: import('./member.model').Member[];
  incidents: import('./incident.model').Incident[];
  overtime: { id: number; date: string; person: string; hours: number; topic: string; sentToManagement: boolean }[];
}
