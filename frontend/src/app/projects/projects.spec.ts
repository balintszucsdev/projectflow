import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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
});
