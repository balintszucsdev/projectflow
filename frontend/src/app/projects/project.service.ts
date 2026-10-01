import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateProjectRequest,
  Project,
  UpdateProjectRequest,
} from './project.model';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>('/api/projects');
  }

  createProject(project: CreateProjectRequest): Observable<Project> {
    return this.http.post<Project>('/api/projects', project);
  }

  updateProject(
    id: number,
    project: UpdateProjectRequest,
  ): Observable<Project> {
    return this.http.patch<Project>(`/api/projects/${id}`, project);
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`/api/projects/${id}`);
  }
}
