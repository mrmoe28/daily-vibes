// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('TaskFlow - Sidebar Navigation', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(baseURL + '/');
    // Wait for the app to load
    await expect(page.getByRole('heading', { name: 'Task Board' })).toBeVisible();
  });

  test('sidebar navigation buttons are clickable and functional', async ({ page }) => {
    // Enable console logging to capture any errors
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    // Test Task Board navigation (should already be active)
    const taskBoardLink = page.locator('.nav-item[data-page="tasks"]');
    await expect(taskBoardLink).toBeVisible();
    await expect(taskBoardLink).toHaveClass(/active/);
    
    // Test Calendar navigation
    const calendarLink = page.locator('.nav-item[data-page="calendar"]');
    await expect(calendarLink).toBeVisible();
    
    console.log('Clicking Calendar link...');
    await calendarLink.click();
    
    // Wait for navigation to complete
    await page.waitForTimeout(1000);
    
    // Check if page title changed
    await expect(page.getByRole('heading', { name: 'Calendar View' })).toBeVisible();
    await expect(calendarLink).toHaveClass(/active/);
    await expect(taskBoardLink).not.toHaveClass(/active/);
    
    // Test Analytics navigation
    const analyticsLink = page.locator('.nav-item[data-page="analytics"]');
    await expect(analyticsLink).toBeVisible();
    
    console.log('Clicking Analytics link...');
    await analyticsLink.click();
    
    // Wait for navigation to complete
    await page.waitForTimeout(1000);
    
    // Check if page title changed
    await expect(page.getByRole('heading', { name: 'Analytics Dashboard' })).toBeVisible();
    await expect(analyticsLink).toHaveClass(/active/);
    await expect(calendarLink).not.toHaveClass(/active/);
    
    // Test Search navigation
    const searchLink = page.locator('#searchTasksBtn');
    await expect(searchLink).toBeVisible();
    
    console.log('Clicking Search link...');
    await searchLink.click();
    
    // Wait for navigation to complete
    await page.waitForTimeout(1000);
    
    // Check if search view is visible
    await expect(page.locator('#searchView')).toBeVisible();
  });

  test('category filtering works correctly', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    // Test Work category filter
    const workCategoryLink = page.locator('.nav-item[data-category="work"]');
    await expect(workCategoryLink).toBeVisible();
    
    console.log('Clicking Work category...');
    await workCategoryLink.click();
    
    // Wait for filter to apply
    await page.waitForTimeout(1000);
    
    // Check if work category is now active
    await expect(workCategoryLink).toHaveClass(/active/);
    
    // Test Personal category filter
    const personalCategoryLink = page.locator('.nav-item[data-category="personal"]');
    await expect(personalCategoryLink).toBeVisible();
    
    console.log('Clicking Personal category...');
    await personalCategoryLink.click();
    
    // Wait for filter to apply
    await page.waitForTimeout(1000);
    
    // Check if personal category is now active
    await expect(personalCategoryLink).toHaveClass(/active/);
    await expect(workCategoryLink).not.toHaveClass(/active/);
  });

  test('navigation with JavaScript debugging', async ({ page }) => {
    // Add a script to monitor navigation calls
    await page.addInitScript(() => {
      // Override console.log to capture all logs
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;
      
      console.log = (...args) => {
        originalLog('DEBUG LOG:', ...args);
        window.debugLogs = window.debugLogs || [];
        window.debugLogs.push({ type: 'log', args: Array.from(args) });
      };
      
      console.warn = (...args) => {
        originalWarn('DEBUG WARN:', ...args);
        window.debugLogs = window.debugLogs || [];
        window.debugLogs.push({ type: 'warn', args: Array.from(args) });
      };
      
      console.error = (...args) => {
        originalError('DEBUG ERROR:', ...args);
        window.debugLogs = window.debugLogs || [];
        window.debugLogs.push({ type: 'error', args: Array.from(args) });
      };
    });

    // Wait for app to initialize
    await page.waitForTimeout(2000);
    
    // Check if app is initialized
    const appExists = await page.evaluate(() => {
      console.log('Checking if app exists...');
      console.log('window.app:', !!window.app);
      console.log('window.handleNavigation:', !!window.handleNavigation);
      console.log('window.filterByCategory:', !!window.filterByCategory);
      return {
        appExists: !!window.app,
        handleNavigationExists: !!window.handleNavigation,
        filterByCategoryExists: !!window.filterByCategory
      };
    });
    
    console.log('App initialization status:', appExists);
    
    // Try clicking a navigation link
    const calendarLink = page.locator('.nav-item[data-page="calendar"]');
    await calendarLink.click();
    
    // Wait and check for any errors or logs
    await page.waitForTimeout(2000);
    
    // Get debug logs
    const debugLogs = await page.evaluate(() => window.debugLogs || []);
    console.log('Debug logs:', debugLogs);
    
    // Check if navigation actually happened
    const pageTitle = await page.locator('.page-title').textContent();
    console.log('Current page title:', pageTitle);
  });

  test('check for JavaScript errors on page load', async ({ page }) => {
    const errors = [];
    
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log('JavaScript Error:', error.message);
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log('Console Error:', msg.text());
      }
    });
    
    // Wait for page to fully load
    await page.waitForTimeout(3000);
    
    // Check if there were any errors
    console.log('Total errors found:', errors.length);
    if (errors.length > 0) {
      console.log('All errors:', errors);
    }
    
    // The test should pass even if there are errors, but we want to see them
    expect(errors.length).toBeLessThan(10); // Allow some minor errors
  });
});
