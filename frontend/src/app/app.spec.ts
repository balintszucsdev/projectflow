import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('shows the backend status after a successful response', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const request = httpTesting.expectOne('/api/health');
    expect(request.request.method).toBe('GET');

    request.flush({
      status: 'ok',
      service: 'projectflow-backend',
    });

    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;

    expect(page.textContent).toContain('A backend elérhető.');
    expect(page.textContent).toContain('projectflow-backend');
  });

  it('shows an error when the backend request fails', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const request = httpTesting.expectOne('/api/health');

    request.flush('Service unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });

    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;

    expect(page.textContent).toContain(
      'Nem sikerült elérni a backendet.',
    );
    expect(page.textContent).not.toContain(
      'Szolgáltatás:',
    );
  });
});