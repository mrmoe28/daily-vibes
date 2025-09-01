// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TaskFlow - Core Functionality', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');
    await expect(page.getByRole('heading', { name: 'Task Board' })).toBeVisible();
  });

  test.describe('Task Management', () => {
    test('creates a task', async ({ page }) => {
      // Create task
      await page.getByRole('button', { name: /add new task/i }).click();
      await expect(page.locator('#taskModal')).toBeVisible();
      
      await page.locator('#taskTitle').fill('Test Task');
      await page.locator('#taskDescription').fill('Test description');
      await page.locator('#taskPriority').selectOption('high');
      await page.locator('#taskCategory').selectOption('work');
      await page.locator('#taskDueDate').fill('2024-12-31');
      await page.getByRole('button', { name: /save task/i }).click();
      
      // Wait for modal to close
      await expect(page.locator('#taskModal')).not.toBeVisible();
      
      // Verify task appears
      await expect(page.locator('.task-title').filter({ hasText: 'Test Task' })).toBeVisible();
    });

    test('handles drag and drop', async ({ page }) => {
      // Create a task first
      await page.getByRole('button', { name: /add new task/i }).click();
      await page.locator('#taskTitle').fill('Draggable Task');
      await page.getByRole('button', { name: /save task/i }).click();
      
      // Find the task card
      const taskCard = page.locator('.task-card').filter({ hasText: 'Draggable Task' });
      const inProgressColumn = page.locator('.kanban-column').filter({ hasText: 'In Progress' });
      
      // Drag to In Progress
      await taskCard.dragTo(inProgressColumn);
      
      // Verify task moved
      await expect(inProgressColumn.locator('.task-card').filter({ hasText: 'Draggable Task' })).toBeVisible();
    });

    test('deletes tasks', async ({ page }) => {
      // Create a task
      await page.getByRole('button', { name: /add new task/i }).click();
      await page.locator('#taskTitle').fill('Task to Delete');
      await page.getByRole('button', { name: /save task/i }).click();
      
      // Delete the task
      const taskCard = page.locator('.task-card').filter({ hasText: 'Task to Delete' });
      await taskCard.locator('.delete-btn').click();
      
      // Confirm deletion
      await page.getByRole('button', { name: /confirm|yes|delete/i }).click();
      
      // Verify task is gone
      await expect(taskCard).not.toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('navigates between views', async ({ page }) => {
      // Test Task Board navigation
      await page.getByRole('link', { name: /task board/i }).click();
      await expect(page.getByRole('heading', { name: 'Task Board' })).toBeVisible();
      
      // Test Calendar navigation
      await page.getByRole('link', { name: /calendar/i }).click();
      await expect(page.url()).toContain('calendar');
      
      // Go back to Task Board
      await page.goBack();
      await expect(page.getByRole('heading', { name: 'Task Board' })).toBeVisible();
    });
  });

  test.describe('Form Validation', () => {
    test('validates required fields', async ({ page }) => {
      await page.getByRole('button', { name: /add new task/i }).click();
      
      // Try to save without filling required fields
      await page.getByRole('button', { name: /save task/i }).click();
      
      // Check for validation error
      const titleInput = page.locator('#taskTitle');
      await expect(titleInput).toHaveAttribute('required', '');
    });

    test('handles empty inputs gracefully', async ({ page }) => {
      await page.getByRole('button', { name: /add new task/i }).click();
      
      // Fill only title (minimum required)
      await page.locator('#taskTitle').fill('Minimal Task');
      await page.getByRole('button', { name: /save task/i }).click();
      
      // Should save successfully
      await expect(page.locator('#taskModal')).not.toBeVisible();
      await expect(page.locator('.task-title').filter({ hasText: 'Minimal Task' })).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('loads page within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test('handles multiple tasks efficiently', async ({ page }) => {
      // Create multiple tasks
      for (let i = 1; i <= 5; i++) {
        await page.getByRole('button', { name: /add new task/i }).click();
        await page.locator('#taskTitle').fill(`Task ${i}`);
        await page.getByRole('button', { name: /save task/i }).click();
        await page.waitForTimeout(100); // Small delay between tasks
      }
      
      // Verify all tasks are visible
      for (let i = 1; i <= 5; i++) {
        await expect(page.locator('.task-title').filter({ hasText: `Task ${i}` })).toBeVisible();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('supports keyboard navigation', async ({ page }) => {
      // Tab through main elements
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
      
      // Open modal with keyboard
      await page.getByRole('button', { name: /add new task/i }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#taskModal')).toBeVisible();
      
      // Close with Escape
      await page.keyboard.press('Escape');
      await expect(page.locator('#taskModal')).not.toBeVisible();
    });

    test('has proper ARIA labels', async ({ page }) => {
      // Check main navigation
      const nav = page.locator('nav');
      await expect(nav).toHaveAttribute('role', 'navigation');
      
      // Check buttons have accessible names
      const addButton = page.getByRole('button', { name: /add new task/i });
      await expect(addButton).toBeVisible();
    });
  });
});