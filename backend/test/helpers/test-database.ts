import { execSync } from 'node:child_process';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

export interface TestDatabase {
  container: StartedPostgreSqlContainer;
  databaseUrl: string;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('projectflow_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const databaseUrl = container.getConnectionUri();

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
  };

  execSync('npx prisma contract emit', {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  execSync(
    `npx prisma db update --db "${databaseUrl}" --no-interactive --confirm projectflow_test`,
    {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    },
  );

  return {
    container,
    databaseUrl,
  };
}

export async function stopTestDatabase(
  testDatabase: TestDatabase,
): Promise<void> {
  await testDatabase.container.stop();
}

export async function cleanTestDatabase(
  testDatabase: TestDatabase,
): Promise<void> {
  const result = await testDatabase.container.exec([
    'psql',
    '-U',
    'test',
    '-d',
    'projectflow_test',
    '-c',
    'TRUNCATE TABLE project RESTART IDENTITY CASCADE;',
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to clean test database: ${result.stderr}`);
  }
}
