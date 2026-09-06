import { validate } from 'class-validator';
import { CreateProjectDto } from './create-project.dto.js';
import { ProjectStatus } from './project-status.enum.js';

describe('CreateProjectDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = new CreateProjectDto();

    dto.name = 'ProjectFlow';
    dto.description = 'Portfolio project';
    dto.status = ProjectStatus.ACTIVE;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should fail validation when name is missing', async () => {
    const dto = new CreateProjectDto();

    dto.status = ProjectStatus.ACTIVE;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('should fail validation when name is empty', async () => {
    const dto = new CreateProjectDto();

    dto.name = '';
    dto.status = ProjectStatus.ACTIVE;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('should fail validation when status is invalid', async () => {
    const dto = new CreateProjectDto();

    dto.name = 'ProjectFlow';
    dto.status = 'INVALID' as ProjectStatus;

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('should pass validation without description', async () => {
    const dto = new CreateProjectDto();

    dto.name = 'ProjectFlow';
    dto.status = ProjectStatus.ACTIVE;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
