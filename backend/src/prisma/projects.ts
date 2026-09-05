import { db } from './db.js';

export async function listProjects() {
  return db.orm.public.Project.all();
}

export async function createProject(
  name: string,
  description: string | undefined,
  status: string,
) {
  return db.orm.public.Project.create({
    name,
    description,
    status,
  });
}

export async function updateProject(
  id: number,
  data: {
    name?: string;
    description?: string;
    status?: string;
  },
) {
  return db.orm.public.Project.where({ id }).update(data);
}

export async function deleteProject(id: number) {
  return db.orm.public.Project.where({ id }).delete();
}

export async function getProjectById(id: number) {
  return db.orm.public.Project.where({ id }).first();
}
