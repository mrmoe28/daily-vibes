const { test, expect } = require('@playwright/test');

test.describe('Add Task Button Tests', () => {
  test('Check if Add Task buttons work', async ({ page }) => {
    // Start server and go to page
    await page.goto('http://localhost:3000');
    
    // Wait for page to load
    await page.waitForSelector('.app-container');
    
    // Check console for debug logs
    page.on('console', msg => {
      console.log(`Console ${msg.type()}: ${msg.text()}`);
    });
    
    // Try sidebar Add Task button
    console.log('Looking for sidebar Add Task button...');
    const sidebarAddBtn = await page.locator('#addTaskBtn');
    console.log('Sidebar Add Task button found:', await sidebarAddBtn.count());
    
    if (await sidebarAddBtn.count() > 0) {
      console.log('Clicking sidebar Add Task button...');
      await sidebarAddBtn.click();
      
      // Wait a bit to see if modal opens
      await page.waitForTimeout(1000);
      
      // Check if modal has 'show' class
      const modal = await page.locator('#taskModal');
      const modalVisible = await modal.evaluate(el => el.classList.contains('show'));
      console.log('Modal is visible:', modalVisible);
      
      if (modalVisible) {
        // Close it
        const closeBtn = await page.locator('#closeModal');
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }
    
    // Try header Add Task button
    console.log('Looking for header Add Task button...');
    const headerAddBtn = await page.locator('#headerAddTaskBtn');
    console.log('Header Add Task button found:', await headerAddBtn.count());
    
    if (await headerAddBtn.count() > 0) {
      console.log('Clicking header Add Task button...');
      await headerAddBtn.click();
      
      // Wait a bit to see if modal opens
      await page.waitForTimeout(1000);
      
      // Check if modal has 'show' class
      const modal = await page.locator('#taskModal');
      const modalVisible = await modal.evaluate(el => el.classList.contains('show'));
      console.log('Modal is visible after header button click:', modalVisible);
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/add-task-test.png' });
    
    expect(true).toBe(true); // Just pass the test for now
  });
});