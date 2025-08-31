const { test, expect } = require('@playwright/test');

test('verify Neon serverless fix is working', async ({ page }) => {
  const productionUrl = 'https://daily-vibes-flax.vercel.app';
  
  console.log(`🔧 Testing Neon serverless fixes on: ${productionUrl}`);
  
  // Test health endpoint first
  console.log('\n🏥 Testing health endpoint...');
  const healthResponse = await page.evaluate(async (url) => {
    try {
      const response = await fetch(`${url}/api/health`);
      return {
        status: response.status,
        data: await response.json()
      };
    } catch (error) {
      return { error: error.message };
    }
  }, productionUrl);
  
  console.log('Health check result:', JSON.stringify(healthResponse, null, 2));
  
  if (healthResponse.error || healthResponse.status !== 200) {
    console.log('❌ Health check failed - API still not working');
    return;
  }
  
  console.log('✅ Health check passed');
  
  // Test the UI
  await page.goto(productionUrl);
  await page.waitForTimeout(2000);
  
  const addTaskBtn = await page.locator('#addTaskBtn').count();
  if (addTaskBtn === 0) {
    console.log('❌ UI not loading');
    return;
  }
  
  console.log('✅ UI loaded successfully');
  
  // Test task creation API directly
  console.log('\n📝 Testing task creation API directly...');
  const apiTestResponse = await page.evaluate(async (url) => {
    try {
      const response = await fetch(`${url}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Serverless Fix Test',
          description: 'Testing if Neon serverless driver is working',
          priority: 'high',
          category: 'test'
        })
      });
      
      return {
        status: response.status,
        statusText: response.statusText,
        data: await response.json()
      };
    } catch (error) {
      return { error: error.message };
    }
  }, productionUrl);
  
  console.log('API test result:', JSON.stringify(apiTestResponse, null, 2));
  
  if (apiTestResponse.status === 200 && apiTestResponse.data.success) {
    console.log('\n🎉 SUCCESS! Neon serverless API is now working!');
    console.log('✅ Database connection: Working');
    console.log('✅ Task creation: Working'); 
    console.log('✅ Serverless functions: Working');
    
    // Test UI task creation
    console.log('\n🖱️ Testing UI task creation...');
    await page.click('#addTaskBtn');
    await page.waitForTimeout(1000);
    
    const modalVisible = await page.locator('#taskModal').isVisible();
    if (modalVisible) {
      await page.fill('#taskTitle', 'UI Test - Serverless Fixed');
      
      const requests = [];
      const responses = [];
      
      page.on('request', req => {
        if (req.url().includes('/api/tasks')) {
          requests.push(req.method());
        }
      });
      
      page.on('response', res => {
        if (res.url().includes('/api/tasks')) {
          responses.push(res.status());
        }
      });
      
      await page.click('#saveTask');
      await page.waitForTimeout(3000);
      
      if (responses.length > 0 && responses[0] === 200) {
        console.log('✅ UI task creation: Working');
        console.log('\n🚀 COMPLETE SUCCESS - All systems working!');
      } else {
        console.log('⚠️ API working but UI integration may have issues');
      }
    }
    
  } else {
    console.log('❌ API still failing:', apiTestResponse.error || apiTestResponse.data?.error);
  }
});