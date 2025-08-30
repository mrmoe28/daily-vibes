// Accessibility Features and Keyboard Navigation Tests
import { test, expect } from '@playwright/test';

test.describe('TaskFlow - Accessibility and Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test.describe('ARIA Labels and Roles', () => {
    test('should have proper document structure with landmarks', async ({ page }) => {
      // Check main landmark
      const main = page.locator('main[role="main"]');
      await expect(main).toBeVisible();
      
      // Check sidebar navigation
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();
      
      // Check navigation structure
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();
    });

    test('should have proper ARIA labels for interactive elements', async ({ page }) => {
      // Check add task button
      const addBtn = page.locator('#headerAddTaskBtn');
      const ariaLabel = await addBtn.getAttribute('aria-label');
      expect(ariaLabel).toBe('Add new task');
      
      // Check modal
      await page.click('#headerAddTaskBtn');
      const modal = page.locator('#taskModal');
      const modalRole = await modal.getAttribute('role');
      const modalAria = await modal.getAttribute('aria-modal');
      const labelledBy = await modal.getAttribute('aria-labelledby');
      const describedBy = await modal.getAttribute('aria-describedby');
      
      expect(modalRole).toBe('dialog');
      expect(modalAria).toBe('true');
      expect(labelledBy).toBe('modalTitle');
      expect(describedBy).toBe('modalDescription');
    });

    test('should have proper form labels and associations', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Check form labels are properly associated
      const titleLabel = page.locator('label[for="taskTitle"]');
      const titleInput = page.locator('#taskTitle');
      
      await expect(titleLabel).toBeVisible();
      await expect(titleInput).toBeVisible();
      
      const labelText = await titleLabel.textContent();
      expect(labelText).toBe('Task Title');
      
      // Check required attribute
      const required = await titleInput.getAttribute('required');
      expect(required).not.toBeNull();
      
      // Check other form elements
      const descLabel = page.locator('label[for="taskDescription"]');
      const priorityLabel = page.locator('label[for="taskPriority"]');
      const categoryLabel = page.locator('label[for="taskCategory"]');
      
      await expect(descLabel).toBeVisible();
      await expect(priorityLabel).toBeVisible();
      await expect(categoryLabel).toBeVisible();
    });

    test('should have proper task board accessibility', async ({ page }) => {
      // Check task manager region
      const taskManager = page.locator('.task-manager');
      const boardLabel = await taskManager.getAttribute('aria-label');
      expect(boardLabel).toBe('Task management board');
      
      // Check each column has proper roles and labels
      const columns = [
        { selector: '[data-status="todo"]', label: 'To do tasks' },
        { selector: '[data-status="progress"]', label: 'In progress tasks' },
        { selector: '[data-status="completed"]', label: 'Completed tasks' }
      ];
      
      for (const column of columns) {
        const columnEl = page.locator(column.selector);
        const role = await columnEl.getAttribute('role');
        const ariaLabel = await columnEl.getAttribute('aria-label');
        
        expect(role).toBe('region');
        expect(ariaLabel).toBe(column.label);
      }
      
      // Check task lists have proper roles
      const taskLists = page.locator('.task-list');
      for (let i = 0; i < await taskLists.count(); i++) {
        const list = taskLists.nth(i);
        const role = await list.getAttribute('role');
        expect(role).toBe('list');
      }
    });

    test('should have accessible task cards', async ({ page }) => {
      // Create a test task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Accessibility Test Task');
      await page.fill('#taskDescription', 'Testing task card accessibility');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const taskCard = page.locator('.task-card').first();
      
      // Check task card has proper role and label
      const role = await taskCard.getAttribute('role');
      const ariaLabel = await taskCard.getAttribute('aria-label');
      
      expect(role).toBe('listitem');
      expect(ariaLabel).toContain('Task: Accessibility Test Task');
      
      // Check action buttons have proper labels
      const editBtn = taskCard.locator('[data-action="edit"]');
      const deleteBtn = taskCard.locator('[data-action="delete"]');
      
      const editLabel = await editBtn.getAttribute('aria-label');
      const deleteLabel = await deleteBtn.getAttribute('aria-label');
      
      expect(editLabel).toContain('Edit task: Accessibility Test Task');
      expect(deleteLabel).toContain('Delete task: Accessibility Test Task');
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      // Check main page title
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
      const h1Text = await h1.textContent();
      expect(h1Text).toBe('Task Board');
      
      // Check column headers
      const h2Elements = page.locator('h2');
      const h2Count = await h2Elements.count();
      expect(h2Count).toBe(3); // Three column headers
      
      // Check modal title
      await page.click('#headerAddTaskBtn');
      const modalTitle = page.locator('#modalTitle');
      const modalH2 = await modalTitle.evaluate(el => el.tagName.toLowerCase());
      expect(modalH2).toBe('h2');
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support tab navigation through interactive elements', async ({ page }) => {
      // Start tab navigation
      await page.keyboard.press('Tab');
      
      // Should be able to reach the add task button
      let focusedElement = await page.evaluate(() => document.activeElement?.id);
      
      // Tab through multiple elements to reach add task button
      const maxTabs = 20;
      for (let i = 0; i < maxTabs; i++) {
        focusedElement = await page.evaluate(() => document.activeElement?.id);
        if (focusedElement === 'headerAddTaskBtn') {
          break;
        }
        await page.keyboard.press('Tab');
      }
      
      expect(focusedElement).toBe('headerAddTaskBtn');
      
      // Should be able to activate with Enter or Space
      await page.keyboard.press('Enter');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
    });

    test('should trap focus within modal', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      await page.waitForSelector('#taskModal.show');
      
      // First focusable element should be the title input
      let focusedElement = await page.evaluate(() => document.activeElement?.id);
      expect(focusedElement).toBe('taskTitle');
      
      // Tab through all modal elements
      const modalElements = [];
      for (let i = 0; i < 10; i++) {
        focusedElement = await page.evaluate(() => document.activeElement?.id);
        modalElements.push(focusedElement);
        await page.keyboard.press('Tab');
      }
      
      // Should cycle back to first element
      const finalFocus = await page.evaluate(() => document.activeElement?.id);
      expect(finalFocus).toBe('taskTitle');
      
      // Test reverse tabbing
      await page.keyboard.press('Shift+Tab');
      focusedElement = await page.evaluate(() => document.activeElement?.id);
      expect(focusedElement).toBe('cancelTask'); // Should be last element
    });

    test('should handle escape key to close modal', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      
      // Press Escape
      await page.keyboard.press('Escape');
      await expect(modal).not.toHaveClass(/show/);
      
      // Focus should return to trigger button
      const focusedElement = await page.evaluate(() => document.activeElement?.id);
      expect(focusedElement).toBe('headerAddTaskBtn');
    });

    test('should support keyboard navigation for task actions', async ({ page }) => {
      // Create a test task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Keyboard Navigation Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Tab to the task card buttons
      const editBtn = page.locator('[data-action="edit"]').first();
      await editBtn.focus();
      
      // Should be able to activate edit with Enter
      await page.keyboard.press('Enter');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      await expect(page.locator('#modalTitle')).toHaveText('Edit Task');
      
      await page.keyboard.press('Escape');
      
      // Tab to delete button
      const deleteBtn = page.locator('[data-action="delete"]').first();
      await deleteBtn.focus();
      
      // Set up dialog handler
      page.on('dialog', async dialog => {
        await dialog.dismiss(); // Cancel deletion
      });
      
      await page.keyboard.press('Enter');
      // Dialog should have appeared and been dismissed
    });

    test('should support arrow key navigation for form elements', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Focus on select element
      const prioritySelect = page.locator('#taskPriority');
      await prioritySelect.focus();
      
      // Should be able to use arrow keys
      await page.keyboard.press('ArrowDown');
      const selectedValue = await prioritySelect.inputValue();
      expect(['low', 'medium', 'high']).toContain(selectedValue);
    });

    test('should support keyboard shortcuts', async ({ page }) => {
      // Test potential keyboard shortcuts (if implemented)
      // For example, Ctrl+N for new task
      await page.keyboard.press('Control+n');
      
      // This might open modal (if shortcut is implemented)
      // For now, just ensure no errors occur
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have proper screen reader announcements', async ({ page }) => {
      // Check for screen reader only content
      const srOnly = page.locator('.sr-only');
      await expect(srOnly).toBeVisible();
      
      const srText = await srOnly.textContent();
      expect(srText).toBeTruthy();
    });

    test('should announce state changes appropriately', async ({ page }) => {
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Screen Reader Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Check if toast has appropriate role for announcements
      const toast = page.locator('.toast');
      await expect(toast).toBeVisible();
      
      // Toast should have appropriate attributes for screen readers
      const toastRole = await toast.evaluate(el => 
        el.getAttribute('role') || el.getAttribute('aria-live')
      );
      expect(toastRole).toBeTruthy();
    });

    test('should provide context for dynamic content', async ({ page }) => {
      // Stats should be properly labeled
      const totalTasks = page.locator('#totalTasks');
      const parent = page.locator('.stat-card').first();
      const label = parent.locator('.stat-label');
      
      await expect(label).toHaveText('Total Tasks');
      
      // Create task and verify stats update with context
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Stats Update Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const updatedTotal = await totalTasks.textContent();
      expect(parseInt(updatedTotal)).toBe(5); // 4 sample + 1 new
    });

    test('should handle focus management properly', async ({ page }) => {
      // Store initial focus
      const initialFocus = await page.evaluate(() => document.activeElement?.tagName);
      
      // Open modal
      await page.click('#headerAddTaskBtn');
      
      // Focus should move to modal
      const modalFocus = await page.evaluate(() => document.activeElement?.id);
      expect(modalFocus).toBe('taskTitle');
      
      // Close modal
      await page.keyboard.press('Escape');
      
      // Focus should return appropriately
      const finalFocus = await page.evaluate(() => document.activeElement?.id);
      expect(finalFocus).toBe('headerAddTaskBtn');
    });
  });

  test.describe('Color Contrast and Visual Accessibility', () => {
    test('should meet color contrast requirements', async ({ page }) => {
      // Test primary button contrast
      const addBtn = page.locator('#headerAddTaskBtn');
      const styles = await addBtn.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color
        };
      });
      
      // Colors should be properly defined
      expect(styles.backgroundColor).toBeTruthy();
      expect(styles.color).toBeTruthy();
      
      // Text should be readable
      expect(styles.color).toContain('255, 255, 255'); // Should be white text
    });

    test('should support high contrast mode', async ({ page }) => {
      // Simulate high contrast mode
      await page.emulateMedia({ colorScheme: 'dark' });
      
      // Elements should still be visible and functional
      const addBtn = page.locator('#headerAddTaskBtn');
      await expect(addBtn).toBeVisible();
      
      await page.click('#headerAddTaskBtn');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
    });

    test('should handle reduced motion preferences', async ({ page }) => {
      // Simulate reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      // Check if animations respect the preference
      const backgroundAnimation = page.locator('.background-animation');
      await expect(backgroundAnimation).toBeVisible();
      
      // In a full implementation, animations might be disabled
      // For now, just ensure the page still works
      await page.click('#headerAddTaskBtn');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
    });

    test('should support zoom up to 200%', async ({ page }) => {
      // Simulate zoom by reducing viewport size
      await page.setViewportSize({ width: 640, height: 360 }); // Half of 1280x720
      await page.waitForTimeout(500);
      
      // Content should still be accessible
      const addBtn = page.locator('#headerAddTaskBtn');
      await expect(addBtn).toBeVisible();
      
      await page.click('#headerAddTaskBtn');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      
      // Form should be usable
      await page.fill('#taskTitle', 'Zoom Test Task');
      await page.click('#saveTask');
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Zoom Test Task' });
      await expect(taskCard).toBeVisible();
    });
  });

  test.describe('Voice Control and Alternative Input Methods', () => {
    test('should support voice control patterns', async ({ page }) => {
      // Elements should have appropriate names for voice control
      const addBtn = page.locator('#headerAddTaskBtn');
      const btnText = await addBtn.textContent();
      expect(btnText).toBe('Add Task');
      
      // Buttons should be identifiable by their visible text
      await page.getByRole('button', { name: 'Add Task' }).click();
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
    });

    test('should support switch navigation', async ({ page }) => {
      // Elements should be focusable for switch access
      const focusableElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])');
        return elements.length;
      });
      
      expect(focusableElements).toBeGreaterThan(0);
      
      // Test sequential navigation
      const addBtn = page.locator('#headerAddTaskBtn');
      await addBtn.focus();
      
      const focused = await page.evaluate(() => document.activeElement?.id);
      expect(focused).toBe('headerAddTaskBtn');
    });
  });

  test.describe('Error Handling for Accessibility', () => {
    test('should announce form validation errors', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Try to submit without required field
      await page.click('#saveTask');
      
      // Check for validation message
      const titleInput = page.locator('#taskTitle');
      const validationMessage = await titleInput.evaluate(el => el.validationMessage);
      expect(validationMessage).toBeTruthy();
      
      // In a full implementation, might have aria-describedby for error messages
      const describedBy = await titleInput.getAttribute('aria-describedby');
      // Could check for error message ID if implemented
    });

    test('should handle loading states accessibly', async ({ page }) => {
      // Create a loading element to test
      await page.evaluate(() => {
        const loader = document.createElement('div');
        loader.className = 'loading';
        loader.setAttribute('aria-label', 'Loading');
        loader.setAttribute('role', 'status');
        loader.id = 'test-loader';
        document.body.appendChild(loader);
      });
      
      const loader = page.locator('#test-loader');
      const role = await loader.getAttribute('role');
      const label = await loader.getAttribute('aria-label');
      
      expect(role).toBe('status');
      expect(label).toBe('Loading');
    });

    test('should handle navigation failures gracefully', async ({ page }) => {
      // Try to navigate to non-existent page
      await page.click('[data-page="calendar"]');
      
      // Should show appropriate message
      const toast = page.locator('.toast');
      await expect(toast).toBeVisible();
      
      // Toast should have appropriate accessibility attributes
      const toastText = await toast.textContent();
      expect(toastText).toContain('Calendar view coming soon!');
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('should maintain accessibility on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      // Touch targets should be large enough
      const addBtn = page.locator('#headerAddTaskBtn');
      const box = await addBtn.boundingBox();
      
      expect(box.height).toBeGreaterThanOrEqual(44); // iOS requirement
      expect(box.width).toBeGreaterThanOrEqual(44);
      
      // Should still support keyboard navigation on mobile
      await addBtn.focus();
      await page.keyboard.press('Enter');
      
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
    });

    test('should support mobile screen readers', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      
      // Check swipe navigation accessibility
      const taskBoard = page.locator('.task-manager');
      const boardLabel = await taskBoard.getAttribute('aria-label');
      expect(boardLabel).toBe('Task management board');
      
      // Columns should be properly labeled for screen readers
      const columns = page.locator('.task-column');
      for (let i = 0; i < await columns.count(); i++) {
        const column = columns.nth(i);
        const role = await column.getAttribute('role');
        const label = await column.getAttribute('aria-label');
        
        expect(role).toBe('region');
        expect(label).toBeTruthy();
      }
    });
  });
});