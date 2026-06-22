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
  staleTasks7Days: number;
  staleTasks14Days: number;
  staleTasks30Days: number;
  blockedAverageAgeDays: number;
  blockedMaxAgeDays: number;
  tasksByProject: ProjectTaskCount[];
  tasksByPriority: Record<string, number>;
  cycleTimeByStatus: StatusCycleCount[];
  memberLoad: MemberLoadCount[];
  slaByProject: ProjectSlaCount[];
  slaByMember: MemberSlaCount[];
}

export interface ProjectTaskCount {
  projectName: string;
  color: string;
  count: number;
  doneCount: number;
}

export interface StatusCycleCount {
  status: string;
  averageDays: number;
  taskCount: number;
}

export interface MemberLoadCount {
  memberName: string;
  taskCount: number;
  blockedTasks: number;
  overdueTasks: number;
  averageAgeDays: number;
}

export interface ProjectSlaCount {
  projectName: string;
  color: string;
  completedTasks: number;
  onTimeTasks: number;
  slaPercent: number;
}

export interface MemberSlaCount {
  memberName: string;
  completedTasks: number;
  onTimeTasks: number;
  slaPercent: number;
}
