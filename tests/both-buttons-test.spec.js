const { test, expect } = require('@playwright/test');

test('test both add task buttons work correctly', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  
  console.log('🔍 Testing both Add Task buttons...');
  
  // Check if both buttons exist now
  const addTaskBtn = await page.locator('#addTaskBtn').count();
  const headerAddTaskBtn = await page.locator('#headerAddTaskBtn').count();
  
  console.log(`Sidebar Add Task button: ${addTaskBtn > 0 ? '✅' : '❌'} (${addTaskBtn})`);
  console.log(`Header Add Task button: ${headerAddTaskBtn > 0 ? '✅' : '❌'} (${headerAddTaskBtn})`);
  
  if (headerAddTaskBtn === 0) {
    console.log('❌ Header button still missing - HTML may not have refreshed');
    return;
  }
  
  // Test 1: Sidebar button
  console.log('\\n1️⃣ Testing sidebar button...');
  await page.click('#addTaskBtn');
  await page.waitForTimeout(500);
  
  let modalVisible = await page.locator('#taskModal').evaluate(el => el.classList.contains('show'));
  console.log(`Modal opened by sidebar button: ${modalVisible ? '✅' : '❌'}`);
  
  if (modalVisible) {
    await page.press('body', 'Escape'); // Close modal
    await page.waitForTimeout(500);
  }
  
  // Test 2: Header button
  console.log('\\n2️⃣ Testing header button...');
  await page.click('#headerAddTaskBtn');
  await page.waitForTimeout(500);
  
  modalVisible = await page.locator('#taskModal').evaluate(el => el.classList.contains('show'));
  console.log(`Modal opened by header button: ${modalVisible ? '✅' : '❌'}`);
  
  if (!modalVisible) {
    console.log('❌ Header button not opening modal - event listener may not be attached');
    return;
  }
  
  // Test 3: Form submission
  console.log('\\n3️⃣ Testing form submission...');
  
  await page.fill('#taskTitle', 'Button Test Task');
  
  const requests = [];
  page.on('request', req => {
    if (req.url().includes('/api/tasks') && req.method() === 'POST') {
      requests.push(req);
      console.log(`✅ API request made: ${req.method()} ${req.url()}`);
    }
  });
  
  console.log('Clicking save button...');
  await page.click('#saveTask');
  
  await page.waitForTimeout(3000);
  
  console.log(`\\n📊 Results:`);
  console.log(`API requests: ${requests.length}`);
  
  const modalStillOpen = await page.locator('#taskModal').evaluate(el => el.classList.contains('show'));
  console.log(`Modal closed: ${!modalStillOpen ? '✅' : '❌'}`);
  
  if (requests.length > 0 && !modalStillOpen) {
    console.log('✅ Task saving is working correctly!');
  } else {
    console.log('❌ Task saving still has issues');
    
    // Additional diagnostics
    const formInfo = await page.evaluate(() => {
      const form = document.getElementById('taskForm');
      const saveBtn = document.getElementById('saveTask');
      
      return {
        formExists: !!form,
        saveButtonExists: !!saveBtn,
        formValid: form ? form.checkValidity() : false,
        taskFormEventListeners: form ? 'has-listeners' : 'no-form'
      };
    });
    
    console.log('Form diagnostics:', formInfo);
  }
});