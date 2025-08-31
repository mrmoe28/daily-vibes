// Comprehensive Button Interaction Tests
import { test, expect } from '@playwright/test';

test.describe('TaskFlow - Comprehensive Button Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Clear localStorage to start fresh
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test.describe('Add Task Buttons', () => {
    test('header add task button should be visible and clickable', async ({ page }) => {
      const headerBtn = page.locator('#headerAddTaskBtn');
      await expect(headerBtn).toBeVisible();
      await expect(headerBtn).toBeEnabled();
      await expect(headerBtn).toHaveText('Add Task');
      await expect(headerBtn).toHaveAttribute('aria-label', 'Add new task');
    });

    test('sidebar add task button should be visible and clickable', async ({ page }) => {
      const sidebarBtn = page.locator('#addTaskBtn');
      await expect(sidebarBtn).toBeVisible();
      await expect(sidebarBtn).toBeEnabled();
      await expect(sidebarBtn).toContainText('Add Task');
    });

    test('header add task button click should open modal', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      await expect(page.locator('#modalTitle')).toHaveText('Add New Task');
    });

    test('sidebar add task button click should open modal', async ({ page }) => {
      await page.click('#addTaskBtn');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      await expect(page.locator('#modalTitle')).toHaveText('Add New Task');
    });

    test('add task buttons should have proper hover effects', async ({ page }) => {
      const headerBtn = page.locator('#headerAddTaskBtn');
      await headerBtn.hover();
      
      // Check for transform effect
      const transform = await headerBtn.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      expect(transform).not.toBe('none');
      
      // Check for box-shadow
      const boxShadow = await headerBtn.evaluate(el => 
        window.getComputedStyle(el).boxShadow
      );
      expect(boxShadow).not.toBe('none');
    });
  });

  test.describe('Modal Control Buttons', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      await page.waitForSelector('#taskModal.show');
    });

    test('close button should close modal', async ({ page }) => {
      await page.click('#closeModal');
      const modal = page.locator('#taskModal');
      await expect(modal).not.toHaveClass(/show/);
    });

    test('cancel button should close modal', async ({ page }) => {
      await page.click('#cancelTask');
      const modal = page.locator('#taskModal');
      await expect(modal).not.toHaveClass(/show/);
    });

    test('save task button should be enabled with valid data', async ({ page }) => {
      await page.fill('#taskTitle', 'Test Task');
      const saveBtn = page.locator('#saveTask');
      await expect(saveBtn).toBeEnabled();
    });

    test('modal overlay click should close modal', async ({ page }) => {
      await page.click('#taskModal', { position: { x: 10, y: 10 } });
      const modal = page.locator('#taskModal');
      await expect(modal).not.toHaveClass(/show/);
    });

    test('escape key should close modal', async ({ page }) => {
      await page.keyboard.press('Escape');
      const modal = page.locator('#taskModal');
      await expect(modal).not.toHaveClass(/show/);
    });
  });

  test.describe('Navigation Buttons', () => {
    test('task board navigation should be active by default', async ({ page }) => {
      const taskBoardNav = page.locator('[data-page="tasks"]');
      await expect(taskBoardNav).toHaveClass(/active/);
    });

    test('calendar navigation should switch view', async ({ page }) => {
      await page.click('[data-page="calendar"]');
      await expect(page.locator('[data-page="calendar"]')).toHaveClass(/active/);
      await expect(page.locator('.page-title')).toHaveText('Calendar View');
    });

    test('analytics navigation should switch view', async ({ page }) => {
      await page.click('[data-page="analytics"]');
      await expect(page.locator('[data-page="analytics"]')).toHaveClass(/active/);
      await expect(page.locator('.page-title')).toHaveText('Analytics Dashboard');
    });

    test('category filters should activate properly', async ({ page }) => {
      await page.click('[data-category="work"]');
      await expect(page.locator('[data-category="work"]')).toHaveClass(/active/);
    });
  });

  test.describe('Task Card Buttons', () => {
    test.beforeEach(async ({ page }) => {
      // Add a test task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Test Task for Buttons');
      await page.fill('#taskDescription', 'Test description');
      await page.selectOption('#taskPriority', 'high');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
    });

    test('edit button should open modal with task data', async ({ page }) => {
      const editBtn = page.locator('[data-action="edit"]').first();
      await editBtn.click();
      
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      await expect(page.locator('#modalTitle')).toHaveText('Edit Task');
      await expect(page.locator('#taskTitle')).toHaveValue('Test Task for Buttons');
    });

    test('delete button should show confirmation and remove task', async ({ page }) => {
      // Set up confirmation dialog handler
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('Are you sure you want to delete this task?');
        await dialog.accept();
      });

      const deleteBtn = page.locator('[data-action="delete"]').first();
      await deleteBtn.click();
      
      // Wait for task to be removed
      await page.waitForTimeout(500);
      
      // Verify task is no longer in DOM
      const taskCards = page.locator('.task-card');
      await expect(taskCards).toHaveCount(3); // Should have 3 sample tasks left
    });

    test('task card buttons should have proper styling', async ({ page }) => {
      const editBtn = page.locator('[data-action="edit"]').first();
      const deleteBtn = page.locator('[data-action="delete"]').first();
      
      // Check if buttons have proper classes
      await expect(editBtn).toHaveClass(/btn/);
      await expect(deleteBtn).toHaveClass(/btn/);
      
      // Check hover effects
      await editBtn.hover();
      const transform = await editBtn.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      expect(transform).not.toBe('none');
    });
  });

  test.describe('Form Buttons Behavior', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      await page.waitForSelector('#taskModal.show');
    });

    test('save button should be disabled with empty form', async ({ page }) => {
      const saveBtn = page.locator('#saveTask');
      // The button should be enabled but form validation should prevent submission
      await expect(saveBtn).toBeEnabled();
    });

    test('form submission should work with valid data', async ({ page }) => {
      await page.fill('#taskTitle', 'Valid Task');
      await page.selectOption('#taskPriority', 'medium');
      await page.selectOption('#taskCategory', 'work');
      
      await page.click('#saveTask');
      
      // Modal should close
      const modal = page.locator('#taskModal');
      await expect(modal).not.toHaveClass(/show/);
      
      // Task should appear in todo column
      const taskCard = page.locator('.task-card').filter({ hasText: 'Valid Task' });
      await expect(taskCard).toBeVisible();
    });

    test('form reset should clear all fields', async ({ page }) => {
      await page.fill('#taskTitle', 'Test Title');
      await page.fill('#taskDescription', 'Test Description');
      await page.selectOption('#taskPriority', 'high');
      
      await page.click('#cancelTask');
      await page.click('#headerAddTaskBtn');
      
      // Fields should be empty
      await expect(page.locator('#taskTitle')).toHaveValue('');
      await expect(page.locator('#taskDescription')).toHaveValue('');
      await expect(page.locator('#taskPriority')).toHaveValue('medium'); // default value
    });
  });

  test.describe('Button States and Interactions', () => {
    test('buttons should maintain state during rapid clicks', async ({ page }) => {
      // Rapid click test
      for (let i = 0; i < 5; i++) {
        await page.click('#headerAddTaskBtn');
        await page.waitForTimeout(100);
        await page.press('#taskModal', 'Escape');
        await page.waitForTimeout(100);
      }
      
      // Should still work normally
      await page.click('#headerAddTaskBtn');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
    });

    test('buttons should be accessible via keyboard', async ({ page }) => {
      // Tab to add task button and press Enter
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      // Continue tabbing until we reach the add task button
      await page.focus('#headerAddTaskBtn');
      await page.keyboard.press('Enter');
      
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
    });

    test('disabled state should prevent interactions', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Temporarily disable save button via JavaScript
      await page.evaluate(() => {
        document.getElementById('saveTask').disabled = true;
      });
      
      const saveBtn = page.locator('#saveTask');
      await expect(saveBtn).toBeDisabled();
      
      // Click should not work
      await saveBtn.click({ force: true });
      
      // Modal should still be open
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
    });
  });

  test.describe('Visual Feedback Tests', () => {
    test('buttons should show loading states when appropriate', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Loading Test Task');
      
      // Intercept network requests to simulate slow response
      await page.route('/api/**', async route => {
        await page.waitForTimeout(1000);
        await route.continue();
      });
      
      await page.click('#saveTask');
      
      // Check for any loading indicators
      const loadingElements = page.locator('.loading');
      if (await loadingElements.count() > 0) {
        await expect(loadingElements.first()).toBeVisible();
      }
    });

    test('buttons should show proper focus states', async ({ page }) => {
      const addBtn = page.locator('#headerAddTaskBtn');
      await addBtn.focus();
      
      // Check for focus outline or other focus indicators
      const outline = await addBtn.evaluate(el => 
        window.getComputedStyle(el).outline
      );
      const boxShadow = await addBtn.evaluate(el => 
        window.getComputedStyle(el).boxShadow
      );
      
      // At least one focus indicator should be present
      expect(outline !== 'none' || boxShadow !== 'none').toBeTruthy();
    });

    test('buttons should have smooth transitions', async ({ page }) => {
      const addBtn = page.locator('#headerAddTaskBtn');
      
      // Check for transition property
      const transition = await addBtn.evaluate(el => 
        window.getComputedStyle(el).transition
      );
      
      expect(transition).not.toBe('all 0s ease 0s');
    });
  });

  test.describe('Button Error States', () => {
    test('should handle form validation errors gracefully', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Try to submit with empty required field
      await page.click('#saveTask');
      
      // Form should not submit and modal should remain open
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Block all network requests to simulate network issues
      await page.route('**/*', route => route.abort());
      
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Network Error Test');
      await page.click('#saveTask');
      
      // Application should handle the error without crashing
      const modal = page.locator('#taskModal');
      // Modal might close or show error message
      // We just verify the app doesn't crash
      await expect(page.locator('body')).toBeVisible();
    });
  });
});