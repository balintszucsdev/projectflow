import { test, expect } from '@playwright/test';

test.describe('Projects CRUD', () => {
  test('should display the projects UI', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'ProjectFlow' }),
    ).toBeVisible();
  });
});

test.describe('Projects CRUD', () => {
  test('should create, read, update and delete a project', async ({ page }) => {
    const projectName = `Playwright Project ${Date.now()}`;
    const updatedProjectName = `${projectName} Updated`;

    await page.goto('/projects');

    // CREATE
    await page.getByLabel('Name').fill(projectName);
    await page
      .getByLabel('Description')
      .fill('Created by Playwright E2E test');
    await page.getByLabel('Status').selectOption({ index: 1 });

    await page.getByRole('button', { name: 'Create project' }).click();

    // READ
    const projectCard = page
      .locator('.project-card')
      .filter({ hasText: projectName });

    await expect(projectCard).toBeVisible();
    await expect(projectCard).toContainText(
      'Created by Playwright E2E test',
    );

    // UPDATE
    await projectCard.getByRole('button', { name: 'Edit' }).click();

    await page.getByLabel('Name').fill(updatedProjectName);
    await page
      .getByLabel('Description')
      .fill('Updated by Playwright E2E test');

    await page.getByRole('button', { name: 'Update project' }).click();

    const updatedProjectCard = page
      .locator('.project-card')
      .filter({ hasText: updatedProjectName });

    await expect(updatedProjectCard).toBeVisible();
    await expect(updatedProjectCard).toContainText(
      'Updated by Playwright E2E test',
    );

    // DELETE
    await updatedProjectCard
      .getByRole('button', { name: 'Delete', exact: true })
      .click();

    await expect(
      updatedProjectCard.getByText(
        `Are you sure you want to delete ${updatedProjectName}?`,
      ),
    ).toBeVisible();

    await updatedProjectCard
      .getByRole('button', { name: 'Confirm delete' })
      .click();

    await expect(updatedProjectCard).not.toBeVisible();
  });
});