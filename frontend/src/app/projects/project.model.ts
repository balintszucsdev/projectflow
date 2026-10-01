export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description: string | null;
  status: string;
}

export type UpdateProjectRequest = Partial<CreateProjectRequest>;
