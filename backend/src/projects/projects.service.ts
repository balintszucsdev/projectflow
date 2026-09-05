import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProjectDto } from './create-project.dto.js';
import { UpdateProjectDto } from './update-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  findAll() {
    return this.prisma.listProjects();
  }

  create(createProjectDto: CreateProjectDto) {
    return this.prisma.createProject(
      createProjectDto.name,
      createProjectDto.description,
      createProjectDto.status,
    );
  }

  async update(id: number, updateProjectDto: UpdateProjectDto) {
    await this.findOne(id);

    return this.prisma.updateProject(id, updateProjectDto);
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.deleteProject(id);
  }

  async findOne(id: number) {
    const project = await this.prisma.getProjectById(id);

    if (!project) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }

    return project;
  }
}
