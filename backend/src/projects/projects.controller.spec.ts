import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { ProjectStatus } from './project-status.enum.js';
import { CreateProjectDto } from './create-project.dto.js';
import { UpdateProjectDto } from './update-project.dto.js';

describe('ProjectsController', () => {
  let controller: ProjectsController;

  type ProjectMock = {
    id: number;
    name: string;
    description: string | null;
    status: ProjectStatus;
    createdAt: Date;
    updatedAt: Date;
  };

  const projectsServiceMock = {
    findAll: jest.fn<() => Promise<ProjectMock[]>>(),
    findOne: jest.fn<(id: number) => Promise<ProjectMock>>(),
    create: jest.fn<(dto: CreateProjectDto) => Promise<ProjectMock>>(),
    update:
      jest.fn<(id: number, dto: UpdateProjectDto) => Promise<ProjectMock>>(),
    remove: jest.fn<(id: number) => Promise<ProjectMock>>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        {
          provide: ProjectsService,
          useValue: projectsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all projects', async () => {
      const projects: ProjectMock[] = [
        {
          id: 1,
          name: 'ProjectFlow',
          description: 'Portfolio project',
          status: ProjectStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: 'Second Project',
          description: null,
          status: ProjectStatus.PLANNED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      projectsServiceMock.findAll.mockResolvedValue(projects);

      const result = await controller.findAll();

      expect(result).toEqual(projects);
      expect(projectsServiceMock.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return a project by id', async () => {
      const project: ProjectMock = {
        id: 1,
        name: 'ProjectFlow',
        description: 'Portfolio project',
        status: ProjectStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      projectsServiceMock.findOne.mockResolvedValue(project);

      const result = await controller.findOne(1);

      expect(result).toEqual(project);
      expect(projectsServiceMock.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    it('should create a project', async () => {
      const createProjectDto: CreateProjectDto = {
        name: 'New Project',
        description: 'New project description',
        status: ProjectStatus.PLANNED,
      };

      const createdProject: ProjectMock = {
        id: 3,
        name: createProjectDto.name,
        description: createProjectDto.description ?? null,
        status: createProjectDto.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      projectsServiceMock.create.mockResolvedValue(createdProject);

      const result = await controller.create(createProjectDto);

      expect(result).toEqual(createdProject);

      expect(projectsServiceMock.create).toHaveBeenCalledWith(createProjectDto);
    });
  });

  describe('update', () => {
    it('should update a project', async () => {
      const updateProjectDto: UpdateProjectDto = {
        name: 'Updated ProjectFlow',
        status: ProjectStatus.ACTIVE,
      };

      const updatedProject: ProjectMock = {
        id: 1,
        name: 'Updated ProjectFlow',
        description: 'Portfolio project',
        status: ProjectStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      projectsServiceMock.update.mockResolvedValue(updatedProject);

      const result = await controller.update(1, updateProjectDto);

      expect(result).toEqual(updatedProject);

      expect(projectsServiceMock.update).toHaveBeenCalledWith(
        1,
        updateProjectDto,
      );
    });
  });

  describe('remove', () => {
    it('should remove a project', async () => {
      const removedProject: ProjectMock = {
        id: 1,
        name: 'ProjectFlow',
        description: 'Portfolio project',
        status: ProjectStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      projectsServiceMock.remove.mockResolvedValue(removedProject);

      const result = await controller.remove(1);

      expect(result).toEqual(removedProject);
      expect(projectsServiceMock.remove).toHaveBeenCalledWith(1);
    });
  });
});
