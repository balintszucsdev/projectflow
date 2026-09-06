import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ProjectStatus } from './project-status.enum.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({
    example: 'ProjectFlow',
    description: 'Name of the project',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: 'Portfolio project management application',
    description: 'Optional project description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'ACTIVE',
    description: 'Current status of the project',
  })
  @IsEnum(ProjectStatus)
  status!: ProjectStatus;
}
