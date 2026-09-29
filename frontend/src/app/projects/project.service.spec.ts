import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Project } from './project.model';
import { ProjectService } from './project.service';

describe('ProjectService', () => {
  let service: ProjectService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ProjectService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('gets projects from the projects endpoint', () => {
    const projects: Project[] = [
      {
        id: 1,
        name: 'Portfolio',
        description: null,
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ];
    let response: Project[] | undefined;

    service.getProjects().subscribe((result) => {
      response = result;
    });

    const request = httpTesting.expectOne('/api/projects');
    expect(request.request.method).toBe('GET');
    request.flush(projects);

    expect(response).toEqual(projects);
  });
});
