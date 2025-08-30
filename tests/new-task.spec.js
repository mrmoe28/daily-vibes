// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TaskFlow - Task Management', () => {
  test('opens Add Task modal from Task Board', async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');

    // Wait for the app to load
    await expect(page.getByRole('heading', { name: 'Task Board' })).toBeVisible();

    // Click Add Task button
    await page.getByRole('button', { name: /add new task/i }).click();

    // Assert modal appears
    const modal = page.locator('#taskModal');
    await expect(modal).toBeVisible();
    await expect(page.getByRole('heading', { name: /add new task/i })).toBeVisible();

    // Fields present
    await expect(page.locator('#taskTitle')).toBeVisible();
    await expect(page.locator('#taskPriority')).toBeVisible();
    await expect(page.locator('#taskCategory')).toBeVisible();
    await expect(page.locator('#taskDueDate')).toBeVisible();
  });

  test('creates a new task successfully', async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');

    // Wait for the app to load
    await expect(page.getByRole('heading', { name: 'Task Board' })).toBeVisible();

    // Click Add Task button
    await page.getByRole('button', { name: /add new task/i }).click();

    // Fill the task form
    await page.locator('#taskTitle').fill('Test Task');
    await page.locator('#taskDescription').fill('This is a test task description');
    await page.locator('#taskPriority').selectOption('high');
    await page.locator('#taskCategory').selectOption('work');
    await page.locator('#taskDueDate').fill('2024-12-31');

    // Save the task
    await page.getByRole('button', { name: /save task/i }).click();

    // Modal should close
    await expect(page.locator('#taskModal')).not.toBeVisible();

    // Task should appear in the To Do column - use more specific selector
    await expect(page.locator('.task-title').filter({ hasText: 'Test Task' })).toBeVisible();
  });

  test('displays task statistics correctly', async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');

    // Wait for the app to load
    await expect(page.getByRole('heading', { name: 'Task Board' })).toBeVisible();

    // Check that stats cards are present - use more specific selectors
    await expect(page.locator('.stat-label').filter({ hasText: 'Total Tasks' })).toBeVisible();
    await expect(page.locator('.stat-label').filter({ hasText: 'To Do' })).toBeVisible();
    await expect(page.locator('.stat-label').filter({ hasText: 'In Progress' })).toBeVisible();
    await expect(page.locator('.stat-label').filter({ hasText: 'Completed' })).toBeVisible();
  });

  test('shows task columns with correct headers', async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');

    // Wait for the app to load
    await expect(page.getByRole('heading', { name: 'Task Board' })).toBeVisible();

    // Check that all three columns are present - use column title selectors
    await expect(page.locator('.column-title').filter({ hasText: 'To Do' })).toBeVisible();
    await expect(page.locator('.column-title').filter({ hasText: 'In Progress' })).toBeVisible();
    await expect(page.locator('.column-title').filter({ hasText: 'Completed' })).toBeVisible();
  });

  test('sidebar navigation works correctly', async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');

    // Wait for the app to load
    await expect(page.getByRole('heading', { name: 'Task Board' })).toBeVisible();

    // Check sidebar elements - use more specific selectors
    await expect(page.locator('.app-title').filter({ hasText: 'TaskFlow' })).toBeVisible();
    await expect(page.locator('.nav-item').filter({ hasText: 'Task Board' })).toBeVisible();
    await expect(page.locator('.nav-item').filter({ hasText: 'Calendar' })).toBeVisible();
    await expect(page.locator('.nav-item').filter({ hasText: 'Analytics' })).toBeVisible();
  });
});
