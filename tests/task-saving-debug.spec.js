const { test, expect } = require('@playwright/test');

test.describe('Task Saving Debug - Single Window', () => {
  test('diagnose why tasks are not appearing after save', async ({ page }) => {
    // Track all network requests
    const requests = [];
    const responses = [];
    
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData()
      });
      console.log(`→ ${request.method()} ${request.url()}`);
    });
    
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status()
      });
      console.log(`← ${response.status()} ${response.url()}`);
    });
    
    // Track console logs and errors
    page.on('console', msg => {
      console.log(`CONSOLE [${msg.type()}]: ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      console.error(`PAGE ERROR: ${error.message}`);
    });
    
    // Navigate to the app
    console.log('🔍 Step 1: Loading application...');
    await page.goto('http://localhost:3000');
    
    // Wait for app to initialize
    await page.waitForTimeout(2000);
    
    // Check initial API call for tasks
    console.log('🔍 Step 2: Checking initial task load...');
    const initialTaskRequests = requests.filter(r => r.url.includes('/api/tasks') && r.method === 'GET');
    console.log(`Initial task load requests: ${initialTaskRequests.length}`);
    
    // Check current task count in UI
    const initialTaskCount = await page.locator('.task-card').count();
    console.log(`Initial tasks visible in UI: ${initialTaskCount}`);
    
    // Open add task modal
    console.log('🔍 Step 3: Opening add task modal...');
    await page.click('#addTaskBtn');
    await page.waitForSelector('#taskModal.show');
    
    // Fill task form
    console.log('🔍 Step 4: Filling task form...');
    await page.fill('#taskTitle', 'Debug Test Task');
    await page.fill('#taskDescription', 'Testing why tasks are not saving');
    await page.selectOption('#taskPriority', 'high');
    await page.selectOption('#taskCategory', 'work');
    
    // Submit task
    console.log('🔍 Step 5: Submitting task...');
    await page.click('#saveTask');
    
    // Wait for modal to close
    await page.waitForSelector('#taskModal:not(.show)');
    
    // Check for POST request
    console.log('🔍 Step 6: Checking POST request...');
    const createRequests = requests.filter(r => r.url.includes('/api/tasks') && r.method === 'POST');
    console.log(`Task creation requests: ${createRequests.length}`);
    
    if (createRequests.length > 0) {
      console.log('POST request data:', createRequests[0].postData);
    }
    
    // Check for success response
    const createResponses = responses.filter(r => r.url.includes('/api/tasks') && r.status === 200);
    console.log(`Successful API responses: ${createResponses.length}`);
    
    // Wait a bit for UI to update
    await page.waitForTimeout(1000);
    
    // Check if task appears in UI
    console.log('🔍 Step 7: Checking if task appears in UI...');
    const finalTaskCount = await page.locator('.task-card').count();
    console.log(`Final tasks visible in UI: ${finalTaskCount}`);
    
    // Check for any GET requests after creation (reload)
    const postCreateRequests = requests.filter((r, index) => 
      index > createRequests.length && r.url.includes('/api/tasks') && r.method === 'GET'
    );
    console.log(`Task reload requests after creation: ${postCreateRequests.length}`);
    
    // Check localStorage
    const localStorageTasks = await page.evaluate(() => {
      const tasks = localStorage.getItem('tasks');
      return tasks ? JSON.parse(tasks) : [];
    });
    console.log(`Tasks in localStorage: ${localStorageTasks.length}`);
    
    // Check app state
    const appState = await page.evaluate(() => {
      return window.app ? {
        tasksLength: window.app.tasks ? window.app.tasks.length : 'undefined',
        currentUser: window.app.currentUser ? 'exists' : 'null'
      } : 'app not found';
    });
    console.log('App state:', appState);
    
    // Manual verification - try to get tasks via API
    console.log('🔍 Step 8: Manual API check...');
    const apiResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/tasks?userId=default&withAttachments=true');
        const data = await response.json();
        return { success: response.ok, data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    console.log('Direct API response:', apiResponse);
    
    // Summary
    console.log('\n📊 DIAGNOSTIC SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Total requests: ${requests.length}`);
    console.log(`POST /api/tasks: ${createRequests.length}`);
    console.log(`GET /api/tasks: ${requests.filter(r => r.url.includes('/api/tasks') && r.method === 'GET').length}`);
    console.log(`Tasks in UI before: ${initialTaskCount}`);
    console.log(`Tasks in UI after: ${finalTaskCount}`);
    console.log(`Tasks in localStorage: ${localStorageTasks.length}`);
    console.log(`App tasks array: ${appState.tasksLength}`);
    console.log(`API tasks response: ${apiResponse.success ? apiResponse.data.tasks?.length : 'failed'}`);
    
    // The test fails if task doesn't appear - this will help us see where it breaks
    if (finalTaskCount === initialTaskCount) {
      throw new Error(`Task was not added to UI. Initial: ${initialTaskCount}, Final: ${finalTaskCount}`);
    }
    
    expect(finalTaskCount).toBeGreaterThan(initialTaskCount);
  });
});