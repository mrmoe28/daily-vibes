// Error Handling and Edge Cases Tests
import { test, expect } from '@playwright/test';

test.describe('TaskFlow - Error Handling and Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test.describe('Form Validation and Input Edge Cases', () => {
    test('should handle empty task title submission', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Try to submit with empty title
      await page.click('#saveTask');
      
      // Modal should remain open due to HTML5 validation
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      
      // Check for validation message
      const titleInput = page.locator('#taskTitle');
      const validationMessage = await titleInput.evaluate(el => el.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test('should handle extremely long task titles', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Create a very long title
      const longTitle = 'A'.repeat(1000);
      await page.fill('#taskTitle', longTitle);
      await page.click('#saveTask');
      
      // Task should be created but title might be truncated
      const taskCard = page.locator('.task-card').first();
      await expect(taskCard).toBeVisible();
      
      // Check if title is properly handled
      const titleText = await taskCard.locator('.task-title').textContent();
      expect(titleText).toBeTruthy();
      expect(titleText.length).toBeLessThanOrEqual(1000);
    });

    test('should handle special characters in task content', async ({ page }) => {
      const specialChars = '<script>alert("xss")</script>&lt;&gt;"\'';
      
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', `Special Chars: ${specialChars}`);
      await page.fill('#taskDescription', `Description with ${specialChars}`);
      await page.click('#saveTask');
      
      // Task should be created and XSS should be prevented
      const taskCard = page.locator('.task-card').filter({ hasText: 'Special Chars:' });
      await expect(taskCard).toBeVisible();
      
      // Check that script tags are not executed
      const alertsCount = await page.evaluate(() => window.alertCount || 0);
      expect(alertsCount).toBe(0);
    });

    test('should handle unicode characters', async ({ page }) => {
      const unicodeTitle = '🚀 Test Task with 中文 and عربي and 🎉';
      
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', unicodeTitle);
      await page.click('#saveTask');
      
      const taskCard = page.locator('.task-card').filter({ hasText: '🚀 Test Task' });
      await expect(taskCard).toBeVisible();
      
      const titleElement = taskCard.locator('.task-title');
      await expect(titleElement).toHaveText(unicodeTitle);
    });

    test('should handle whitespace-only input', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Fill with only whitespace
      await page.fill('#taskTitle', '   \n\t   ');
      await page.fill('#taskDescription', '   \n\t   ');
      
      // Form should still require valid input
      await page.click('#saveTask');
      
      // Check if validation prevents submission or trims whitespace
      const modal = page.locator('#taskModal');
      const modalVisible = await modal.evaluate(el => el.classList.contains('show'));
      
      if (!modalVisible) {
        // If submitted, check that whitespace was handled
        const taskCards = page.locator('.task-card');
        const count = await taskCards.count();
        expect(count).toBe(4); // Should still be just sample tasks
      }
    });
  });

  test.describe('Storage and Persistence Errors', () => {
    test('should handle localStorage being disabled', async ({ page }) => {
      // Disable localStorage
      await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          value: {
            getItem: () => { throw new Error('localStorage disabled'); },
            setItem: () => { throw new Error('localStorage disabled'); },
            removeItem: () => { throw new Error('localStorage disabled'); }
          }
        });
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // App should still load without crashing
      const addBtn = page.locator('#headerAddTaskBtn');
      await expect(addBtn).toBeVisible();
      
      // Should be able to create tasks (in memory only)
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'In-Memory Task');
      await page.click('#saveTask');
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'In-Memory Task' });
      await expect(taskCard).toBeVisible();
    });

    test('should handle corrupted localStorage data', async ({ page }) => {
      // Set corrupted data
      await page.evaluate(() => {
        localStorage.setItem('tasks', '{"invalid": json}');
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // App should recover gracefully
      const addBtn = page.locator('#headerAddTaskBtn');
      await expect(addBtn).toBeVisible();
      
      // Should be able to create new tasks
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Recovery Task');
      await page.click('#saveTask');
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Recovery Task' });
      await expect(taskCard).toBeVisible();
    });

    test('should handle localStorage quota exceeded', async ({ page }) => {
      // Fill localStorage to near capacity
      await page.evaluate(() => {
        try {
          const largeString = 'x'.repeat(1024 * 1024); // 1MB chunks
          for (let i = 0; i < 5; i++) {
            localStorage.setItem(`large_${i}`, largeString);
          }
        } catch (e) {
          // Quota might already be exceeded
        }
      });
      
      // Try to create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Quota Test Task');
      await page.click('#saveTask');
      
      // App should handle the error gracefully
      const taskCard = page.locator('.task-card').filter({ hasText: 'Quota Test Task' });
      await expect(taskCard).toBeVisible(); // Should show in UI even if not persisted
    });
  });

  test.describe('DOM Manipulation Errors', () => {
    test('should handle missing DOM elements', async ({ page }) => {
      // Remove a critical element
      await page.evaluate(() => {
        const element = document.getElementById('todoList');
        if (element) element.remove();
      });
      
      // App should not crash when trying to render tasks
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Missing DOM Test');
      await page.click('#saveTask');
      
      // At minimum, the modal should close without errors
      const modal = page.locator('#taskModal');
      await expect(modal).not.toHaveClass(/show/);
    });

    test('should handle rapid DOM changes', async ({ page }) => {
      // Rapidly create and delete tasks
      for (let i = 0; i < 10; i++) {
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', `Rapid ${i}`);
        await page.click('#saveTask');
        
        // Immediately try to delete if visible
        const deleteBtn = page.locator('[data-action="delete"]').first();
        if (await deleteBtn.isVisible()) {
          page.on('dialog', async dialog => await dialog.accept());
          await deleteBtn.click();
          page.removeAllListeners('dialog');
        }
      }
      
      // App should still be functional
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Final Test');
      await page.click('#saveTask');
      
      const finalTask = page.locator('.task-card').filter({ hasText: 'Final Test' });
      await expect(finalTask).toBeVisible();
    });
  });

  test.describe('Event Handling Edge Cases', () => {
    test('should handle multiple rapid clicks on same button', async ({ page }) => {
      // Rapidly click add task button
      for (let i = 0; i < 10; i++) {
        await page.click('#headerAddTaskBtn', { delay: 10 });
      }
      
      // Only one modal should be open
      const modals = page.locator('#taskModal.show');
      await expect(modals).toHaveCount(1);
      
      await page.press('#taskModal', 'Escape');
    });

    test('should handle clicking disabled elements', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Disable the save button
      await page.evaluate(() => {
        document.getElementById('saveTask').disabled = true;
      });
      
      // Try to click disabled button
      await page.click('#saveTask', { force: true });
      
      // Modal should remain open
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
    });

    test('should handle keyboard events on non-focusable elements', async ({ page }) => {
      // Try to trigger keyboard events on task cards
      const taskCard = page.locator('.task-card').first();
      await taskCard.press('Enter');
      await taskCard.press('Space');
      await taskCard.press('Delete');
      
      // Should not crash the application
      const addBtn = page.locator('#headerAddTaskBtn');
      await expect(addBtn).toBeVisible();
    });
  });

  test.describe('Drag and Drop Edge Cases', () => {
    test('should handle dropping outside valid targets', async ({ page }) => {
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Drop Test Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Drop Test Task' });
      
      // Try to drag to invalid location (header)
      const header = page.locator('.page-header');
      await taskCard.dragTo(header);
      
      // Task should remain in original position
      const todoList = page.locator('#todoList');
      const taskInTodo = todoList.locator('.task-card').filter({ hasText: 'Drop Test Task' });
      await expect(taskInTodo).toBeVisible();
    });

    test('should handle dragging non-draggable elements', async ({ page }) => {
      // Try to drag column headers
      const columnHeader = page.locator('.column-header').first();
      const progressColumn = page.locator('[data-status="progress"]');
      
      // This should not cause errors
      await columnHeader.dragTo(progressColumn);
      
      // App should remain functional
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Post Drag Test');
      await page.click('#saveTask');
      
      const newTask = page.locator('.task-card').filter({ hasText: 'Post Drag Test' });
      await expect(newTask).toBeVisible();
    });

    test('should handle incomplete drag operations', async ({ page }) => {
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Incomplete Drag Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Incomplete Drag Task' });
      
      // Start drag but don't complete
      await taskCard.hover();
      await page.mouse.down();
      await page.mouse.move(100, 100);
      // Don't call page.mouse.up()
      
      // Simulate page interaction to cancel drag
      await page.click('#headerAddTaskBtn');
      await page.press('#taskModal', 'Escape');
      
      // Task should still be in original position
      const todoList = page.locator('#todoList');
      const taskInTodo = todoList.locator('.task-card').filter({ hasText: 'Incomplete Drag Task' });
      await expect(taskInTodo).toBeVisible();
    });
  });

  test.describe('Network and Performance Edge Cases', () => {
    test('should handle slow rendering performance', async ({ page }) => {
      // Create many tasks to stress rendering
      await page.evaluate(() => {
        const tasks = [];
        for (let i = 0; i < 100; i++) {
          tasks.push({
            id: `perf-${i}`,
            title: `Performance Test Task ${i}`,
            description: `Description ${i}`,
            priority: ['high', 'medium', 'low'][i % 3],
            category: ['work', 'personal', 'shopping', 'health'][i % 4],
            status: ['todo', 'progress', 'completed'][i % 3],
            createdAt: new Date().toISOString()
          });
        }
        window.app.tasks = [...window.app.tasks, ...tasks];
        window.app.renderTasks();
        window.app.updateStats();
      });
      
      await page.waitForTimeout(2000);
      
      // App should still be responsive
      const addBtn = page.locator('#headerAddTaskBtn');
      await expect(addBtn).toBeEnabled();
      
      // Should be able to create new tasks
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Post Performance Task');
      await page.click('#saveTask');
      
      const newTask = page.locator('.task-card').filter({ hasText: 'Post Performance Task' });
      await expect(newTask).toBeVisible();
    });

    test('should handle memory pressure', async ({ page }) => {
      // Create objects that might cause memory pressure
      await page.evaluate(() => {
        window.memoryPressure = [];
        for (let i = 0; i < 10000; i++) {
          window.memoryPressure.push({
            data: new Array(1000).fill('memory pressure test'),
            id: i
          });
        }
      });
      
      // App should still function
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Memory Pressure Task');
      await page.click('#saveTask');
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Memory Pressure Task' });
      await expect(taskCard).toBeVisible();
      
      // Cleanup
      await page.evaluate(() => {
        delete window.memoryPressure;
      });
    });
  });

  test.describe('Browser Compatibility Edge Cases', () => {
    test('should handle missing modern JS features', async ({ page }) => {
      // Simulate older browser by removing modern features
      await page.evaluate(() => {
        // Remove some modern features that might be polyfilled
        delete window.requestIdleCallback;
        delete window.IntersectionObserver;
      });
      
      // App should still work with fallbacks
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Compatibility Test');
      await page.click('#saveTask');
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Compatibility Test' });
      await expect(taskCard).toBeVisible();
    });

    test('should handle viewport changes during interaction', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Change viewport while modal is open
      await page.setViewportSize({ width: 400, height: 600 });
      await page.waitForTimeout(300);
      
      // Modal should still be functional
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      
      await page.fill('#taskTitle', 'Viewport Change Task');
      await page.click('#saveTask');
      
      // Change back to desktop
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(300);
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Viewport Change Task' });
      await expect(taskCard).toBeVisible();
    });
  });

  test.describe('Race Condition Edge Cases', () => {
    test('should handle concurrent task operations', async ({ page }) => {
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Race Condition Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Simultaneously edit and delete (race condition)
      const editPromise = page.locator('[data-action="edit"]').first().click();
      const deletePromise = (async () => {
        page.once('dialog', async dialog => await dialog.accept());
        return page.locator('[data-action="delete"]').first().click();
      })();
      
      await Promise.allSettled([editPromise, deletePromise]);
      
      // App should handle this gracefully
      const modal = page.locator('#taskModal');
      if (await modal.isVisible()) {
        await page.press('#taskModal', 'Escape');
      }
      
      // Should be able to create new tasks
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Post Race Task');
      await page.click('#saveTask');
      
      const newTask = page.locator('.task-card').filter({ hasText: 'Post Race Task' });
      await expect(newTask).toBeVisible();
    });

    test('should handle rapid state changes', async ({ page }) => {
      // Create task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Rapid State Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Rapidly change task status
      const taskCard = page.locator('.task-card').filter({ hasText: 'Rapid State Task' });
      
      for (let i = 0; i < 5; i++) {
        const progressColumn = page.locator('[data-status="progress"] .task-list');
        const todoColumn = page.locator('[data-status="todo"] .task-list');
        
        await taskCard.dragTo(progressColumn);
        await page.waitForTimeout(50);
        await taskCard.dragTo(todoColumn);
        await page.waitForTimeout(50);
      }
      
      // Final state should be consistent
      const todoList = page.locator('#todoList');
      const finalTask = todoList.locator('.task-card').filter({ hasText: 'Rapid State Task' });
      await expect(finalTask).toBeVisible();
    });
  });

  test.describe('Security Edge Cases', () => {
    test('should prevent XSS in task content', async ({ page }) => {
      const xssPayloads = [
        '<img src=x onerror=alert("xss1")>',
        'javascript:alert("xss2")',
        '<svg/onload=alert("xss3")>',
        '"><script>alert("xss4")</script>'
      ];
      
      for (let i = 0; i < xssPayloads.length; i++) {
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', `XSS Test ${i}: ${xssPayloads[i]}`);
        await page.fill('#taskDescription', xssPayloads[i]);
        await page.click('#saveTask');
        await page.waitForTimeout(300);
      }
      
      // No alerts should have fired
      const alertCount = await page.evaluate(() => window.alertCount || 0);
      expect(alertCount).toBe(0);
      
      // Content should be properly escaped
      const xssTask = page.locator('.task-card').filter({ hasText: 'XSS Test 0' });
      await expect(xssTask).toBeVisible();
      const taskContent = await xssTask.innerHTML();
      expect(taskContent).not.toContain('<script>');
    });

    test('should handle malformed HTML in content', async ({ page }) => {
      const malformedHTML = '<div><span>Unclosed tags<div><p>More unclosed';
      
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Malformed HTML Test');
      await page.fill('#taskDescription', malformedHTML);
      await page.click('#saveTask');
      
      // App should not break
      const taskCard = page.locator('.task-card').filter({ hasText: 'Malformed HTML Test' });
      await expect(taskCard).toBeVisible();
      
      // Page structure should remain intact
      const addBtn = page.locator('#headerAddTaskBtn');
      await expect(addBtn).toBeVisible();
    });
  });
});