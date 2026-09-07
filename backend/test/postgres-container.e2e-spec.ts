import { jest } from '@jest/globals';
import {
  startTestDatabase,
  stopTestDatabase,
  TestDatabase,
} from './helpers/test-database';

jest.setTimeout(120_000);

describe('PostgreSQL Testcontainer', () => {
  let testDatabase: TestDatabase | undefined;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  });

  afterAll(async () => {
    if (testDatabase) {
      await stopTestDatabase(testDatabase);
    }
  });

  it('should start a PostgreSQL container with the ProjectFlow schema', async () => {
    expect(testDatabase).toBeDefined();

    const result = await testDatabase!.container.exec([
      'psql',
      '-U',
      'test',
      '-d',
      'projectflow_test',
      '-tAc',
      `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'project'
        );
      `,
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('t');
  });
});
