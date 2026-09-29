import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'projects',
    loadComponent: () =>
      import('./projects/projects').then((module) => module.ProjectsComponent),
  },
];
