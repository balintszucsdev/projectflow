import {
  cleanTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from './helpers/test-database.js';
import type { TestDatabase } from './helpers/test-database.js';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { afterAll, beforeAll, describe, it, beforeEach } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ProjectStatus } from './../src/projects/project-status.enum.js';

type ProjectResponse = {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

describe('ProjectsController (e2e)', () => {
  let app: INestApplication<App>;
  let testDatabase: TestDatabase;
  let db: typeof import('./../src/prisma/db.js').db;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();

    process.env.DATABASE_URL = testDatabase.databaseUrl;

    const { AppModule } = await import('./../src/app.module.js');
    const dbModule = await import('./../src/prisma/db.js');

    db = dbModule.db;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();
  }, 120_000);

  beforeEach(async () => {
    await cleanTestDatabase(testDatabase);
  });

  it('/api/projects (GET)', async () => {
    await request(app.getHttpServer()).get('/api/projects').expect(200);
  });

  it('/api/projects (POST)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/projects')
      .send({
        name: 'E2E Test Project',
        description: 'Created by E2E test',
        status: ProjectStatus.PLANNED,
      })
      .expect(201);

    const body = response.body as ProjectResponse;

    expect(body).toMatchObject({
      name: 'E2E Test Project',
      description: 'Created by E2E test',
      status: ProjectStatus.PLANNED,
    });
  });

  it('/api/projects (POST) should return 400 for invalid status', async () => {
    await request(app.getHttpServer())
      .post('/api/projects')
      .send({
        name: 'Invalid E2E Project',
        description: 'This project should not be created',
        status: 'INVALID',
      })
      .expect(400);
  });

  it('/api/projects (POST) should return 400 when name is missing', async () => {
    await request(app.getHttpServer())
      .post('/api/projects')
      .send({
        description: 'Project without a name',
        status: ProjectStatus.PLANNED,
      })
      .expect(400);
  });

  it('/api/projects/:id (GET)', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/projects')
      .send({
        name: 'E2E Read Project',
        description: 'Project created for GET by id test',
        status: ProjectStatus.PLANNED,
      })
      .expect(201);

    const createdProject = createResponse.body as ProjectResponse;

    const response = await request(app.getHttpServer())
      .get(`/api/projects/${createdProject.id}`)
      .expect(200);

    const body = response.body as ProjectResponse;

    expect(body).toMatchObject({
      id: createdProject.id,
      name: 'E2E Read Project',
      description: 'Project created for GET by id test',
      status: ProjectStatus.PLANNED,
    });
  });

  it('/api/projects/:id (GET) should return 404 when project does not exist', async () => {
    await request(app.getHttpServer()).get('/api/projects/999999').expect(404);
  });

  it('/api/projects/:id (PATCH)', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/projects')
      .send({
        name: 'E2E Update Project',
        description: 'Before update',
        status: ProjectStatus.PLANNED,
      })
      .expect(201);

    const createdProject = createResponse.body as ProjectResponse;

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/projects/${createdProject.id}`)
      .send({
        status: ProjectStatus.ACTIVE,
      })
      .expect(200);

    const updatedProject = updateResponse.body as ProjectResponse;

    expect(updatedProject).toMatchObject({
      id: createdProject.id,
      name: 'E2E Update Project',
      description: 'Before update',
      status: ProjectStatus.ACTIVE,
    });
  });

  it('/api/projects/:id (PATCH) should return 404 when project does not exist', async () => {
    await request(app.getHttpServer())
      .patch('/api/projects/999999')
      .send({
        status: ProjectStatus.ACTIVE,
      })
      .expect(404);
  });

  it('/api/projects/:id (DELETE)', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/projects')
      .send({
        name: 'E2E Delete Project',
        description: 'Project created for DELETE test',
        status: ProjectStatus.PLANNED,
      })
      .expect(201);

    const createdProject = createResponse.body as ProjectResponse;

    await request(app.getHttpServer())
      .delete(`/api/projects/${createdProject.id}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/projects/${createdProject.id}`)
      .expect(404);
  });

  it('/api/projects/:id (DELETE) should return 404 when project does not exist', async () => {
    await request(app.getHttpServer())
      .delete('/api/projects/999999')
      .expect(404);
  });

  afterAll(async () => {
    await app.close();
    await db.close();
    await stopTestDatabase(testDatabase);
  });
});
