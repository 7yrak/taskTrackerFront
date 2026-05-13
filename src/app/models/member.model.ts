export interface Member {
  id: number;
  name: string;
  email: string;
  role?: string;
  createdAt: string;
  projectNames: string[];
  taskCount: number;
}

export interface MemberRequest {
  name: string;
  email: string;
  role?: string;
}
