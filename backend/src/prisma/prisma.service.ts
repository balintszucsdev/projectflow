import { Injectable } from '@nestjs/common';
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

  createProject(name: string, description: string | undefined, status: string) {
    return createProject(name, description, status);
  }

  updateProject(
    id: number,
    data: {
      name?: string;
      description?: string;
      status?: string;
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
