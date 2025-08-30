// Frontend-Backend Connectivity and Data Persistence Tests
import { test, expect } from '@playwright/test';

test.describe('TaskFlow - Data Persistence and Storage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Clear localStorage to start fresh
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test.describe('LocalStorage Persistence', () => {
    test('should save tasks to localStorage when created', async ({ page }) => {
      // Create a new task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Persistence Test Task');
      await page.fill('#taskDescription', 'Testing local storage persistence');
      await page.selectOption('#taskPriority', 'high');
      await page.selectOption('#taskCategory', 'work');
      await page.click('#saveTask');
      
      // Wait for save operation
      await page.waitForTimeout(500);
      
      // Check localStorage
      const storedTasks = await page.evaluate(() => {
        const tasks = localStorage.getItem('tasks');
        return tasks ? JSON.parse(tasks) : [];
      });
      
      expect(storedTasks).toHaveLength(5); // 4 sample + 1 new
      const newTask = storedTasks.find(task => task.title === 'Persistence Test Task');
      expect(newTask).toBeTruthy();
      expect(newTask.description).toBe('Testing local storage persistence');
      expect(newTask.priority).toBe('high');
      expect(newTask.category).toBe('work');
      expect(newTask.status).toBe('todo');
    });

    test('should persist tasks across page reloads', async ({ page }) => {
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Reload Test Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Task should still be visible
      const taskCard = page.locator('.task-card').filter({ hasText: 'Reload Test Task' });
      await expect(taskCard).toBeVisible();
    });

    test('should update localStorage when task is edited', async ({ page }) => {
      // Create a task first
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Edit Test Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Edit the task
      const editBtn = page.locator('[data-action="edit"]').first();
      await editBtn.click();
      await page.fill('#taskTitle', 'Updated Edit Test Task');
      await page.selectOption('#taskPriority', 'low');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Check localStorage
      const storedTasks = await page.evaluate(() => {
        const tasks = localStorage.getItem('tasks');
        return tasks ? JSON.parse(tasks) : [];
      });
      
      const updatedTask = storedTasks.find(task => task.title === 'Updated Edit Test Task');
      expect(updatedTask).toBeTruthy();
      expect(updatedTask.priority).toBe('low');
      
      // Old title should not exist
      const oldTask = storedTasks.find(task => task.title === 'Edit Test Task');
      expect(oldTask).toBeFalsy();
    });

    test('should remove task from localStorage when deleted', async ({ page }) => {
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Delete Test Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Get initial count
      const initialTasks = await page.evaluate(() => {
        const tasks = localStorage.getItem('tasks');
        return tasks ? JSON.parse(tasks) : [];
      });
      const initialCount = initialTasks.length;
      
      // Delete the task
      page.on('dialog', async dialog => {
        await dialog.accept();
      });
      
      const deleteBtn = page.locator('[data-action="delete"]').first();
      await deleteBtn.click();
      await page.waitForTimeout(500);
      
      // Check localStorage
      const finalTasks = await page.evaluate(() => {
        const tasks = localStorage.getItem('tasks');
        return tasks ? JSON.parse(tasks) : [];
      });
      
      expect(finalTasks).toHaveLength(initialCount - 1);
      const deletedTask = finalTasks.find(task => task.title === 'Delete Test Task');
      expect(deletedTask).toBeFalsy();
    });

    test('should update localStorage when task status changes via drag and drop', async ({ page }) => {
      // Create a task in todo
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Drag Test Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Drag to progress column
      const taskCard = page.locator('.task-card').filter({ hasText: 'Drag Test Task' });
      const progressColumn = page.locator('[data-status="progress"] .task-list');
      
      await taskCard.dragTo(progressColumn);
      await page.waitForTimeout(500);
      
      // Check localStorage
      const storedTasks = await page.evaluate(() => {
        const tasks = localStorage.getItem('tasks');
        return tasks ? JSON.parse(tasks) : [];
      });
      
      const movedTask = storedTasks.find(task => task.title === 'Drag Test Task');
      expect(movedTask.status).toBe('progress');
    });
  });

  test.describe('Data Integrity', () => {
    test('should maintain data structure integrity', async ({ page }) => {
      // Create multiple tasks with different properties
      const testTasks = [
        { title: 'Task 1', priority: 'high', category: 'work' },
        { title: 'Task 2', priority: 'medium', category: 'personal' },
        { title: 'Task 3', priority: 'low', category: 'health' }
      ];
      
      for (const task of testTasks) {
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', task.title);
        await page.selectOption('#taskPriority', task.priority);
        await page.selectOption('#taskCategory', task.category);
        await page.click('#saveTask');
        await page.waitForTimeout(300);
      }
      
      // Check data structure
      const storedTasks = await page.evaluate(() => {
        const tasks = localStorage.getItem('tasks');
        return tasks ? JSON.parse(tasks) : [];
      });
      
      // Verify each task has required properties
      const newTasks = storedTasks.filter(task => 
        testTasks.some(testTask => testTask.title === task.title)
      );
      
      newTasks.forEach(task => {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('title');
        expect(task).toHaveProperty('priority');
        expect(task).toHaveProperty('category');
        expect(task).toHaveProperty('status');
        expect(task).toHaveProperty('createdAt');
        
        // Verify data types
        expect(typeof task.id).toBe('string');
        expect(typeof task.title).toBe('string');
        expect(['high', 'medium', 'low']).toContain(task.priority);
        expect(['work', 'personal', 'shopping', 'health']).toContain(task.category);
        expect(['todo', 'progress', 'completed']).toContain(task.status);
      });
    });

    test('should handle corrupted localStorage data gracefully', async ({ page }) => {
      // Corrupt localStorage data
      await page.evaluate(() => {
        localStorage.setItem('tasks', 'invalid json');
      });
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // App should still load with empty task list or default tasks
      const taskColumns = page.locator('.task-column');
      await expect(taskColumns).toHaveCount(3);
      
      // Should be able to create new tasks
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Recovery Test Task');
      await page.click('#saveTask');
      
      // Task should be created and visible
      const taskCard = page.locator('.task-card').filter({ hasText: 'Recovery Test Task' });
      await expect(taskCard).toBeVisible();
    });

    test('should handle large amounts of data', async ({ page }) => {
      // Create many tasks programmatically
      await page.evaluate(() => {
        const largeTasks = [];
        for (let i = 0; i < 100; i++) {
          largeTasks.push({
            id: `test-${i}`,
            title: `Task ${i}`,
            description: `Description for task ${i}`,
            priority: ['high', 'medium', 'low'][i % 3],
            category: ['work', 'personal', 'shopping', 'health'][i % 4],
            status: ['todo', 'progress', 'completed'][i % 3],
            createdAt: new Date().toISOString()
          });
        }
        window.app.tasks = largeTasks;
        window.app.saveTasks();
        window.app.renderTasks();
        window.app.updateStats();
      });
      
      await page.waitForTimeout(1000);
      
      // Check if app handles large dataset
      const todoTasks = page.locator('#todoList .task-card');
      const todoCount = await todoTasks.count();
      expect(todoCount).toBeGreaterThan(0);
      
      // Stats should be updated
      const totalStat = page.locator('#totalTasks');
      const totalText = await totalStat.textContent();
      expect(parseInt(totalText)).toBeGreaterThan(50);
    });
  });

  test.describe('Sync and Consistency', () => {
    test('should maintain UI state consistency with data', async ({ page }) => {
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Consistency Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Check UI consistency
      const taskCard = page.locator('.task-card').filter({ hasText: 'Consistency Test' });
      await expect(taskCard).toBeVisible();
      
      // Check stats
      const totalStat = page.locator('#totalTasks');
      const todoStat = page.locator('#todoTasks');
      const todoCount = page.locator('#todoCount');
      
      const totalText = await totalStat.textContent();
      const todoText = await todoStat.textContent();
      const countText = await todoCount.textContent();
      
      expect(parseInt(totalText)).toBe(5); // 4 sample + 1 new
      expect(parseInt(todoText)).toBe(3); // 2 sample + 1 new
      expect(parseInt(countText)).toBe(3);
    });

    test('should update all related UI elements when data changes', async ({ page }) => {
      // Create task in todo
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Status Change Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Get initial counts
      const initialTodo = await page.locator('#todoTasks').textContent();
      const initialProgress = await page.locator('#progressTasks').textContent();
      
      // Move task to progress
      const taskCard = page.locator('.task-card').filter({ hasText: 'Status Change Test' });
      const progressColumn = page.locator('[data-status="progress"] .task-list');
      
      await taskCard.dragTo(progressColumn);
      await page.waitForTimeout(500);
      
      // Check updated counts
      const finalTodo = await page.locator('#todoTasks').textContent();
      const finalProgress = await page.locator('#progressTasks').textContent();
      
      expect(parseInt(finalTodo)).toBe(parseInt(initialTodo) - 1);
      expect(parseInt(finalProgress)).toBe(parseInt(initialProgress) + 1);
      
      // Check column counts
      const todoColumnCount = await page.locator('#todoCount').textContent();
      const progressColumnCount = await page.locator('#progressCount').textContent();
      
      expect(parseInt(todoColumnCount)).toBe(parseInt(finalTodo));
      expect(parseInt(progressColumnCount)).toBe(parseInt(finalProgress));
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle localStorage quota exceeded', async ({ page }) => {
      // Try to fill localStorage to quota
      const result = await page.evaluate(() => {
        try {
          const largeString = 'x'.repeat(1024 * 1024); // 1MB string
          for (let i = 0; i < 10; i++) {
            localStorage.setItem(`large_data_${i}`, largeString);
          }
          return 'success';
        } catch (e) {
          return e.name;
        }
      });
      
      // If quota exceeded, app should handle gracefully
      if (result === 'QuotaExceededError') {
        // Try to create a task
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', 'Quota Test Task');
        await page.click('#saveTask');
        
        // App should still function, even if persistence fails
        const taskCard = page.locator('.task-card').filter({ hasText: 'Quota Test Task' });
        await expect(taskCard).toBeVisible();
      }
    });

    test('should handle concurrent access gracefully', async ({ page }) => {
      // Simulate concurrent task creation
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(page.evaluate((index) => {
          return new Promise(resolve => {
            setTimeout(() => {
              const task = {
                id: window.app.generateId(),
                title: `Concurrent Task ${index}`,
                description: '',
                priority: 'medium',
                category: 'work',
                status: 'todo',
                createdAt: new Date().toISOString()
              };
              window.app.tasks.push(task);
              window.app.saveTasks();
              resolve();
            }, Math.random() * 100);
          });
        }, i));
      }
      
      await Promise.all(promises);
      await page.waitForTimeout(500);
      
      // Reload and check data integrity
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // All tasks should be present without corruption
      const storedTasks = await page.evaluate(() => {
        const tasks = localStorage.getItem('tasks');
        return tasks ? JSON.parse(tasks) : [];
      });
      
      const concurrentTasks = storedTasks.filter(task => 
        task.title.startsWith('Concurrent Task')
      );
      expect(concurrentTasks).toHaveLength(5);
    });
  });

  test.describe('Performance with Data Operations', () => {
    test('should handle rapid data operations without blocking UI', async ({ page }) => {
      // Rapidly create, edit, and delete tasks
      const startTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', `Rapid Task ${i}`);
        await page.click('#saveTask');
        // Don't wait - test rapid operations
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 5 seconds for 10 tasks)
      expect(duration).toBeLessThan(5000);
      
      // UI should remain responsive
      const addBtn = page.locator('#headerAddTaskBtn');
      await expect(addBtn).toBeEnabled();
    });

    test('should debounce save operations efficiently', async ({ page }) => {
      // Create a task and rapidly edit it
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Debounce Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Edit rapidly
      const editBtn = page.locator('[data-action="edit"]').first();
      await editBtn.click();
      
      // Type rapidly in title field
      await page.fill('#taskTitle', '');
      const testString = 'Rapid typing test';
      for (const char of testString) {
        await page.type('#taskTitle', char, { delay: 10 });
      }
      
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Check final result
      const taskCard = page.locator('.task-card').filter({ hasText: 'Rapid typing test' });
      await expect(taskCard).toBeVisible();
      
      // Check localStorage was updated correctly
      const storedTasks = await page.evaluate(() => {
        const tasks = localStorage.getItem('tasks');
        return tasks ? JSON.parse(tasks) : [];
      });
      
      const updatedTask = storedTasks.find(task => task.title === 'Rapid typing test');
      expect(updatedTask).toBeTruthy();
    });
  });
});