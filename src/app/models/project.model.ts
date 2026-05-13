export interface Project {
  id: number;
  name: string;
  description?: string;
  color: string;
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
}
