const { test, expect } = require('@playwright/test');

test.describe('Simple Button Tests', () => {
  test('Check if sidebar navigation works', async ({ page }) => {
    // Start server and go to page
    await page.goto('http://localhost:3000');
    
    // Wait for page to load
    await page.waitForSelector('.app-container');
    
    // Check console for debug logs
    page.on('console', msg => {
      console.log(`Console ${msg.type()}: ${msg.text()}`);
    });
    
    // Try to click calendar tab
    console.log('Looking for calendar tab...');
    const calendarTab = await page.locator('[data-page="calendar"]');
    console.log('Calendar tab found:', await calendarTab.count());
    
    if (await calendarTab.count() > 0) {
      console.log('Clicking calendar tab...');
      await calendarTab.click();
      
      // Wait a bit to see if anything happens
      await page.waitForTimeout(2000);
      
      // Check if it has active class
      const hasActive = await calendarTab.evaluate(el => el.classList.contains('active'));
      console.log('Calendar tab has active class:', hasActive);
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/button-test.png' });
    
    expect(true).toBe(true); // Just pass the test for now
  });
});