import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  status?: string;
}
