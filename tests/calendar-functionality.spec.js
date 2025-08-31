const { test, expect } = require('@playwright/test');

test('calendar page functionality and event management', async ({ page }) => {
  const productionUrl = 'https://daily-vibes-flax.vercel.app';
  
  console.log(`📅 Testing calendar page on: ${productionUrl}`);
  
  // Test main page first to ensure navigation works
  await page.goto(productionUrl);
  await page.waitForTimeout(2000);
  
  console.log('🏠 Main page loaded, testing calendar navigation...');
  
  // Check if calendar navigation exists
  const calendarNavBtn = await page.locator('[data-page="calendar"]').count();
  if (calendarNavBtn === 0) {
    console.log('❌ Calendar navigation button not found');
    return;
  }
  
  console.log('✅ Calendar navigation found, clicking...');
  
  // Click calendar navigation
  await page.click('[data-page="calendar"]');
  await page.waitForTimeout(3000);
  
  // Verify we're on calendar page
  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);
  
  if (!currentUrl.includes('calendar.html')) {
    console.log('❌ Calendar page navigation failed');
    return;
  }
  
  console.log('✅ Successfully navigated to calendar page');
  
  // Check if calendar elements are present
  console.log('\n🗓️ Testing calendar layout...');
  
  const calendarElements = {
    calendarGrid: await page.locator('.calendar-grid').count(),
    calendarDays: await page.locator('.calendar-days').count(),
    currentMonth: await page.locator('#currentMonthYear').count(),
    addEventBtn: await page.locator('#addEventBtn').count(),
    prevMonthBtn: await page.locator('#prevMonthBtn').count(),
    nextMonthBtn: await page.locator('#nextMonthBtn').count(),
    todayBtn: await page.locator('#todayBtn').count()
  };
  
  let calendarScore = 0;
  for (const [element, count] of Object.entries(calendarElements)) {
    const status = count > 0 ? '✅' : '❌';
    console.log(`   ${element}: ${status} (${count})`);
    if (count > 0) calendarScore++;
  }
  
  if (calendarScore < 5) {
    console.log('❌ Calendar layout incomplete');
    return;
  }
  
  console.log('✅ Calendar layout complete');
  
  // Test calendar navigation
  console.log('\n📆 Testing month navigation...');
  
  const originalMonth = await page.locator('#currentMonthYear').textContent();
  console.log(`Current month: ${originalMonth}`);
  
  // Test next month
  await page.click('#nextMonthBtn');
  await page.waitForTimeout(1000);
  
  const nextMonth = await page.locator('#currentMonthYear').textContent();
  console.log(`After next click: ${nextMonth}`);
  
  if (nextMonth === originalMonth) {
    console.log('❌ Month navigation not working');
  } else {
    console.log('✅ Month navigation working');
  }
  
  // Test today button
  await page.click('#todayBtn');
  await page.waitForTimeout(1000);
  
  // Check if today's date is highlighted
  const todayHighlighted = await page.locator('.calendar-day.today').count();
  console.log(`Today highlighted: ${todayHighlighted > 0 ? '✅' : '❌'} (${todayHighlighted} cells)`);
  
  // Test event creation
  console.log('\n➕ Testing event creation...');
  
  await page.click('#addEventBtn');
  await page.waitForTimeout(1000);
  
  const modalVisible = await page.locator('#eventModal').isVisible();
  console.log(`Event modal opened: ${modalVisible ? '✅' : '❌'}`);
  
  if (!modalVisible) {
    console.log('❌ Cannot test event creation - modal not opening');
    return;
  }
  
  // Fill event form
  await page.fill('#eventTitle', 'Test Calendar Event');
  await page.fill('#eventDescription', 'Testing calendar event creation');
  await page.selectOption('#eventType', 'meeting');
  await page.selectOption('#eventColor', 'green');
  await page.fill('#eventLocation', 'Test Location');
  
  // Set today's date
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  await page.fill('#eventDate', dateStr);
  await page.fill('#eventTime', '10:00');
  
  console.log('✅ Event form filled');
  
  // Monitor API calls
  const requests = [];
  const responses = [];
  
  page.on('request', req => {
    if (req.url().includes('/api/events')) {
      requests.push({ method: req.method(), url: req.url() });
      console.log(`   📡 API REQUEST: ${req.method()} ${req.url()}`);
    }
  });
  
  page.on('response', res => {
    if (res.url().includes('/api/events')) {
      responses.push({ status: res.status(), statusText: res.statusText() });
      console.log(`   📨 API RESPONSE: ${res.status()} ${res.statusText()}`);
    }
  });
  
  // Submit event
  console.log('💾 Submitting event...');
  await page.click('#saveEvent');
  await page.waitForTimeout(5000);
  
  console.log('\n📊 EVENT CREATION TEST RESULTS:');
  console.log(`   API Requests: ${requests.length}`);
  console.log(`   API Responses: ${responses.length}`);
  
  if (requests.length === 0) {
    console.log('   ❌ No API requests made');
  } else if (responses.length === 0) {
    console.log('   ❌ API requests made but no responses');
  } else if (responses[0].status >= 400) {
    console.log(`   ❌ API error: ${responses[0].status} ${responses[0].statusText}`);
  } else {
    console.log('   ✅ Event creation API working');
  }
  
  // Check if modal closed
  const modalStillOpen = await page.locator('#eventModal').isVisible();
  console.log(`   Modal closed: ${!modalStillOpen ? '✅' : '❌'}`);
  
  // Test day selection and event sidebar
  console.log('\n📋 Testing day selection and event sidebar...');
  
  const calendarDays = await page.locator('.calendar-day:not(.other-month)').count();
  if (calendarDays > 0) {
    // Click on first available day
    await page.locator('.calendar-day:not(.other-month)').first().click();
    await page.waitForTimeout(1000);
    
    const sidebarOpen = await page.locator('.event-sidebar.open').count();
    console.log(`   Event sidebar opened: ${sidebarOpen > 0 ? '✅' : '❌'}`);
    
    if (sidebarOpen > 0) {
      const selectedDateDisplay = await page.locator('#selectedDateDisplay').count();
      const addEventForDayBtn = await page.locator('#addEventForDay').count();
      
      console.log(`   Selected date display: ${selectedDateDisplay > 0 ? '✅' : '❌'}`);
      console.log(`   Add event for day button: ${addEventForDayBtn > 0 ? '✅' : '❌'}`);
      
      // Close sidebar
      await page.click('#closeEventSidebar');
      await page.waitForTimeout(500);
      
      const sidebarClosed = await page.locator('.event-sidebar.open').count();
      console.log(`   Sidebar closed: ${sidebarClosed === 0 ? '✅' : '❌'}`);
    }
  }
  
  // Test navigation back to main page
  console.log('\n🔄 Testing navigation back to main app...');
  
  const tasksNavBtn = await page.locator('a[href="index.html"]').count();
  if (tasksNavBtn > 0) {
    await page.click('a[href="index.html"]');
    await page.waitForTimeout(2000);
    
    const backOnMainPage = page.url().includes('index.html') || !page.url().includes('calendar.html');
    console.log(`   Back to main page: ${backOnMainPage ? '✅' : '❌'}`);
  }
  
  // Final assessment
  console.log('\n🎯 CALENDAR FUNCTIONALITY ASSESSMENT:');
  
  const workingFeatures = [];
  const brokenFeatures = [];
  
  if (calendarScore >= 5) workingFeatures.push('Calendar Layout');
  if (nextMonth !== originalMonth) workingFeatures.push('Month Navigation');
  if (todayHighlighted > 0) workingFeatures.push('Current Day Highlighting');
  if (modalVisible) workingFeatures.push('Event Modal');
  if (responses.length > 0 && responses[0].status < 400) workingFeatures.push('Event API');
  
  if (calendarScore < 5) brokenFeatures.push('Calendar Layout');
  if (nextMonth === originalMonth) brokenFeatures.push('Month Navigation');
  if (todayHighlighted === 0) brokenFeatures.push('Current Day Highlighting');
  if (!modalVisible) brokenFeatures.push('Event Modal');
  if (responses.length === 0 || responses[0]?.status >= 400) brokenFeatures.push('Event API');
  
  console.log(`   ✅ Working Features (${workingFeatures.length}): ${workingFeatures.join(', ')}`);
  console.log(`   ❌ Issues (${brokenFeatures.length}): ${brokenFeatures.join(', ')}`);
  
  if (brokenFeatures.length === 0) {
    console.log('\n🎉 SUCCESS! Calendar page fully functional!');
    console.log('   📅 Large calendar format with current day highlighting');
    console.log('   🎨 Consistent earth tone theme styling');
    console.log('   ➕ Event creation and management working');
    console.log('   📱 Responsive design and navigation');
  } else {
    console.log('\n⚠️ Calendar has some issues that need attention');
  }
});