const { test, expect } = require('@playwright/test');

test('comprehensive component diagnostic for task saving', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  
  console.log('🔍 COMPONENT DIAGNOSTIC - Task Saving Flow');
  console.log('=' * 50);
  
  // Step 1: Check if all required DOM elements exist
  console.log('1️⃣ Checking DOM elements...');
  
  const elements = {
    addTaskBtn: await page.locator('#addTaskBtn').count(),
    headerAddTaskBtn: await page.locator('#headerAddTaskBtn').count(),
    taskModal: await page.locator('#taskModal').count(),
    taskForm: await page.locator('#taskForm').count(),
    saveTask: await page.locator('#saveTask').count(),
    taskTitle: await page.locator('#taskTitle').count(),
    taskDescription: await page.locator('#taskDescription').count()
  };
  
  for (const [name, count] of Object.entries(elements)) {
    console.log(`   ${name}: ${count > 0 ? '✅' : '❌'} (${count})`);
  }
  
  // Step 2: Test modal opening
  console.log('\\n2️⃣ Testing modal opening...');
  
  let modalOpenButton = null;
  if (elements.addTaskBtn > 0) {
    modalOpenButton = page.locator('#addTaskBtn');
    console.log('   Using #addTaskBtn');
  } else if (elements.headerAddTaskBtn > 0) {
    modalOpenButton = page.locator('#headerAddTaskBtn');
    console.log('   Using #headerAddTaskBtn');
  }
  
  if (modalOpenButton) {
    await modalOpenButton.click();
    await page.waitForTimeout(500);
    
    const modalVisible = await page.locator('#taskModal').isVisible();
    const modalHasShow = await page.locator('#taskModal').evaluate(el => el.classList.contains('show'));
    
    console.log(`   Modal visible: ${modalVisible ? '✅' : '❌'}`);
    console.log(`   Modal has 'show' class: ${modalHasShow ? '✅' : '❌'}`);
  } else {
    console.log('   ❌ No modal open button found!');
    return;
  }
  
  // Step 3: Check form elements and their properties
  console.log('\\n3️⃣ Checking form elements...');
  
  const formInfo = await page.evaluate(() => {
    const form = document.getElementById('taskForm');
    const saveBtn = document.getElementById('saveTask');
    
    if (!form) return { error: 'Form not found' };
    if (!saveBtn) return { error: 'Save button not found' };
    
    return {
      formExists: true,
      formAction: form.action,
      formMethod: form.method,
      saveButtonType: saveBtn.type,
      saveButtonDisabled: saveBtn.disabled,
      formValid: form.checkValidity(),
      requiredFields: Array.from(form.querySelectorAll('[required]')).map(el => ({
        id: el.id,
        value: el.value,
        valid: el.checkValidity()
      }))
    };
  });
  
  console.log('   Form info:', formInfo);
  
  // Step 4: Fill minimal required data
  console.log('\\n4️⃣ Filling form data...');
  
  await page.fill('#taskTitle', 'Diagnostic Test Task');
  console.log('   ✅ Title filled');
  
  // Check form validity after filling title
  const validityAfterFill = await page.evaluate(() => {
    const form = document.getElementById('taskForm');
    return form ? form.checkValidity() : false;
  });
  console.log(`   Form valid after fill: ${validityAfterFill ? '✅' : '❌'}`);
  
  // Step 5: Check JavaScript app state
  console.log('\\n5️⃣ Checking app state...');
  
  const appState = await page.evaluate(() => {
    return {
      appExists: typeof window.app !== 'undefined',
      appInitialized: window.app?.initialized || false,
      taskCount: window.app?.tasks?.length || 0,
      currentUser: window.app?.currentUser?.id || 'default',
      handleTaskSubmitExists: typeof window.app?.handleTaskSubmit === 'function',
      createTaskExists: typeof window.app?.createTask === 'function'
    };
  });
  
  console.log('   App state:', appState);
  
  // Step 6: Test event listeners
  console.log('\\n6️⃣ Testing event listeners...');
  
  const eventListeners = await page.evaluate(() => {
    const form = document.getElementById('taskForm');
    const saveBtn = document.getElementById('saveTask');
    
    // Check if form has submit event listeners
    const formListeners = getEventListeners ? getEventListeners(form) : 'getEventListeners not available';
    const btnListeners = getEventListeners ? getEventListeners(saveBtn) : 'getEventListeners not available';
    
    return {
      formHasListeners: formListeners !== 'getEventListeners not available' ? Object.keys(formListeners).length > 0 : 'unknown',
      saveButtonHasListeners: btnListeners !== 'getEventListeners not available' ? Object.keys(btnListeners).length > 0 : 'unknown'
    };
  });
  
  console.log('   Event listeners:', eventListeners);
  
  // Step 7: Monitor network and console during submission
  console.log('\\n7️⃣ Testing form submission...');
  
  const requests = [];
  const consoleMessages = [];
  const errors = [];
  
  page.on('request', req => {
    if (req.url().includes('/api/tasks')) {
      requests.push({
        method: req.method(),
        url: req.url(),
        postData: req.postData()
      });
      console.log(`   📡 ${req.method()} ${req.url()}`);
    }
  });
  
  page.on('console', msg => {
    consoleMessages.push(msg.text());
    if (msg.type() === 'error') {
      console.log(`   🚫 Console Error: ${msg.text()}`);
    } else {
      console.log(`   📋 Console: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`   💥 Page Error: ${error.message}`);
  });
  
  // Click the save button
  console.log('   🔄 Clicking save button...');
  await page.click('#saveTask');
  
  // Wait for any async operations
  await page.waitForTimeout(3000);
  
  // Step 8: Final results
  console.log('\\n8️⃣ Final Results:');
  console.log(`   API Requests: ${requests.length}`);
  console.log(`   Console Messages: ${consoleMessages.length}`);
  console.log(`   JavaScript Errors: ${errors.length}`);
  
  if (requests.length > 0) {
    console.log(`   ✅ Task saving API call was made`);
    if (requests[0].postData) {
      const data = JSON.parse(requests[0].postData);
      console.log(`   📝 Task title: "${data.title}"`);
    }
  } else {
    console.log(`   ❌ No API calls made - form submission failed`);
  }
  
  const modalStillOpen = await page.locator('#taskModal').evaluate(el => el.classList.contains('show'));
  console.log(`   Modal still open: ${modalStillOpen ? '❌' : '✅'}`);
  
  if (errors.length > 0) {
    console.log('\\n💥 JAVASCRIPT ERRORS:');
    errors.forEach(err => console.log(`   - ${err}`));
  }
  
  // Summary
  console.log('\\n📊 DIAGNOSIS SUMMARY:');
  if (requests.length > 0 && !modalStillOpen && errors.length === 0) {
    console.log('   ✅ All components working correctly');
  } else {
    console.log('   ❌ Issues found:');
    if (requests.length === 0) console.log('   - Form submission not triggering API call');
    if (modalStillOpen) console.log('   - Modal not closing after submission');
    if (errors.length > 0) console.log('   - JavaScript errors present');
  }
});