import { test, expect } from '@playwright/test';

test.describe('ProjectFlow frontend-backend connection', () => {
  test('should display backend connection status', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'ProjectFlow' }),
    ).toBeVisible();

    await expect(page.getByText('Backend kapcsolat')).toBeVisible();

    await expect(page.getByText('A backend elérhető.')).toBeVisible();

    await expect(
      page.getByText('Szolgáltatás: projectflow-backend'),
    ).toBeVisible();
  });
});