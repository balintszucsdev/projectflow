import { execSync } from 'node:child_process';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

describe('PostgreSQL Testcontainer', () => {
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('projectflow_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    const databaseUrl = container.getConnectionUri();

    process.env.DATABASE_URL = databaseUrl;

    execSync(`npx prisma db migrate --db "${databaseUrl}"`, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
  }, 120_000);

  afterAll(async () => {
    await container.stop();
  });

  it('should start a PostgreSQL container with the ProjectFlow schema', () => {
    expect(container).toBeDefined();
    expect(container.getConnectionUri()).toContain('projectflow_test');
  });
});
