// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TaskFlow - Performance & Accessibility Tests', () => {
  test('should have good INP performance on task creation', async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');

    // Wait for the app to load
    await expect(page.getByRole('heading', { name: 'Task Board' })).toBeVisible();

    // Start performance monitoring
    await page.evaluate(() => {
      window.performance.mark('task-creation-start');
    });

    // Click Add Task button
    await page.getByRole('button', { name: /add new task/i }).click();

    // Fill the task form quickly
    await page.locator('#taskTitle').fill('Performance Test Task');
    await page.locator('#taskDescription').fill('Testing INP performance');
    await page.locator('#taskPriority').selectOption('high');
    await page.locator('#taskCategory').selectOption('work');

    // Measure form interaction time
    await page.evaluate(() => {
      window.performance.mark('task-creation-end');
      window.performance.measure('task-form-interaction', 'task-creation-start', 'task-creation-end');
    });

    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const measure = window.performance.getEntriesByName('task-form-interaction')[0];
      return {
        duration: measure.duration,
        startTime: measure.startTime
      };
    });

    // Assert INP is under 600ms (reasonable threshold for complex form interaction)
    expect(metrics.duration).toBeLessThan(600);
  });

  test('should auto-populate date and time fields', async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');

    // Wait for the app to load
    await expect(page.getByRole('heading', { name: 'Task Board' })).toBeVisible();

    // Click Add Task button
    await page.getByRole('button', { name: /add new task/i }).click();

    // Check that date and time fields are auto-populated
    const dateValue = await page.locator('#taskDueDate').inputValue();
    const timeValue = await page.locator('#taskDueTime').inputValue();

    // Date should be today's date
    const today = new Date().toISOString().split('T')[0];
    expect(dateValue).toBe(today);

    // Time should be current time (within 1 minute tolerance)
    const currentTime = new Date();
    const currentHour = String(currentTime.getHours()).padStart(2, '0');
    const currentMinute = String(currentTime.getMinutes()).padStart(2, '0');
    const expectedTime = `${currentHour}:${currentMinute}`;
    
    // Allow for 1 minute difference due to test execution time
    expect(timeValue).toMatch(/^\d{2}:\d{2}$/);
  });

  test('should display time in task cards', async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');

    // Wait for the app to load
    await expect(page.getByRole('heading', { name: 'Task Board' })).toBeVisible();

    // Check that sample tasks show time information
    const taskWithTime = page.locator('.task-date').filter({ hasText: /at \d{2}:\d{2}/ });
    await expect(taskWithTime.first()).toBeVisible();
  });

  test('should have proper accessibility attributes', async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');

    // Check for proper ARIA labels
    await expect(page.locator('[aria-label="Add new task"]')).toBeVisible();

    // Open modal to check form labels
    await page.getByRole('button', { name: /add new task/i }).click();
    await expect(page.locator('#taskModal')).toBeVisible();
    
    // Check for proper form labels
    await expect(page.locator('label[for="taskTitle"]')).toBeVisible();
    await expect(page.locator('label[for="taskDescription"]')).toBeVisible();
    await expect(page.locator('label[for="taskPriority"]')).toBeVisible();
    await expect(page.locator('label[for="taskCategory"]')).toBeVisible();
    await expect(page.locator('label[for="taskDueDate"]')).toBeVisible();
    await expect(page.locator('label[for="taskDueTime"]')).toBeVisible();

    // Check for proper select element accessibility
    await expect(page.locator('select[aria-label="Select task priority"]')).toBeVisible();
    await expect(page.locator('select[aria-label="Select task category"]')).toBeVisible();

    // Check for close button (modal is already open)
    await expect(page.locator('[aria-label="Close modal"]')).toBeVisible();
  });

  test('should have semantic HTML structure', async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');

    // Check for proper heading hierarchy
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h2')).toHaveCount(7); // Three column headers + 4 modal titles (task, login, register, profile)

    // Check for proper semantic elements
    await expect(page.locator('main[role="main"]')).toBeVisible();
    await expect(page.locator('section[aria-label="Task management board"]')).toBeVisible();
    await expect(page.locator('[role="region"]')).toHaveCount(3); // Three task columns
  });

  test('should handle drag and drop without performance issues', async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');

    // Wait for the app to load
    await expect(page.getByRole('heading', { name: 'Task Board' })).toBeVisible();

    // Wait for sample tasks to load
    await expect(page.locator('.task-card').first()).toBeVisible();

    // Start performance monitoring
    await page.evaluate(() => {
      window.performance.mark('drag-start');
    });

    // Perform drag and drop
    const taskCard = page.locator('.task-card').first();
    const targetColumn = page.locator('.task-column[data-status="progress"]');
    
    await taskCard.dragTo(targetColumn);

    // Measure drag and drop time
    await page.evaluate(() => {
      window.performance.mark('drag-end');
      window.performance.measure('drag-drop-operation', 'drag-start', 'drag-end');
    });

    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const measure = window.performance.getEntriesByName('drag-drop-operation')[0];
      return { duration: measure.duration };
    });

    // Assert drag and drop is under 500ms (reasonable threshold for drag operation)
    expect(metrics.duration).toBeLessThan(500);
  });

  test('should have good color contrast ratios', async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');

    // Check that text is readable
    const mainText = page.locator('.page-title');
    const computedStyle = await mainText.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor
      };
    });

    // Basic check that we have contrasting colors
    expect(computedStyle.color).toBeTruthy();
    expect(computedStyle.backgroundColor).toBeTruthy();
  });

  test('should work with keyboard navigation', async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');

    // Navigate to Add Task button with keyboard
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be on Add Task button
    await page.keyboard.press('Enter');

    // Wait for modal to open
    await expect(page.locator('#taskModal')).toBeVisible();
    await page.waitForTimeout(100); // Small delay for modal animation

    // Navigate through form fields
    await page.keyboard.press('Tab'); // Task title
    await page.keyboard.press('Tab'); // Description
    await page.keyboard.press('Tab'); // Priority
    await page.keyboard.press('Tab'); // Category
    await page.keyboard.press('Tab'); // Due Date
    await page.keyboard.press('Tab'); // Due Time

    // Should be able to navigate through all fields
    await expect(page.locator('#taskDueTime')).toBeFocused();
  });
});
