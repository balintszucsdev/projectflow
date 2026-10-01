import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Project } from './project.model';
import { ProjectService } from './project.service';

const PROJECT_STATUSES = ['PLANNED', 'ACTIVE', 'COMPLETED'] as const;

@Component({
  selector: 'app-projects',
  imports: [ReactiveFormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class ProjectsComponent implements OnInit {
  private readonly projectService = inject(ProjectService);
  private readonly formBuilder = inject(FormBuilder);

  readonly projects = signal<Project[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly editingProject = signal<Project | null>(null);
  readonly pendingOperation = signal<'save' | 'delete' | null>(null);
  readonly confirmingDeleteProjectId = signal<number | null>(null);
  readonly deletingProjectId = signal<number | null>(null);
  readonly operationMessage = signal<string | null>(null);
  readonly operationError = signal<string | null>(null);
  readonly projectStatuses = PROJECT_STATUSES;

  readonly projectForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    status: ['', Validators.required],
  });

  ngOnInit(): void {
    this.projectService.getProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load projects. Please try again later.');
        this.loading.set(false);
      },
    });
  }

  startEditing(project: Project): void {
    this.editingProject.set(project);
    this.projectForm.setValue({
      name: project.name,
      description: project.description ?? '',
      status: project.status,
    });
    this.operationMessage.set(null);
    this.operationError.set(null);
  }

  cancelEditing(): void {
    this.editingProject.set(null);
    this.projectForm.reset();
    this.operationMessage.set(null);
    this.operationError.set(null);
  }

  saveProject(): void {
    if (this.projectForm.invalid || this.pendingOperation()) {
      this.projectForm.markAllAsTouched();
      return;
    }

    const formValue = this.projectForm.getRawValue();
    const request = {
      name: formValue.name.trim(),
      description: formValue.description.trim() || null,
      status: formValue.status,
    };

    if (!request.name) {
      this.projectForm.controls.name.setErrors({ required: true });
      this.projectForm.controls.name.markAsTouched();
      return;
    }

    const projectBeingEdited = this.editingProject();
    this.pendingOperation.set('save');
    this.operationMessage.set(null);
    this.operationError.set(null);

    const request$ = projectBeingEdited
      ? this.projectService.updateProject(projectBeingEdited.id, request)
      : this.projectService.createProject(request);

    request$.subscribe({
      next: (savedProject) => {
        this.projects.update((projects) =>
          projectBeingEdited
            ? projects.map((project) =>
                project.id === savedProject.id ? savedProject : project,
              )
            : [...projects, savedProject],
        );
        this.pendingOperation.set(null);
        this.operationMessage.set(
          projectBeingEdited ? 'Project updated.' : 'Project created.',
        );
        this.editingProject.set(null);
        this.projectForm.reset();
      },
      error: () => {
        this.pendingOperation.set(null);
        this.operationError.set(
          projectBeingEdited
            ? 'Unable to update the project. Please try again.'
            : 'Unable to create the project. Please try again.',
        );
      },
    });
  }

  deleteProject(project: Project): void {
    if (this.pendingOperation()) {
      return;
    }

    this.confirmingDeleteProjectId.set(project.id);
    this.operationMessage.set(null);
    this.operationError.set(null);
  }

  cancelDelete(): void {
    this.confirmingDeleteProjectId.set(null);
  }

  confirmDelete(project: Project): void {
    if (
      this.pendingOperation() ||
      this.confirmingDeleteProjectId() !== project.id
    ) {
      return;
    }

    this.confirmingDeleteProjectId.set(null);
    this.pendingOperation.set('delete');
    this.deletingProjectId.set(project.id);
    this.operationMessage.set(null);
    this.operationError.set(null);

    this.projectService.deleteProject(project.id).subscribe({
      next: () => {
        this.projects.update((projects) =>
          projects.filter((item) => item.id !== project.id),
        );
        this.pendingOperation.set(null);
        this.deletingProjectId.set(null);
        this.operationMessage.set('Project deleted.');
        if (this.editingProject()?.id === project.id) {
          this.cancelEditing();
        }
      },
      error: () => {
        this.pendingOperation.set(null);
        this.deletingProjectId.set(null);
        this.operationError.set('Unable to delete the project. Please try again.');
      },
    });
  }
}
