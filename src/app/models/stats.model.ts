export interface Stats {
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  inReviewTasks: number;
  doneTasks: number;
  blockedTasks: number;
  totalProjects: number;
  totalMembers: number;
  overdueTasks: number;
  tasksByProject: ProjectTaskCount[];
  tasksByPriority: Record<string, number>;
}

export interface ProjectTaskCount {
  projectName: string;
  color: string;
  count: number;
  doneCount: number;
}
