const { test, expect } = require('@playwright/test');

test('test new deployment URL with Neon serverless', async ({ page }) => {
  // Use the new deployment URL from vercel deploy
  const newUrl = 'https://daily-vibe-53u3rxu50-ekoapps.vercel.app';
  
  console.log(`🌐 Testing NEW deployment URL: ${newUrl}`);
  
  await page.goto(newUrl);
  await page.waitForTimeout(3000);
  
  // Quick test - just try to create a task
  const addTaskBtn = await page.locator('#addTaskBtn').count();
  console.log(`Add task button exists: ${addTaskBtn > 0 ? '✅' : '❌'}`);
  
  if (addTaskBtn === 0) return;
  
  await page.click('#addTaskBtn');
  await page.waitForTimeout(1000);
  
  const modalVisible = await page.locator('#taskModal').isVisible();
  console.log(`Modal opens: ${modalVisible ? '✅' : '❌'}`);
  
  if (!modalVisible) return;
  
  await page.fill('#taskTitle', 'New URL Test');
  
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
      responses.push({ status: res.status() });
      console.log(`📨 ${res.status()}`);
    }
  });
  
  console.log('🔄 Testing API...');
  await page.click('#saveTask');
  await page.waitForTimeout(5000);
  
  console.log(`Requests: ${requests.length}, Responses: ${responses.length}`);
  
  if (responses.length > 0) {
    console.log(`✅ API responding! Status: ${responses[0].status}`);
  } else {
    console.log(`❌ API still not responding on new URL`);
    
    // Check if it's a domain/DNS issue by testing a direct API call
    const apiTest = await page.evaluate(async (baseUrl) => {
      try {
        const response = await fetch(`${baseUrl}/api/health`, { method: 'GET' });
        return { status: response.status, ok: response.ok };
      } catch (error) {
        return { error: error.message };
      }
    }, newUrl);
    
    console.log('Health check result:', apiTest);
  }
});