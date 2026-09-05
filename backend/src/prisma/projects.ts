import { db } from './db.js';

export async function listProjects() {
  return db.orm.public.Project.all();
}
