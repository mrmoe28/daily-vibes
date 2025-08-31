const { test, expect } = require('@playwright/test');

test('test Neon serverless setup locally', async ({ page }) => {
  console.log('🧪 Testing updated Neon serverless database locally...');
  
  // Navigate to local server
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  
  // Check elements exist
  const addTaskBtn = await page.locator('#addTaskBtn').count();
  console.log(`Add task button: ${addTaskBtn > 0 ? '✅' : '❌'}`);
  
  if (addTaskBtn === 0) return;
  
  // Test task creation with Neon serverless
  await page.click('#addTaskBtn');
  await page.waitForTimeout(500);
  
  const modalVisible = await page.locator('#taskModal').isVisible();
  console.log(`Modal opened: ${modalVisible ? '✅' : '❌'}`);
  
  if (!modalVisible) return;
  
  await page.fill('#taskTitle', 'Neon Serverless Test');
  
  // Monitor API calls
  const requests = [];
  const responses = [];
  
  page.on('request', req => {
    if (req.url().includes('/api/tasks')) {
      requests.push({ method: req.method(), url: req.url() });
      console.log(`📡 ${req.method()} ${req.url()}`);
    }
  });
  
  page.on('response', res => {
    if (res.url().includes('/api/tasks')) {
      responses.push({ status: res.status(), url: res.url() });
      console.log(`📨 ${res.status()} ${res.url()}`);
    }
  });
  
  // Submit form
  console.log('🔄 Testing form submission with Neon serverless...');
  await page.click('#saveTask');
  await page.waitForTimeout(3000);
  
  console.log('📊 Results:');
  console.log(`   API Requests: ${requests.length}`);
  console.log(`   API Responses: ${responses.length}`);
  
  const modalClosed = !await page.locator('#taskModal').evaluate(el => el.classList.contains('show'));
  console.log(`   Modal closed: ${modalClosed ? '✅' : '❌'}`);
  
  if (requests.length > 0 && responses.length > 0 && modalClosed) {
    console.log('✅ Neon serverless setup working locally!');
  } else {
    console.log('❌ Issues with Neon serverless setup');
  }
});