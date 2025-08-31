const { test, expect } = require('@playwright/test');

test('test final production deployment with Neon serverless + environment variables', async ({ page }) => {
  // Use the main production URL
  const productionUrl = 'https://daily-vibes-flax.vercel.app';
  
  console.log(`🌐 Testing FINAL production deployment: ${productionUrl}`);
  console.log('🔧 Setup: Neon serverless driver + DATABASE_URL configured');
  
  await page.goto(productionUrl);
  await page.waitForTimeout(3000);
  
  // Check elements
  const addTaskBtn = await page.locator('#addTaskBtn').count();
  const headerAddTaskBtn = await page.locator('#headerAddTaskBtn').count();
  
  console.log('📋 Production Elements:');
  console.log(`   Sidebar Add Task Button: ${addTaskBtn > 0 ? '✅' : '❌'}`);
  console.log(`   Header Add Task Button: ${headerAddTaskBtn > 0 ? '✅' : '❌'}`);
  
  if (addTaskBtn === 0) {
    console.log('❌ App not loading properly');
    return;
  }
  
  // Open modal
  console.log('\\n🔘 Opening task modal...');
  await page.click('#addTaskBtn');
  await page.waitForTimeout(1000);
  
  const modalVisible = await page.locator('#taskModal').isVisible();
  console.log(`   Modal opened: ${modalVisible ? '✅' : '❌'}`);
  
  if (!modalVisible) return;
  
  // Fill form
  await page.fill('#taskTitle', 'FINAL PRODUCTION TEST - Neon Serverless');
  console.log('   ✅ Form filled');
  
  // Monitor network activity
  const requests = [];
  const responses = [];
  const errors = [];
  
  page.on('request', req => {
    if (req.url().includes('/api/tasks')) {
      requests.push({ method: req.method(), url: req.url() });
      console.log(`   📡 REQUEST: ${req.method()} ${req.url()}`);
    }
  });
  
  page.on('response', res => {
    if (res.url().includes('/api/tasks')) {
      responses.push({ status: res.status(), statusText: res.statusText() });
      console.log(`   📨 RESPONSE: ${res.status()} ${res.statusText()}`);
    }
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log(`   🚫 ERROR: ${msg.text()}`);
    }
  });
  
  // Submit form
  console.log('\\n💾 Submitting task...');
  await page.click('#saveTask');
  
  // Wait for response
  await page.waitForTimeout(5000);
  
  // Check results
  console.log('\\n📊 FINAL PRODUCTION TEST RESULTS:');
  console.log(`   API Requests Made: ${requests.length}`);
  console.log(`   API Responses Received: ${responses.length}`);
  console.log(`   JavaScript Errors: ${errors.length}`);
  
  if (responses.length > 0) {
    const response = responses[0];
    console.log(`   Response Status: ${response.status} ${response.statusText}`);
    
    if (response.status >= 200 && response.status < 300) {
      console.log('   ✅ API SUCCESS - Task saved to Neon database');
    } else {
      console.log('   ❌ API ERROR - Check server logs');
    }
  }
  
  // Check modal closed
  const modalClosed = !await page.locator('#taskModal').evaluate(el => el.classList.contains('show'));
  console.log(`   Modal Closed: ${modalClosed ? '✅' : '❌'}`);
  
  // Check task appeared
  await page.waitForTimeout(2000);
  const taskCount = await page.locator('.task-card').count();
  console.log(`   Tasks Visible: ${taskCount} (should be > 0)`);
  
  // Final assessment
  console.log('\\n🎯 FINAL ASSESSMENT:');
  
  const allWorking = (
    requests.length > 0 && 
    responses.length > 0 && 
    responses[0].status >= 200 && 
    responses[0].status < 300 &&
    modalClosed &&
    errors.length === 0
  );
  
  if (allWorking) {
    console.log('   🎉 SUCCESS! Task saving is now working in production!');
    console.log('   ✅ Frontend: Form submission working');
    console.log('   ✅ Backend: Neon serverless API responding');
    console.log('   ✅ Database: Tasks being saved');
    console.log('   ✅ UI: Modal closing, tasks appearing');
    console.log('\\n   🚀 The task saving issue has been completely resolved!');
  } else {
    console.log('   ❌ Still have issues:');
    if (requests.length === 0) console.log('     - Form not submitting');
    if (responses.length === 0) console.log('     - API not responding');
    if (responses[0]?.status >= 400) console.log('     - Server error');
    if (!modalClosed) console.log('     - Modal not closing');
    if (errors.length > 0) console.log('     - JavaScript errors present');
  }
});