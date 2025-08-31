const { test, expect } = require('@playwright/test');

test('test API endpoint directly on production', async ({ page }) => {
  const productionUrl = 'https://daily-vibes-flax.vercel.app';
  
  console.log(`🌐 Testing production API: ${productionUrl}/api/tasks`);
  
  // Navigate to production URL first to get cookies/session if needed
  await page.goto(productionUrl);
  await page.waitForTimeout(1000);
  
  // Test the API endpoint directly
  const apiResponse = await page.evaluate(async (baseUrl) => {
    try {
      console.log('Making API request...');
      const response = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'default',
          title: 'API Test Task',
          description: 'Testing API directly',
          priority: 'medium',
          category: 'work',
          status: 'todo'
        })
      });
      
      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText.substring(0, 500));
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (e) {
        parsedResponse = { parseError: 'Could not parse as JSON', rawText: responseText };
      }
      
      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: parsedResponse,
        rawText: responseText
      };
    } catch (error) {
      return {
        error: error.message,
        stack: error.stack
      };
    }
  }, productionUrl);
  
  console.log('📊 API Test Results:');
  console.log(`   Status: ${apiResponse.status || 'ERROR'}`);
  console.log(`   Status Text: ${apiResponse.statusText || 'N/A'}`);
  
  if (apiResponse.error) {
    console.log(`   🚫 Network Error: ${apiResponse.error}`);
  } else {
    console.log(`   📄 Response Body:`, JSON.stringify(apiResponse.body, null, 2));
    
    if (apiResponse.status === 500) {
      console.log('   🚨 Server Error - likely database connection issue');
      console.log('   Raw response:', apiResponse.rawText);
    } else if (apiResponse.status === 404) {
      console.log('   🚨 API endpoint not found - deployment issue');
    } else if (apiResponse.status >= 200 && apiResponse.status < 300) {
      console.log('   ✅ API working correctly');
    } else {
      console.log(`   ⚠️  Unexpected status: ${apiResponse.status}`);
    }
  }
  
  // Also test GET endpoint
  console.log('\\n🔍 Testing GET /api/tasks...');
  
  const getResponse = await page.evaluate(async (baseUrl) => {
    try {
      const response = await fetch(`${baseUrl}/api/tasks?userId=default&withAttachments=true`);
      const responseText = await response.text();
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (e) {
        parsedResponse = { parseError: 'Could not parse as JSON', rawText: responseText };
      }
      
      return {
        status: response.status,
        body: parsedResponse,
        rawText: responseText
      };
    } catch (error) {
      return { error: error.message };
    }
  }, productionUrl);
  
  console.log('📊 GET API Results:');
  console.log(`   Status: ${getResponse.status || 'ERROR'}`);
  if (getResponse.error) {
    console.log(`   🚫 Error: ${getResponse.error}`);
  } else {
    console.log(`   📄 Response:`, JSON.stringify(getResponse.body, null, 2));
  }
  
  // Diagnosis
  console.log('\\n🩺 DIAGNOSIS:');
  if (apiResponse.error) {
    console.log('   🚨 Network/Connection Error - API endpoints may not be deployed');
  } else if (apiResponse.status === 500) {
    console.log('   🚨 Database Connection Error - DATABASE_URL not configured in Vercel');
  } else if (apiResponse.status === 404) {
    console.log('   🚨 Serverless Function Not Deployed - check vercel.json routing');
  } else if (apiResponse.status >= 200 && apiResponse.status < 300) {
    console.log('   ✅ Backend API is working - frontend issue');
  } else {
    console.log('   ⚠️  Unknown backend issue - check server logs');
  }
});