const { test, expect } = require('@playwright/test');

test('modal should close after task creation', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:3000');
  
  // Wait for app to initialize
  await page.waitForTimeout(2000);
  
  // Check if addTaskBtn exists and is clickable
  const addTaskBtn = await page.locator('#addTaskBtn');
  await expect(addTaskBtn).toBeVisible();
  
  // Click add task button
  await addTaskBtn.click();
  
  // Wait for modal to appear
  await page.waitForSelector('#taskModal.show');
  console.log('✅ Modal opened');
  
  // Fill task form quickly
  await page.fill('#taskTitle', 'Modal Close Test');
  await page.fill('#taskDescription', 'Testing modal close behavior');
  
  // Listen for console logs
  page.on('console', msg => {
    console.log(`BROWSER: ${msg.text()}`);
  });
  
  // Submit the task and check immediately
  console.log('🔄 Submitting task...');
  await page.click('#saveTask');
  
  // Wait just a moment for the async call to complete
  await page.waitForTimeout(3000);
  
  // Check if modal is hidden
  const modalAfter = await page.locator('#taskModal');
  const hasShowClass = await modalAfter.evaluate(el => el.classList.contains('show'));
  
  console.log(`Modal show class after submit: ${hasShowClass}`);
  
  if (hasShowClass) {
    console.log('❌ Modal still has show class - async may not be completing');
    // Try to manually check app state
    const appState = await page.evaluate(() => ({
      tasks: window.app?.tasks?.length || 'undefined',
      currentUser: window.app?.currentUser || 'undefined'
    }));
    console.log('App state:', appState);
  } else {
    console.log('✅ Modal closed successfully');
  }
  
  expect(hasShowClass).toBe(false);
});