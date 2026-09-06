import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProjectDto } from './create-project.dto.js';
import { ProjectStatus } from './project-status.enum.js';
import { UpdateProjectDto } from './update-project.dto.js';

describe('ProjectsService', () => {
  let service: ProjectsService;

  type ProjectMock = {
    id: number;
    name: string;
    description: string | null;
    status: ProjectStatus;
    createdAt: Date;
    updatedAt: Date;
  };

  const prismaMock = {
    listProjects: jest.fn<() => Promise<ProjectMock[]>>(),
    getProjectById: jest.fn<(id: number) => Promise<ProjectMock | null>>(),
    createProject:
      jest.fn<
        (
          name: string,
          description: string | undefined,
          status: ProjectStatus,
        ) => Promise<ProjectMock>
      >(),
    updateProject:
      jest.fn<(id: number, dto: UpdateProjectDto) => Promise<ProjectMock>>(),
    deleteProject: jest.fn<(id: number) => Promise<ProjectMock>>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
          name: 'Test Project',
          description: null,
          status: ProjectStatus.PLANNED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prismaMock.listProjects.mockResolvedValue(projects);

      const result = await service.findAll();

      expect(result).toEqual(projects);
      expect(prismaMock.listProjects).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return a project when it exists', async () => {
      const project: ProjectMock = {
        id: 1,
        name: 'ProjectFlow',
        description: 'Portfolio project',
        status: ProjectStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.getProjectById.mockResolvedValue(project);

      const result = await service.findOne(1);

      expect(result).toEqual(project);
      expect(prismaMock.getProjectById).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      prismaMock.getProjectById.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);

      expect(prismaMock.getProjectById).toHaveBeenCalledWith(999);
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

      prismaMock.createProject.mockResolvedValue(createdProject);

      const result = await service.create(createProjectDto);

      expect(result).toEqual(createdProject);

      expect(prismaMock.createProject).toHaveBeenCalledWith(
        'New Project',
        'New project description',
        ProjectStatus.PLANNED,
      );
    });
  });

  describe('update', () => {
    it('should update an existing project', async () => {
      const existingProject: ProjectMock = {
        id: 1,
        name: 'ProjectFlow',
        description: 'Portfolio project',
        status: ProjectStatus.PLANNED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateProjectDto: UpdateProjectDto = {
        name: 'Updated ProjectFlow',
        status: ProjectStatus.ACTIVE,
      };

      const updatedProject: ProjectMock = {
        ...existingProject,
        ...updateProjectDto,
        updatedAt: new Date(),
      };

      prismaMock.getProjectById.mockResolvedValue(existingProject);
      prismaMock.updateProject.mockResolvedValue(updatedProject);

      const result = await service.update(1, updateProjectDto);

      expect(result).toEqual(updatedProject);
      expect(prismaMock.getProjectById).toHaveBeenCalledWith(1);
      expect(prismaMock.updateProject).toHaveBeenCalledWith(
        1,
        updateProjectDto,
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      const updateProjectDto: UpdateProjectDto = {
        name: 'Updated ProjectFlow',
        status: ProjectStatus.ACTIVE,
      };

      prismaMock.getProjectById.mockResolvedValue(null);

      await expect(service.update(999, updateProjectDto)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaMock.getProjectById).toHaveBeenCalledWith(999);

      expect(prismaMock.updateProject).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove an existing project', async () => {
      const existingProject: ProjectMock = {
        id: 1,
        name: 'ProjectFlow',
        description: 'Portfolio project',
        status: ProjectStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.getProjectById.mockResolvedValue(existingProject);
      prismaMock.deleteProject.mockResolvedValue(existingProject);

      const result = await service.remove(1);

      expect(result).toEqual(existingProject);
      expect(prismaMock.getProjectById).toHaveBeenCalledWith(1);
      expect(prismaMock.deleteProject).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      prismaMock.getProjectById.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);

      expect(prismaMock.getProjectById).toHaveBeenCalledWith(999);
      expect(prismaMock.deleteProject).not.toHaveBeenCalled();
    });
  });
});
