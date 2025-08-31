const { test, expect } = require('@playwright/test');

test('test task saving on production Vercel deployment', async ({ page }) => {
  const productionUrl = 'https://daily-vibes-flax.vercel.app';
  
  console.log(`🌐 Testing production deployment: ${productionUrl}`);
  
  // Navigate to production URL
  await page.goto(productionUrl);
  await page.waitForTimeout(3000);
  
  console.log('📋 Checking production elements...');
  
  // Check if core elements exist
  const elements = {
    addTaskBtn: await page.locator('#addTaskBtn').count(),
    headerAddTaskBtn: await page.locator('#headerAddTaskBtn').count(),
    taskModal: await page.locator('#taskModal').count(),
    taskForm: await page.locator('#taskForm').count(),
    saveTask: await page.locator('#saveTask').count(),
  };
  
  for (const [name, count] of Object.entries(elements)) {
    console.log(`   ${name}: ${count > 0 ? '✅' : '❌'} (${count})`);
  }
  
  if (elements.addTaskBtn === 0) {
    console.log('❌ Core elements missing - checking page content...');
    const title = await page.title();
    const bodyText = await page.locator('body').textContent();
    console.log(`Page title: ${title}`);
    console.log(`Body contains "TaskFlow": ${bodyText.includes('TaskFlow')}`);
    return;
  }
  
  // Test modal opening
  console.log('\\n🔘 Testing modal opening...');
  await page.click('#addTaskBtn');
  await page.waitForTimeout(1000);
  
  const modalVisible = await page.locator('#taskModal').isVisible();
  const modalHasShow = await page.locator('#taskModal').evaluate(el => el.classList.contains('show'));
  
  console.log(`   Modal visible: ${modalVisible ? '✅' : '❌'}`);
  console.log(`   Modal has show class: ${modalHasShow ? '✅' : '❌'}`);
  
  if (!modalVisible || !modalHasShow) {
    console.log('❌ Modal not opening in production');
    
    // Check for JavaScript errors
    const jsErrors = [];
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });
    
    console.log('JavaScript errors:', jsErrors);
    return;
  }
  
  // Fill form
  console.log('\\n📝 Testing form submission...');
  await page.fill('#taskTitle', 'Production Test Task');
  console.log('   ✅ Title filled');
  
  // Monitor network and console
  const requests = [];
  const responses = [];
  const consoleErrors = [];
  
  page.on('request', req => {
    if (req.url().includes('/api/tasks')) {
      requests.push({
        method: req.method(),
        url: req.url(),
        postData: req.postData()
      });
      console.log(`   📡 REQUEST: ${req.method()} ${req.url()}`);
    }
  });
  
  page.on('response', res => {
    if (res.url().includes('/api/tasks')) {
      responses.push({
        status: res.status(),
        url: res.url(),
        statusText: res.statusText()
      });
      console.log(`   📨 RESPONSE: ${res.status()} ${res.statusText()}`);
    }
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`   🚫 CONSOLE ERROR: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    consoleErrors.push(error.message);
    console.log(`   💥 PAGE ERROR: ${error.message}`);
  });
  
  // Submit form
  console.log('   🔄 Clicking save button...');
  await page.click('#saveTask');
  
  // Wait for network activity
  await page.waitForTimeout(5000);
  
  // Analyze results
  console.log('\\n📊 PRODUCTION TEST RESULTS:');
  console.log(`   API Requests: ${requests.length}`);
  console.log(`   API Responses: ${responses.length}`);
  console.log(`   Console Errors: ${consoleErrors.length}`);
  
  if (requests.length === 0) {
    console.log('\\n❌ NO API REQUESTS MADE IN PRODUCTION');
    
    // Check form validation
    const formValidation = await page.evaluate(() => {
      const form = document.getElementById('taskForm');
      if (!form) return { error: 'Form not found' };
      
      return {
        formExists: true,
        formValid: form.checkValidity(),
        formMethod: form.method,
        formAction: form.action,
        requiredFields: Array.from(form.querySelectorAll('[required]')).map(el => ({
          id: el.id,
          type: el.type,
          value: el.value,
          valid: el.checkValidity(),
          validationMessage: el.validationMessage
        }))
      };
    });
    
    console.log('\\n🔍 FORM DIAGNOSTICS:');
    console.log('   Form info:', JSON.stringify(formValidation, null, 2));
    
  } else {
    console.log('\\n✅ API REQUEST MADE');
    
    if (responses.length > 0) {
      const response = responses[0];
      console.log(`   Response: ${response.status} ${response.statusText}`);
      
      if (response.status >= 400) {
        console.log('   ❌ Server returned error response');
      }
    } else {
      console.log('   ⚠️  Request made but no response received');
    }
  }
  
  // Check modal state
  const modalStillOpen = await page.locator('#taskModal').evaluate(el => el.classList.contains('show'));
  console.log(`\\n🔲 Modal still open: ${modalStillOpen ? '❌ YES' : '✅ NO'}`);
  
  // Check if task appeared in UI
  const taskCount = await page.locator('.task-card').count();
  console.log(`🎯 Tasks visible in UI: ${taskCount}`);
  
  // Final diagnosis
  console.log('\\n🩺 PRODUCTION DIAGNOSIS:');
  if (requests.length === 0) {
    console.log('   🚨 CRITICAL: Form submission not working in production');
  } else if (responses.length === 0) {
    console.log('   🚨 CRITICAL: API not responding in production');
  } else if (responses[0].status >= 400) {
    console.log('   🚨 CRITICAL: Server error in production');
  } else if (modalStillOpen) {
    console.log('   ⚠️  Task saved but modal not closing');
  } else {
    console.log('   ✅ Task saving working correctly');
  }
});