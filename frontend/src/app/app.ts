import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';

interface HealthResponse {
  status: string;
  service: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly http = inject(HttpClient);

  readonly backendStatus = signal('Kapcsolódás...');
  readonly backendService = signal('');

  ngOnInit(): void {
    this.http.get<HealthResponse>('/api/health').subscribe({
      next: (response) => {
        this.backendStatus.set(
          response.status === 'ok'
            ? 'A backend elérhető.'
            : 'A backend hibás állapotot jelzett.',
        );
        this.backendService.set(response.service);
      },
      error: () => {
        this.backendStatus.set('Nem sikerült elérni a backendet.');
        this.backendService.set('');
      },
    });
  }
}