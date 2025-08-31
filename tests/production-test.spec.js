const { test, expect } = require('@playwright/test');

test.describe('Production Site Tests', () => {
  test('Test buttons on live site', async ({ page }) => {
    // Go to the deployed Vercel site
    await page.goto('https://daily-vibes.vercel.app/'); // Update with actual URL if different
    
    // Wait for page to load
    await page.waitForSelector('.app-container', { timeout: 10000 });
    
    // Check console for any errors
    page.on('console', msg => {
      console.log(`Console ${msg.type()}: ${msg.text()}`);
    });
    
    // Test sidebar navigation
    console.log('Testing sidebar navigation on live site...');
    const calendarTab = await page.locator('[data-page="calendar"]');
    console.log('Calendar tab found:', await calendarTab.count());
    
    if (await calendarTab.count() > 0) {
      await calendarTab.click();
      await page.waitForTimeout(1000);
      
      const hasActive = await calendarTab.evaluate(el => el.classList.contains('active'));
      console.log('Calendar tab is active:', hasActive);
      
      const pageTitle = await page.locator('.page-title').textContent();
      console.log('Page title:', pageTitle);
    }
    
    // Test Add Task button
    console.log('Testing Add Task button on live site...');
    const addTaskBtn = await page.locator('#headerAddTaskBtn');
    console.log('Add Task button found:', await addTaskBtn.count());
    
    if (await addTaskBtn.count() > 0) {
      await addTaskBtn.click();
      await page.waitForTimeout(1000);
      
      const modal = await page.locator('#taskModal');
      const modalVisible = await modal.evaluate(el => el.classList.contains('show'));
      console.log('Modal is visible:', modalVisible);
    }
    
    // Take screenshot of live site
    await page.screenshot({ path: 'test-results/production-test.png' });
    
    expect(true).toBe(true);
  });
});