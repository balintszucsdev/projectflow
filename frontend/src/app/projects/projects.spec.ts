import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectsComponent } from './projects';

describe('ProjectsComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function createFixture(projects: unknown[] = []) {
    const fixture = TestBed.createComponent(ProjectsComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/projects').flush(projects);
    fixture.detectChanges();
    return fixture;
  }

  function submitForm(fixture: ComponentFixture<ProjectsComponent>) {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('shows loading while the request is pending and renders the project list', () => {
    const fixture = TestBed.createComponent(ProjectsComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Loading projects...',
    );

    const request = httpTesting.expectOne('/api/projects');
    request.flush([
      {
        id: 1,
        name: 'Portfolio',
        description: 'A personal portfolio website',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Portfolio');
    expect(page.textContent).toContain('A personal portfolio website');
    expect(page.textContent).toContain('active');
    expect(page.textContent).not.toContain('Loading projects...');
  });

  it('shows an empty state when there are no projects', () => {
    const fixture = TestBed.createComponent(ProjectsComponent);
    fixture.detectChanges();

    httpTesting.expectOne('/api/projects').flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No projects found.',
    );
  });

  it('shows an error when the request fails', () => {
    const fixture = TestBed.createComponent(ProjectsComponent);
    fixture.detectChanges();

    httpTesting.expectOne('/api/projects').flush('Service unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'Unable to load projects.',
    );
  });

  it('prevents submitting an invalid form and shows required field errors', () => {
    const fixture = createFixture();

    submitForm(fixture);

    expect(httpTesting.match((request) => request.method !== 'GET')).toHaveLength(0);
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Name is required.');
    expect(page.textContent).toContain('Status is required.');
  });

  it('creates a project and adds the saved response to the list', () => {
    const fixture = createFixture();
    fixture.componentInstance.projectForm.setValue({
      name: '  Portfolio  ',
      description: 'My portfolio',
      status: 'ACTIVE',
    });
    fixture.detectChanges();

    submitForm(fixture);

    const request = httpTesting.expectOne('/api/projects');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Portfolio',
      description: 'My portfolio',
      status: 'ACTIVE',
    });
    request.flush({
      id: 2,
      name: 'Portfolio',
      description: 'My portfolio',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Portfolio');
    expect(page.textContent).toContain('Project created.');
  });

  it('loads an existing project into the form and updates it', () => {
    const existingProject = {
      id: 1,
      name: 'Portfolio',
      description: 'Original description',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const fixture = createFixture([existingProject]);
    const page = fixture.nativeElement as HTMLElement;

    Array.from(page.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Edit')
      ?.dispatchEvent(new Event('click', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.projectForm.getRawValue()).toEqual({
      name: 'Portfolio',
      description: 'Original description',
      status: 'ACTIVE',
    });

    fixture.componentInstance.projectForm.setValue({
      name: 'Updated portfolio',
      description: '',
      status: 'COMPLETED',
    });
    submitForm(fixture);

    const request = httpTesting.expectOne('/api/projects/1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      name: 'Updated portfolio',
      description: null,
      status: 'COMPLETED',
    });
    request.flush({
      ...existingProject,
      name: 'Updated portfolio',
      description: null,
      status: 'COMPLETED',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    fixture.detectChanges();

    expect(page.textContent).toContain('Updated portfolio');
    expect(page.textContent).toContain('Project updated.');
    expect(page.textContent).not.toContain('Original description');
  });

  it('asks for confirmation before deleting and removes the project after confirmation', () => {
    const fixture = createFixture([
      {
        id: 1,
        name: 'Portfolio',
        description: null,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const page = fixture.nativeElement as HTMLElement;

    Array.from(page.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Delete')
      ?.click();
    fixture.detectChanges();

    expect(httpTesting.match('/api/projects/1')).toHaveLength(0);
    expect(page.textContent).toContain('Are you sure you want to delete Portfolio?');

    Array.from(page.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Confirm delete')
      ?.click();

    const request = httpTesting.expectOne('/api/projects/1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    fixture.detectChanges();

    expect(page.textContent).not.toContain('Portfolio');
    expect(page.textContent).toContain('Project deleted.');
  });

  it('cancels a pending delete confirmation without sending a request', () => {
    const fixture = createFixture([
      {
        id: 1,
        name: 'Portfolio',
        description: null,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const page = fixture.nativeElement as HTMLElement;

    Array.from(page.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Delete')
      ?.click();
    fixture.detectChanges();

    Array.from(page.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Cancel')
      ?.click();
    fixture.detectChanges();

    expect(httpTesting.match('/api/projects/1')).toHaveLength(0);
    expect(page.textContent).not.toContain('Are you sure you want to delete');
    expect(page.textContent).toContain('Portfolio');
  });

  it('shows deleting feedback only on the project being deleted', () => {
    const fixture = createFixture([
      {
        id: 1,
        name: 'Portfolio',
        description: null,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        name: 'Dashboard',
        description: null,
        status: 'PLANNED',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const page = fixture.nativeElement as HTMLElement;

    Array.from(page.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Delete')
      ?.click();
    fixture.detectChanges();
    Array.from(page.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Confirm delete')
      ?.click();
    fixture.detectChanges();

    const deletionRequest = httpTesting.expectOne('/api/projects/1');

    const deleteButtons = Array.from(page.querySelectorAll('.project-card')).map(
      (card) =>
        Array.from(card.querySelectorAll('button')).find((button) =>
          ['Delete', 'Deleting...'].includes(button.textContent?.trim() ?? ''),
        )?.textContent?.trim(),
    );
    expect(deleteButtons).toEqual(['Deleting...', 'Delete']);

    deletionRequest.flush(null);
    fixture.detectChanges();
  });

  it('shows an error when project creation fails', () => {
    const fixture = createFixture();
    fixture.componentInstance.projectForm.setValue({
      name: 'Portfolio',
      description: '',
      status: 'ACTIVE',
    });
    submitForm(fixture);

    httpTesting.expectOne('/api/projects').flush('Service unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')
        ?.textContent,
    ).toContain('Unable to create the project.');
  });
});
