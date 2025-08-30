const { test, expect } = require('@playwright/test');

test('diagnose save button click behavior', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:3000');
  
  // Wait for app to initialize
  await page.waitForTimeout(2000);
  
  console.log('🔍 Checking save button setup...');
  
  // Open modal
  const addTaskBtn = page.locator('#addTaskBtn');
  await expect(addTaskBtn).toBeVisible();
  await addTaskBtn.click();
  
  // Wait for modal to appear
  await page.waitForSelector('#taskModal.show');
  console.log('✅ Modal opened');
  
  // Check if save button exists and is clickable
  const saveBtn = page.locator('#saveTask');
  await expect(saveBtn).toBeVisible();
  
  const saveButtonType = await saveBtn.getAttribute('type');
  console.log(`Save button type: ${saveButtonType}`);
  
  // Check if form exists
  const taskForm = page.locator('#taskForm');
  await expect(taskForm).toBeVisible();
  
  // Fill form with minimal data
  await page.fill('#taskTitle', 'Save Button Test');
  
  console.log('🔍 Filled form, now testing button click...');
  
  // Listen for console messages and network requests
  const requests = [];
  const consoleLogs = [];
  
  page.on('request', request => {
    if (request.url().includes('/api/tasks')) {
      requests.push({
        method: request.method(),
        url: request.url(),
        postData: request.postData()
      });
      console.log(`→ ${request.method()} ${request.url()}`);
    }
  });
  
  page.on('console', msg => {
    consoleLogs.push(msg.text());
    console.log(`BROWSER: ${msg.text()}`);
  });
  
  // Test button click
  console.log('🔄 Clicking save button...');
  await saveBtn.click();
  
  // Wait a moment to see what happens
  await page.waitForTimeout(2000);
  
  console.log(`POST requests made: ${requests.length}`);
  console.log(`Console messages: ${consoleLogs.length}`);
  
  if (requests.length === 0) {
    console.log('❌ No API requests were made - button click may not be working');
    
    // Check if form submission event is working by testing form.submit()
    console.log('🔄 Testing direct form submission...');
    await page.evaluate(() => {
      const form = document.getElementById('taskForm');
      if (form) {
        console.log('Form found, attempting direct submit');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      } else {
        console.log('Form not found!');
      }
    });
    
    await page.waitForTimeout(1000);
    console.log(`POST requests after direct submit: ${requests.length}`);
  } else {
    console.log('✅ API request was made successfully');
  }
  
  // Check modal state
  const modalHasShow = await page.locator('#taskModal').evaluate(el => el.classList.contains('show'));
  console.log(`Modal still open: ${modalHasShow}`);
});