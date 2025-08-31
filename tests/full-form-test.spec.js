const { test, expect } = require('@playwright/test');

test('test full form submission with all required fields', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:3000');
  
  // Wait for app to initialize
  await page.waitForTimeout(2000);
  
  console.log('🔍 Testing complete form submission...');
  
  // Open modal
  const addTaskBtn = page.locator('#addTaskBtn');
  await expect(addTaskBtn).toBeVisible();
  await addTaskBtn.click();
  
  // Wait for modal to appear
  await page.waitForSelector('#taskModal.show');
  console.log('✅ Modal opened');
  
  // Fill ALL required fields
  await page.fill('#taskTitle', 'Complete Form Test');
  await page.fill('#taskDescription', 'Testing all required fields');
  await page.selectOption('#taskPriority', 'high');
  await page.selectOption('#taskCategory', 'work');
  
  // Set due date and time (these are marked as required)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateString = tomorrow.toISOString().split('T')[0];
  
  await page.fill('#taskDueDate', dateString);
  await page.fill('#taskDueTime', '14:30');
  
  console.log('✅ All required fields filled');
  
  // Listen for validation errors and requests
  const requests = [];
  const consoleLogs = [];
  const errors = [];
  
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
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`ERROR: ${error.message}`);
  });
  
  // Test form submission
  console.log('🔄 Submitting complete form...');
  const saveBtn = page.locator('#saveTask');
  await saveBtn.click();
  
  // Wait for submission to complete
  await page.waitForTimeout(3000);
  
  console.log(`POST requests made: ${requests.length}`);
  console.log(`Console messages: ${consoleLogs.length}`);
  console.log(`JavaScript errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('❌ JavaScript errors found:');
    errors.forEach(err => console.log(`  - ${err}`));
  }
  
  if (requests.length > 0) {
    console.log('✅ API request made successfully');
    const postData = requests[0].postData;
    if (postData) {
      const data = JSON.parse(postData);
      console.log('Request data keys:', Object.keys(data));
      console.log('Title:', data.title);
      console.log('Due date:', data.dueDate);
      console.log('Due time:', data.dueTime);
    }
  } else {
    console.log('❌ No API requests were made');
    
    // Check form validity
    const formValid = await page.evaluate(() => {
      const form = document.getElementById('taskForm');
      if (form) {
        const validity = form.checkValidity();
        const invalidElements = [];
        form.querySelectorAll('input[required], select[required]').forEach(el => {
          if (!el.checkValidity()) {
            invalidElements.push({
              id: el.id,
              value: el.value,
              validationMessage: el.validationMessage
            });
          }
        });
        return {
          valid: validity,
          invalidElements: invalidElements
        };
      }
      return { valid: false, error: 'Form not found' };
    });
    
    console.log('Form validity:', formValid);
  }
  
  // Check if modal closed
  const modalStillOpen = await page.locator('#taskModal').evaluate(el => el.classList.contains('show'));
  console.log(`Modal still open: ${modalStillOpen}`);
  
  // Check if task appeared in UI
  const taskCount = await page.locator('.task-card').count();
  console.log(`Tasks visible in UI: ${taskCount}`);
  
  // If everything worked, the form should be submitted and modal closed
  if (requests.length > 0 && !modalStillOpen) {
    console.log('✅ Full form submission working correctly!');
  } else {
    console.log('❌ Form submission issue detected');
  }
});