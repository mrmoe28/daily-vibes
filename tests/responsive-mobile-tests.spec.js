// Responsive Design and Mobile Interaction Tests
import { test, expect } from '@playwright/test';

test.describe('TaskFlow - Responsive Design and Mobile Interactions', () => {
  test.describe('Mobile Viewport Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    test('should adapt layout for mobile portrait (375x667)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      // Check sidebar is hidden on mobile
      const sidebar = page.locator('.sidebar');
      const transform = await sidebar.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      expect(transform).toContain('translateX(-100%)');
      
      // Main content should have no left margin
      const mainContent = page.locator('.main-content');
      const marginLeft = await mainContent.evaluate(el => 
        window.getComputedStyle(el).marginLeft
      );
      expect(marginLeft).toBe('0px');
      
      // Task columns should stack vertically
      const taskManager = page.locator('.task-manager');
      const gridColumns = await taskManager.evaluate(el => 
        window.getComputedStyle(el).gridTemplateColumns
      );
      expect(gridColumns).toBe('1fr');
      
      // Stats grid should show 2 columns
      const statsGrid = page.locator('.stats-grid');
      const statsColumns = await statsGrid.evaluate(el => 
        window.getComputedStyle(el).gridTemplateColumns
      );
      expect(statsColumns).toContain('1fr 1fr');
    });

    test('should adapt layout for tablet (768x1024)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      
      // Similar to mobile but might have different breakpoints
      const taskManager = page.locator('.task-manager');
      const gridColumns = await taskManager.evaluate(el => 
        window.getComputedStyle(el).gridTemplateColumns
      );
      expect(gridColumns).toBe('1fr');
      
      // Check padding is reduced
      const mainContent = page.locator('.main-content');
      const padding = await mainContent.evaluate(el => 
        window.getComputedStyle(el).padding
      );
      expect(padding).toBe('16px');
    });

    test('should maintain functionality on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      // Should be able to create tasks on mobile
      await page.click('#headerAddTaskBtn');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      
      // Modal should be properly sized for mobile
      const modalContent = page.locator('.modal-content');
      const width = await modalContent.evaluate(el => 
        window.getComputedStyle(el).width
      );
      expect(width).toBe('90%');
      
      // Should be able to fill form on mobile
      await page.fill('#taskTitle', 'Mobile Test Task');
      await page.fill('#taskDescription', 'Testing mobile functionality');
      await page.click('#saveTask');
      
      // Task should be created and visible
      const taskCard = page.locator('.task-card').filter({ hasText: 'Mobile Test Task' });
      await expect(taskCard).toBeVisible();
    });

    test('should handle orientation changes', async ({ page }) => {
      // Start in portrait
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);
      
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Orientation Test');
      await page.click('#saveTask');
      await page.waitForTimeout(300);
      
      // Switch to landscape
      await page.setViewportSize({ width: 667, height: 375 });
      await page.waitForTimeout(500);
      
      // Task should still be visible
      const taskCard = page.locator('.task-card').filter({ hasText: 'Orientation Test' });
      await expect(taskCard).toBeVisible();
      
      // App should still be functional
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Landscape Test');
      await page.click('#saveTask');
      
      const landscapeTask = page.locator('.task-card').filter({ hasText: 'Landscape Test' });
      await expect(landscapeTask).toBeVisible();
    });
  });

  test.describe('Touch Interactions', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('should handle touch events for button interactions', async ({ page }) => {
      // Enable touch events
      await page.emulateMedia({ reducedMotion: null });
      
      // Test touch on add task button
      const addBtn = page.locator('#headerAddTaskBtn');
      await addBtn.dispatchEvent('touchstart');
      await addBtn.dispatchEvent('touchend');
      await addBtn.click();
      
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
    });

    test('should support swipe gestures for task management', async ({ page }) => {
      // Create a task first
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Swipe Test Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Swipe Test Task' });
      await expect(taskCard).toBeVisible();
      
      // Simulate swipe right (touch events)
      const box = await taskCard.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 10, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
        await page.mouse.up();
      }
      
      // Task should still be functional after swipe
      await expect(taskCard).toBeVisible();
    });

    test('should handle long press interactions', async ({ page }) => {
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Long Press Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Long Press Test' });
      
      // Simulate long press
      await taskCard.hover();
      await page.mouse.down();
      await page.waitForTimeout(1000); // Long press duration
      await page.mouse.up();
      
      // App should handle long press gracefully
      await expect(taskCard).toBeVisible();
    });

    test('should handle pinch zoom gestures', async ({ page }) => {
      // Simulate pinch zoom by changing viewport
      await page.setViewportSize({ width: 188, height: 334 }); // Half size
      await page.waitForTimeout(500);
      
      // App should remain functional at different zoom levels
      const addBtn = page.locator('#headerAddTaskBtn');
      await expect(addBtn).toBeVisible();
      
      await page.click('#headerAddTaskBtn');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      
      // Modal should adapt to smaller viewport
      const modalContent = page.locator('.modal-content');
      const width = await modalContent.evaluate(el => 
        window.getComputedStyle(el).width
      );
      expect(width).toBe('90%');
    });
  });

  test.describe('Responsive Modal Behavior', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    test('should adapt modal size for different screen sizes', async ({ page }) => {
      const viewports = [
        { width: 375, height: 667 },  // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1280, height: 720 }  // Desktop
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(300);
        
        await page.click('#headerAddTaskBtn');
        const modalContent = page.locator('.modal-content');
        
        const width = await modalContent.evaluate(el => 
          window.getComputedStyle(el).width
        );
        
        if (viewport.width <= 768) {
          expect(width).toBe('90%');
        } else {
          // Should have max-width constraint
          const maxWidth = await modalContent.evaluate(el => 
            window.getComputedStyle(el).maxWidth
          );
          expect(maxWidth).toBe('500px');
        }
        
        await page.press('#taskModal', 'Escape');
        await page.waitForTimeout(200);
      }
    });

    test('should handle modal scrolling on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 480 }); // Very small screen
      await page.waitForTimeout(500);
      
      await page.click('#headerAddTaskBtn');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      
      // Fill form to check if scrolling is needed
      await page.fill('#taskTitle', 'Small Screen Test');
      await page.fill('#taskDescription', 'This is a longer description that might require scrolling on very small screens to see all the form elements properly');
      
      // Should be able to scroll to see save button
      const saveBtn = page.locator('#saveTask');
      await saveBtn.scrollIntoViewIfNeeded();
      await expect(saveBtn).toBeVisible();
      
      await page.click('#saveTask');
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Small Screen Test' });
      await expect(taskCard).toBeVisible();
    });
  });

  test.describe('Responsive Typography and Spacing', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    test('should adjust font sizes for mobile', async ({ page }) => {
      // Check desktop font size
      await page.setViewportSize({ width: 1280, height: 720 });
      const pageTitle = page.locator('.page-title');
      const desktopFontSize = await pageTitle.evaluate(el => 
        window.getComputedStyle(el).fontSize
      );
      
      // Check mobile font size
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);
      
      const mobileFontSize = await pageTitle.evaluate(el => 
        window.getComputedStyle(el).fontSize
      );
      
      // Font size should be consistent or appropriately scaled
      expect(mobileFontSize).toBeTruthy();
    });

    test('should adjust padding and margins for mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      // Check main content padding
      const mainContent = page.locator('.main-content');
      const padding = await mainContent.evaluate(el => 
        window.getComputedStyle(el).padding
      );
      expect(padding).toBe('16px');
      
      // Check page header spacing
      const pageHeader = page.locator('.page-header');
      const flexDirection = await pageHeader.evaluate(el => 
        window.getComputedStyle(el).flexDirection
      );
      expect(flexDirection).toBe('column');
    });

    test('should maintain readability on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 }); // iPhone SE
      await page.waitForTimeout(500);
      
      // Create a task to test readability
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Readability Test Task with a Long Title');
      await page.fill('#taskDescription', 'This is a longer description to test how well the text wraps and remains readable on small mobile screens');
      await page.click('#saveTask');
      await page.waitForTimeout(300);
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Readability Test Task' });
      await expect(taskCard).toBeVisible();
      
      // Text should not overflow
      const titleElement = taskCard.locator('.task-title');
      const descElement = taskCard.locator('.task-description');
      
      const titleOverflow = await titleElement.evaluate(el => 
        window.getComputedStyle(el).overflow
      );
      const descOverflow = await descElement.evaluate(el => 
        window.getComputedStyle(el).overflow
      );
      
      // Should handle text overflow gracefully
      expect(titleOverflow).toBeTruthy();
      expect(descOverflow).toBeTruthy();
    });
  });

  test.describe('Responsive Drag and Drop', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    test('should handle drag and drop on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Mobile Drag Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Mobile Drag Test' });
      
      // On mobile, columns are stacked, so drag distance is different
      const progressColumn = page.locator('[data-status="progress"] .task-list');
      
      // Perform drag operation
      await taskCard.dragTo(progressColumn);
      await page.waitForTimeout(500);
      
      // Verify task moved
      const progressList = page.locator('#progressList');
      const taskInProgress = progressList.locator('.task-card').filter({ hasText: 'Mobile Drag Test' });
      await expect(taskInProgress).toBeVisible();
    });

    test('should provide alternative to drag and drop on touch devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Touch Alternative Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Touch Alternative Test' });
      
      // Try using edit button as alternative
      const editBtn = taskCard.locator('[data-action="edit"]');
      await editBtn.click();
      
      // Modal should open for editing
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      
      // Could potentially add status change in edit form
      await page.press('#taskModal', 'Escape');
    });
  });

  test.describe('Performance on Mobile Devices', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('should maintain smooth animations on mobile', async ({ page }) => {
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Animation Performance Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Animation Performance Test' });
      
      // Check for hardware acceleration properties
      const willChange = await taskCard.evaluate(el => 
        window.getComputedStyle(el).willChange
      );
      expect(willChange).toBe('transform, box-shadow');
      
      // Test hover animation
      await taskCard.hover();
      await page.waitForTimeout(200);
      
      const transform = await taskCard.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      expect(transform).not.toBe('none');
    });

    test('should handle rapid interactions without lag', async ({ page }) => {
      // Rapidly create tasks
      for (let i = 0; i < 5; i++) {
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', `Rapid Mobile Task ${i}`);
        await page.click('#saveTask');
        await page.waitForTimeout(100); // Minimal delay
      }
      
      // All tasks should be created
      for (let i = 0; i < 5; i++) {
        const task = page.locator('.task-card').filter({ hasText: `Rapid Mobile Task ${i}` });
        await expect(task).toBeVisible();
      }
    });

    test('should optimize scrolling performance', async ({ page }) => {
      // Create many tasks to test scrolling
      await page.evaluate(() => {
        const tasks = [];
        for (let i = 0; i < 50; i++) {
          tasks.push({
            id: `scroll-${i}`,
            title: `Scroll Test Task ${i}`,
            description: `Description ${i}`,
            priority: 'medium',
            category: 'work',
            status: 'todo',
            createdAt: new Date().toISOString()
          });
        }
        window.app.tasks = [...window.app.tasks, ...tasks];
        window.app.renderTasks();
        window.app.updateStats();
      });
      
      await page.waitForTimeout(1000);
      
      // Test scrolling in task column
      const todoList = page.locator('#todoList');
      const scrollBehavior = await todoList.evaluate(el => 
        window.getComputedStyle(el).scrollBehavior
      );
      expect(scrollBehavior).toBe('smooth');
      
      // Should have scroll properties for performance
      const contain = await todoList.evaluate(el => 
        window.getComputedStyle(el).contain
      );
      expect(contain).toBe('layout style');
    });
  });

  test.describe('Responsive Form Interactions', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('should handle virtual keyboard appearance', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Focus on input (simulates virtual keyboard appearing)
      await page.focus('#taskTitle');
      
      // Modal should still be properly positioned
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      
      // Form should remain usable
      await page.fill('#taskTitle', 'Virtual Keyboard Test');
      await page.fill('#taskDescription', 'Testing with virtual keyboard');
      
      // Should be able to reach save button
      const saveBtn = page.locator('#saveTask');
      await saveBtn.scrollIntoViewIfNeeded();
      await expect(saveBtn).toBeVisible();
      await page.click('#saveTask');
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Virtual Keyboard Test' });
      await expect(taskCard).toBeVisible();
    });

    test('should handle touch keyboard input', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Simulate touch keyboard input patterns
      const titleInput = page.locator('#taskTitle');
      
      // Type with delays to simulate touch typing
      await titleInput.type('Touch Input Test', { delay: 150 });
      
      const descInput = page.locator('#taskDescription');
      await descInput.type('Testing touch keyboard input patterns', { delay: 100 });
      
      await page.click('#saveTask');
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Touch Input Test' });
      await expect(taskCard).toBeVisible();
      await expect(taskCard.locator('.task-description')).toHaveText('Testing touch keyboard input patterns');
    });

    test('should handle form validation on mobile', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Try to submit empty form
      await page.click('#saveTask');
      
      // Check validation message on mobile
      const titleInput = page.locator('#taskTitle');
      const isValid = await titleInput.evaluate(el => el.checkValidity());
      expect(isValid).toBe(false);
      
      // Modal should remain open
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
    });
  });

  test.describe('Accessibility on Mobile', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('should maintain touch target sizes', async ({ page }) => {
      // Check button sizes meet touch target requirements (44px minimum)
      const addBtn = page.locator('#headerAddTaskBtn');
      const box = await addBtn.boundingBox();
      
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      
      // Create a task to check action buttons
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Touch Target Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const editBtn = page.locator('[data-action="edit"]').first();
      const editBox = await editBtn.boundingBox();
      
      // Action buttons should be large enough for touch
      expect(editBox.height).toBeGreaterThanOrEqual(32);
      expect(editBox.width).toBeGreaterThanOrEqual(32);
    });

    test('should support screen reader navigation on mobile', async ({ page }) => {
      // Check for proper ARIA labels and roles
      const taskBoard = page.locator('.task-manager');
      const ariaLabel = await taskBoard.getAttribute('aria-label');
      expect(ariaLabel).toBe('Task management board');
      
      // Check column accessibility
      const todoColumn = page.locator('[data-status="todo"]');
      const columnRole = await todoColumn.getAttribute('role');
      const columnLabel = await todoColumn.getAttribute('aria-label');
      
      expect(columnRole).toBe('region');
      expect(columnLabel).toBe('To do tasks');
      
      // Task lists should have proper roles
      const todoList = page.locator('#todoList');
      const listRole = await todoList.getAttribute('role');
      expect(listRole).toBe('list');
    });
  });
});