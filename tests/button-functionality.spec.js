const { test, expect } = require('@playwright/test');

test.describe('Button Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForSelector('.app-container', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('Sidebar navigation tabs should work', async ({ page }) => {
    console.log('Testing sidebar navigation...');
    
    // Test Task Board tab (should be active by default)
    const taskBoardTab = page.locator('[data-page="tasks"]');
    await expect(taskBoardTab).toHaveClass(/active/);
    
    // Test Calendar tab click
    console.log('Clicking Calendar tab...');
    const calendarTab = page.locator('[data-page="calendar"]');
    await calendarTab.click({ timeout: 5000 });
    
    // Wait for navigation and check if calendar tab becomes active
    await page.waitForTimeout(1000);
    await expect(calendarTab).toHaveClass(/active/);
    
    // Check if page title changed
    const pageTitle = page.locator('.page-title');
    await expect(pageTitle).toContainText('Calendar View');
    
    // Test Analytics tab click
    console.log('Clicking Analytics tab...');
    const analyticsTab = page.locator('[data-page="analytics"]');
    await analyticsTab.click({ timeout: 5000 });
    
    // Wait for navigation and check if analytics tab becomes active
    await page.waitForTimeout(1000);
    await expect(analyticsTab).toHaveClass(/active/);
    
    // Check if page title changed
    await expect(pageTitle).toContainText('Analytics Dashboard');
    
    // Test going back to Task Board
    console.log('Clicking Task Board tab...');
    await taskBoardTab.click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await expect(taskBoardTab).toHaveClass(/active/);
    await expect(pageTitle).toContainText('Task Board');
  });

  test('Add Task buttons should work', async ({ page }) => {
    console.log('Testing Add Task buttons...');
    
    // Test sidebar Add Task button
    const sidebarAddBtn = page.locator('#addTaskBtn');
    await expect(sidebarAddBtn).toBeVisible();
    
    console.log('Clicking sidebar Add Task button...');
    await sidebarAddBtn.click({ timeout: 5000 });
    
    // Check if modal opens
    const modal = page.locator('#taskModal');
    await page.waitForTimeout(1000);
    await expect(modal).toHaveClass(/show/);
    
    // Close modal
    const closeBtn = page.locator('#closeModal');
    await closeBtn.click();
    await page.waitForTimeout(500);
    await expect(modal).not.toHaveClass(/show/);
    
    // Test header Add Task button
    console.log('Clicking header Add Task button...');
    const headerAddBtn = page.locator('#headerAddTaskBtn');
    await expect(headerAddBtn).toBeVisible();
    await headerAddBtn.click({ timeout: 5000 });
    
    // Check if modal opens
    await page.waitForTimeout(1000);
    await expect(modal).toHaveClass(/show/);
    
    // Close modal with cancel button
    const cancelBtn = page.locator('#cancelTask');
    await cancelBtn.click();
    await page.waitForTimeout(500);
    await expect(modal).not.toHaveClass(/show/);
  });

  test('Task card buttons should work', async ({ page }) => {
    console.log('Testing task card buttons...');
    
    // Wait for tasks to load
    await page.waitForSelector('.task-card', { timeout: 10000 });
    
    // Get the first task card
    const firstTaskCard = page.locator('.task-card').first();
    await expect(firstTaskCard).toBeVisible();
    
    // Test edit button
    console.log('Testing edit button...');
    const editBtn = firstTaskCard.locator('button[data-action="edit"]');
    await expect(editBtn).toBeVisible();
    await editBtn.click({ timeout: 5000 });
    
    // Check if modal opens in edit mode
    const modal = page.locator('#taskModal');
    await page.waitForTimeout(1000);
    await expect(modal).toHaveClass(/show/);
    
    // Check if modal title shows "Edit Task"
    const modalTitle = page.locator('#modalTitle');
    await expect(modalTitle).toContainText('Edit Task');
    
    // Close modal
    const closeBtn = page.locator('#closeModal');
    await closeBtn.click();
    await page.waitForTimeout(500);
    await expect(modal).not.toHaveClass(/show/);
  });

  test('Category filter buttons should work', async ({ page }) => {
    console.log('Testing category filter buttons...');
    
    // Test work category filter
    const workCategory = page.locator('[data-category="work"]');
    await expect(workCategory).toBeVisible();
    
    console.log('Clicking work category...');
    await workCategory.click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await expect(workCategory).toHaveClass(/active/);
    
    // Test personal category filter
    const personalCategory = page.locator('[data-category="personal"]');
    await expect(personalCategory).toBeVisible();
    
    console.log('Clicking personal category...');
    await personalCategory.click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await expect(personalCategory).toHaveClass(/active/);
  });

  test('Check for JavaScript errors', async ({ page }) => {
    const jsErrors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text());
        console.log('JS Error:', msg.text());
      }
      if (msg.type() === 'log') {
        console.log('JS Log:', msg.text());
      }
    });
    
    // Perform various interactions to trigger any errors
    await page.locator('[data-page="calendar"]').click();
    await page.waitForTimeout(1000);
    
    await page.locator('[data-page="analytics"]').click();  
    await page.waitForTimeout(1000);
    
    await page.locator('#addTaskBtn').click();
    await page.waitForTimeout(1000);
    
    await page.locator('#closeModal').click();
    await page.waitForTimeout(1000);
    
    // Check if there are any critical JavaScript errors
    const criticalErrors = jsErrors.filter(error => 
      !error.includes('Deprecated') && 
      !error.includes('Warning') &&
      !error.includes('DevTools')
    );
    
    if (criticalErrors.length > 0) {
      console.log('Critical JavaScript errors found:', criticalErrors);
    }
    
    expect(criticalErrors.length).toBe(0);
  });
});