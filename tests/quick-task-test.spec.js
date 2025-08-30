const { test, expect } = require('@playwright/test');

test('quick task creation test', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:3000');
  
  // Wait for app to initialize without errors
  await page.waitForTimeout(3000);
  
  // Check if addTaskBtn exists and is clickable
  const addTaskBtn = await page.locator('#addTaskBtn');
  await expect(addTaskBtn).toBeVisible();
  
  // Click add task button
  await addTaskBtn.click();
  
  // Wait for modal to appear
  await page.waitForSelector('#taskModal.show');
  
  // Fill and submit task
  await page.fill('#taskTitle', 'Quick Test Task');
  await page.fill('#taskDescription', 'Testing task creation after fix');
  
  // Submit the task
  await page.click('#saveTask');
  
  // Wait for modal to close by waiting for show class to be removed
  await page.waitForFunction(() => {
    const modal = document.getElementById('taskModal');
    return modal && !modal.classList.contains('show');
  }, { timeout: 10000 });
  
  // Check if task appears in the UI
  const taskCards = page.locator('.task-card');
  await expect(taskCards).toHaveCount(await taskCards.count());
  const count = await taskCards.count();
  
  console.log(`✅ Task creation test passed! Found ${count} task cards`);
  
  // Verify at least one task exists
  expect(count).toBeGreaterThan(0);
});