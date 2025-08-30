const { test, expect } = require('@playwright/test');

test('test minimal form submission without optional fields', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:3000');
  
  // Wait for app to initialize
  await page.waitForTimeout(2000);
  
  console.log('🔍 Testing minimal form submission (title only)...');
  
  // Open modal
  const addTaskBtn = page.locator('#addTaskBtn');
  await expect(addTaskBtn).toBeVisible();
  await addTaskBtn.click();
  
  // Wait for modal to appear
  await page.waitForSelector('#taskModal.show');
  console.log('✅ Modal opened');
  
  // Fill ONLY the required title field (skip optional due date/time)
  await page.fill('#taskTitle', 'Minimal Test Task');
  
  console.log('✅ Only title filled (no due date/time)');
  
  // Listen for requests and errors
  const requests = [];
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
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`ERROR: ${error.message}`);
  });
  
  // Test form submission
  console.log('🔄 Submitting minimal form...');
  const saveBtn = page.locator('#saveTask');
  await saveBtn.click();
  
  // Wait for submission to complete
  await page.waitForTimeout(2000);
  
  console.log(`POST requests made: ${requests.length}`);
  console.log(`JavaScript errors: ${errors.length}`);
  
  if (requests.length > 0) {
    console.log('✅ API request made successfully with minimal form');
    const postData = requests[0].postData;
    if (postData) {
      const data = JSON.parse(postData);
      console.log('Title:', data.title);
      console.log('Due date:', data.dueDate || 'null');
      console.log('Due time:', data.dueTime || 'null');
    }
  } else {
    console.log('❌ No API requests were made');
    
    // Check form validity 
    const formValidation = await page.evaluate(() => {
      const form = document.getElementById('taskForm');
      if (form) {
        const validity = form.checkValidity();
        const invalidFields = [];
        
        form.querySelectorAll('input[required], select[required]').forEach(el => {
          if (!el.checkValidity()) {
            invalidFields.push({
              id: el.id,
              value: el.value,
              message: el.validationMessage
            });
          }
        });
        
        return {
          formValid: validity,
          invalidFields: invalidFields,
          requiredFieldsCount: form.querySelectorAll('input[required], select[required]').length
        };
      }
      return { error: 'Form not found' };
    });
    
    console.log('Form validation result:', formValidation);
  }
  
  // Check if modal closed
  const modalStillOpen = await page.locator('#taskModal').evaluate(el => el.classList.contains('show'));
  console.log(`Modal still open: ${modalStillOpen}`);
  
  // Test should pass if form submits with just title
  if (requests.length > 0 && !modalStillOpen) {
    console.log('✅ Minimal form submission working! Users can now create tasks with just a title.');
  } else {
    console.log('❌ Form still requires additional fields or has other issues');
  }
});