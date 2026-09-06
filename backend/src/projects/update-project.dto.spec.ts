import { validate } from 'class-validator';
import { UpdateProjectDto } from './update-project.dto.js';
import { ProjectStatus } from './project-status.enum.js';

describe('UpdateProjectDto', () => {
  it('should pass validation with no fields', async () => {
    const dto = new UpdateProjectDto();

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should fail validation when name is empty', async () => {
    const dto = new UpdateProjectDto();

    dto.name = '';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('should fail validation when status is invalid', async () => {
    const dto = new UpdateProjectDto();

    dto.status = 'INVALID' as ProjectStatus;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('should pass validation with only status', async () => {
    const dto = new UpdateProjectDto();

    dto.status = ProjectStatus.ACTIVE;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
