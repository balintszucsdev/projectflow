import { Injectable } from '@nestjs/common';
import { ProjectStatus } from '../projects/project-status.enum.js';
import {
  createProject,
  listProjects,
  updateProject,
  deleteProject,
  getProjectById,
} from './projects.js';

@Injectable()
export class PrismaService {
  listProjects() {
    return listProjects();
  }

  createProject(
    name: string,
    description: string | undefined,
    status: ProjectStatus,
  ) {
    return createProject(name, description, status);
  }

  updateProject(
    id: number,
    data: {
      name?: string;
      description?: string;
      status?: ProjectStatus;
    },
  ) {
    return updateProject(id, data);
  }

  deleteProject(id: number) {
    return deleteProject(id);
  }

  getProjectById(id: number) {
    return getProjectById(id);
  }
}
