import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Get,
  Delete,
} from '@nestjs/common';

import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './create-project.dto.js';
import { UpdateProjectDto } from './update-project.dto.js';
import { ApiParam, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('projects')
@Controller('api/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new project',
  })
  @ApiResponse({
    status: 201,
    description: 'Project successfully created',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid project data',
  })
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all projects',
  })
  @ApiResponse({
    status: 200,
    description: 'List of projects returned successfully',
  })
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a project by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Project ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Project returned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a project',
  })
  @ApiParam({
    name: 'id',
    description: 'Project ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Project updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid project data',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a project',
  })
  @ApiParam({
    name: 'id',
    description: 'Project ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Project deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.remove(id);
  }
}
