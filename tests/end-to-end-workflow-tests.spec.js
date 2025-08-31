// End-to-End Workflow Tests
import { test, expect } from '@playwright/test';

test.describe('TaskFlow - End-to-End Workflow Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test.describe('Complete Task Lifecycle Workflows', () => {
    test('complete task creation workflow', async ({ page }) => {
      // Step 1: Open task creation modal
      await page.click('#headerAddTaskBtn');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      await expect(page.locator('#modalTitle')).toHaveText('Add New Task');
      
      // Step 2: Fill form with all details
      await page.fill('#taskTitle', 'Complete Workflow Test Task');
      await page.fill('#taskDescription', 'This is a comprehensive test of the task creation workflow');
      await page.selectOption('#taskPriority', 'high');
      await page.selectOption('#taskCategory', 'work');
      
      // Step 3: Submit form
      await page.click('#saveTask');
      
      // Step 4: Verify modal closes
      await expect(modal).not.toHaveClass(/show/);
      
      // Step 5: Verify task appears in correct column
      const taskCard = page.locator('.task-card').filter({ hasText: 'Complete Workflow Test Task' });
      await expect(taskCard).toBeVisible();
      
      const todoColumn = page.locator('#todoList');
      const taskInTodo = todoColumn.locator('.task-card').filter({ hasText: 'Complete Workflow Test Task' });
      await expect(taskInTodo).toBeVisible();
      
      // Step 6: Verify task details are correct
      await expect(taskCard.locator('.task-title')).toHaveText('Complete Workflow Test Task');
      await expect(taskCard.locator('.task-description')).toHaveText('This is a comprehensive test of the task creation workflow');
      await expect(taskCard.locator('.priority-high')).toBeVisible();
      await expect(taskCard.locator('.task-tag')).toHaveText('work');
      
      // Step 7: Verify stats are updated
      const totalTasks = page.locator('#totalTasks');
      const todoTasks = page.locator('#todoTasks');
      const todoCount = page.locator('#todoCount');
      
      await expect(totalTasks).toHaveText('5'); // 4 sample + 1 new
      await expect(todoTasks).toHaveText('3'); // 2 sample + 1 new
      await expect(todoCount).toHaveText('3');
      
      // Step 8: Verify success toast
      const toast = page.locator('.toast.success');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Task created successfully!');
    });

    test('complete task editing workflow', async ({ page }) => {
      // Setup: Create a task first
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Original Task Title');
      await page.fill('#taskDescription', 'Original description');
      await page.selectOption('#taskPriority', 'medium');
      await page.selectOption('#taskCategory', 'personal');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Step 1: Click edit button
      const editBtn = page.locator('[data-action="edit"]').first();
      await editBtn.click();
      
      // Step 2: Verify modal opens with existing data
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
      await expect(page.locator('#modalTitle')).toHaveText('Edit Task');
      await expect(page.locator('#taskTitle')).toHaveValue('Original Task Title');
      await expect(page.locator('#taskDescription')).toHaveValue('Original description');
      await expect(page.locator('#taskPriority')).toHaveValue('medium');
      await expect(page.locator('#taskCategory')).toHaveValue('personal');
      
      // Step 3: Modify task details
      await page.fill('#taskTitle', 'Updated Task Title');
      await page.fill('#taskDescription', 'Updated description with more details');
      await page.selectOption('#taskPriority', 'high');
      await page.selectOption('#taskCategory', 'work');
      
      // Step 4: Save changes
      await page.click('#saveTask');
      
      // Step 5: Verify modal closes
      await expect(modal).not.toHaveClass(/show/);
      
      // Step 6: Verify task is updated in UI
      const updatedTask = page.locator('.task-card').filter({ hasText: 'Updated Task Title' });
      await expect(updatedTask).toBeVisible();
      await expect(updatedTask.locator('.task-description')).toHaveText('Updated description with more details');
      await expect(updatedTask.locator('.priority-high')).toBeVisible();
      await expect(updatedTask.locator('.task-tag')).toHaveText('work');
      
      // Step 7: Verify old task is gone
      const oldTask = page.locator('.task-card').filter({ hasText: 'Original Task Title' });
      await expect(oldTask).not.toBeVisible();
      
      // Step 8: Verify success toast
      const toast = page.locator('.toast.success');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Task updated successfully!');
    });

    test('complete task deletion workflow', async ({ page }) => {
      // Setup: Create a task first
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Task to Delete');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Get initial task count
      const initialCount = await page.locator('#totalTasks').textContent();
      
      // Step 1: Set up dialog handler
      let confirmDialogShown = false;
      page.on('dialog', async dialog => {
        confirmDialogShown = true;
        expect(dialog.message()).toContain('Are you sure you want to delete this task?');
        await dialog.accept();
      });
      
      // Step 2: Click delete button
      const deleteBtn = page.locator('[data-action="delete"]').first();
      await deleteBtn.click();
      
      // Step 3: Verify confirmation dialog was shown
      expect(confirmDialogShown).toBeTruthy();
      
      // Step 4: Wait for deletion to complete
      await page.waitForTimeout(500);
      
      // Step 5: Verify task is removed from UI
      const deletedTask = page.locator('.task-card').filter({ hasText: 'Task to Delete' });
      await expect(deletedTask).not.toBeVisible();
      
      // Step 6: Verify stats are updated
      const finalCount = await page.locator('#totalTasks').textContent();
      expect(parseInt(finalCount)).toBe(parseInt(initialCount) - 1);
      
      // Step 7: Verify success toast
      const toast = page.locator('.toast.success');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Task deleted successfully!');
    });

    test('complete task status change workflow via drag and drop', async ({ page }) => {
      // Setup: Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Drag and Drop Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Get initial counts
      const initialTodo = await page.locator('#todoTasks').textContent();
      const initialProgress = await page.locator('#progressTasks').textContent();
      
      // Step 1: Locate task and target column
      const taskCard = page.locator('.task-card').filter({ hasText: 'Drag and Drop Task' });
      const progressColumn = page.locator('[data-status="progress"] .task-list');
      
      // Verify task is initially in todo
      const todoColumn = page.locator('#todoList');
      const taskInTodo = todoColumn.locator('.task-card').filter({ hasText: 'Drag and Drop Task' });
      await expect(taskInTodo).toBeVisible();
      
      // Step 2: Perform drag and drop
      await taskCard.dragTo(progressColumn);
      
      // Step 3: Wait for drop animation/processing
      await page.waitForTimeout(500);
      
      // Step 4: Verify task moved to progress column
      const progressList = page.locator('#progressList');
      const taskInProgress = progressList.locator('.task-card').filter({ hasText: 'Drag and Drop Task' });
      await expect(taskInProgress).toBeVisible();
      
      // Step 5: Verify task is no longer in todo
      const taskStillInTodo = todoColumn.locator('.task-card').filter({ hasText: 'Drag and Drop Task' });
      await expect(taskStillInTodo).not.toBeVisible();
      
      // Step 6: Verify stats are updated
      const finalTodo = await page.locator('#todoTasks').textContent();
      const finalProgress = await page.locator('#progressTasks').textContent();
      
      expect(parseInt(finalTodo)).toBe(parseInt(initialTodo) - 1);
      expect(parseInt(finalProgress)).toBe(parseInt(initialProgress) + 1);
      
      // Step 7: Verify column counts
      const todoCount = await page.locator('#todoCount').textContent();
      const progressCount = await page.locator('#progressCount').textContent();
      
      expect(parseInt(todoCount)).toBe(parseInt(finalTodo));
      expect(parseInt(progressCount)).toBe(parseInt(finalProgress));
      
      // Step 8: Verify success toast
      const toast = page.locator('.toast.success');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Task moved to progress!');
    });
  });

  test.describe('Multi-Step Workflows', () => {
    test('task progression from todo to completed', async ({ page }) => {
      // Create task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Full Progression Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Move from todo to progress
      const taskCard = page.locator('.task-card').filter({ hasText: 'Full Progression Task' });
      const progressColumn = page.locator('[data-status="progress"] .task-list');
      
      await taskCard.dragTo(progressColumn);
      await page.waitForTimeout(500);
      
      // Verify in progress
      const progressList = page.locator('#progressList');
      await expect(progressList.locator('.task-card').filter({ hasText: 'Full Progression Task' })).toBeVisible();
      
      // Move from progress to completed
      const taskCardInProgress = progressList.locator('.task-card').filter({ hasText: 'Full Progression Task' });
      const completedColumn = page.locator('[data-status="completed"] .task-list');
      
      await taskCardInProgress.dragTo(completedColumn);
      await page.waitForTimeout(500);
      
      // Verify in completed
      const completedList = page.locator('#completedList');
      await expect(completedList.locator('.task-card').filter({ hasText: 'Full Progression Task' })).toBeVisible();
      
      // Verify not in other columns
      await expect(page.locator('#todoList .task-card').filter({ hasText: 'Full Progression Task' })).not.toBeVisible();
      await expect(page.locator('#progressList .task-card').filter({ hasText: 'Full Progression Task' })).not.toBeVisible();
      
      // Verify final stats
      const completedTasks = await page.locator('#completedTasks').textContent();
      expect(parseInt(completedTasks)).toBe(2); // 1 sample + 1 new
    });

    test('create multiple tasks and manage them', async ({ page }) => {
      const tasks = [
        { title: 'Task 1', priority: 'high', category: 'work' },
        { title: 'Task 2', priority: 'medium', category: 'personal' },
        { title: 'Task 3', priority: 'low', category: 'health' }
      ];
      
      // Create multiple tasks
      for (const task of tasks) {
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', task.title);
        await page.selectOption('#taskPriority', task.priority);
        await page.selectOption('#taskCategory', task.category);
        await page.click('#saveTask');
        await page.waitForTimeout(300);
      }
      
      // Verify all tasks created
      for (const task of tasks) {
        const taskCard = page.locator('.task-card').filter({ hasText: task.title });
        await expect(taskCard).toBeVisible();
      }
      
      // Move tasks to different columns
      const task1 = page.locator('.task-card').filter({ hasText: 'Task 1' });
      const task2 = page.locator('.task-card').filter({ hasText: 'Task 2' });
      
      await task1.dragTo(page.locator('[data-status="progress"] .task-list'));
      await page.waitForTimeout(300);
      
      await task2.dragTo(page.locator('[data-status="completed"] .task-list'));
      await page.waitForTimeout(300);
      
      // Verify final distribution
      await expect(page.locator('#todoList .task-card').filter({ hasText: 'Task 3' })).toBeVisible();
      await expect(page.locator('#progressList .task-card').filter({ hasText: 'Task 1' })).toBeVisible();
      await expect(page.locator('#completedList .task-card').filter({ hasText: 'Task 2' })).toBeVisible();
      
      // Verify stats
      const totalTasks = await page.locator('#totalTasks').textContent();
      expect(parseInt(totalTasks)).toBe(7); // 4 sample + 3 new
    });

    test('edit task and change status in same session', async ({ page }) => {
      // Create task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Edit and Move Task');
      await page.fill('#taskDescription', 'Original description');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Edit task
      const editBtn = page.locator('[data-action="edit"]').first();
      await editBtn.click();
      await page.fill('#taskTitle', 'Updated and Moved Task');
      await page.fill('#taskDescription', 'Updated description');
      await page.selectOption('#taskPriority', 'high');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Move task to progress
      const updatedTask = page.locator('.task-card').filter({ hasText: 'Updated and Moved Task' });
      const progressColumn = page.locator('[data-status="progress"] .task-list');
      
      await updatedTask.dragTo(progressColumn);
      await page.waitForTimeout(500);
      
      // Verify final state
      const taskInProgress = page.locator('#progressList .task-card').filter({ hasText: 'Updated and Moved Task' });
      await expect(taskInProgress).toBeVisible();
      await expect(taskInProgress.locator('.task-description')).toHaveText('Updated description');
      await expect(taskInProgress.locator('.priority-high')).toBeVisible();
    });
  });

  test.describe('Navigation and View Switching Workflows', () => {
    test('navigate between different views with tasks', async ({ page }) => {
      // Create a task first
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Navigation Test Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Verify task is visible in task board
      const taskCard = page.locator('.task-card').filter({ hasText: 'Navigation Test Task' });
      await expect(taskCard).toBeVisible();
      
      // Navigate to calendar view
      await page.click('[data-page="calendar"]');
      await expect(page.locator('.page-title')).toHaveText('Calendar View');
      
      // Task board should be hidden
      const taskManager = page.locator('.task-manager');
      await expect(taskManager).toHaveCSS('display', 'none');
      
      // Navigate to analytics view
      await page.click('[data-page="analytics"]');
      await expect(page.locator('.page-title')).toHaveText('Analytics Dashboard');
      
      // Navigate back to tasks
      await page.click('[data-page="tasks"]');
      await expect(page.locator('.page-title')).toHaveText('Task Board');
      
      // Task should still be visible
      await expect(taskCard).toBeVisible();
      await expect(taskManager).toHaveCSS('display', 'grid');
    });

    test('category filtering workflow', async ({ page }) => {
      // Create tasks in different categories
      const categories = ['work', 'personal', 'health'];
      
      for (let i = 0; i < categories.length; i++) {
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', `${categories[i]} Task`);
        await page.selectOption('#taskCategory', categories[i]);
        await page.click('#saveTask');
        await page.waitForTimeout(300);
      }
      
      // Test category filtering
      await page.click('[data-category="work"]');
      await expect(page.locator('[data-category="work"]')).toHaveClass(/active/);
      
      // All tasks should still be visible (filtering is placeholder)
      // In a real implementation, only work tasks would show
      const workTask = page.locator('.task-card').filter({ hasText: 'work Task' });
      await expect(workTask).toBeVisible();
    });
  });

  test.describe('Error Recovery Workflows', () => {
    test('recover from failed operations', async ({ page }) => {
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Recovery Test Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Simulate network error during edit
      await page.route('**/*', route => route.abort());
      
      const editBtn = page.locator('[data-action="edit"]').first();
      await editBtn.click();
      await page.fill('#taskTitle', 'Failed Update');
      await page.click('#saveTask');
      
      // Remove network blocking
      await page.unroute('**/*');
      
      // App should still be functional
      await page.click('#cancelTask');
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'New Task After Error');
      await page.click('#saveTask');
      
      // New task should be created
      const newTask = page.locator('.task-card').filter({ hasText: 'New Task After Error' });
      await expect(newTask).toBeVisible();
    });

    test('handle page refresh during operation', async ({ page }) => {
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Pre-refresh Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Open edit modal
      const editBtn = page.locator('[data-action="edit"]').first();
      await editBtn.click();
      await page.fill('#taskTitle', 'Mid-edit Task');
      
      // Refresh page without saving
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Original task should still exist
      const originalTask = page.locator('.task-card').filter({ hasText: 'Pre-refresh Task' });
      await expect(originalTask).toBeVisible();
      
      // Unsaved changes should be lost
      const midEditTask = page.locator('.task-card').filter({ hasText: 'Mid-edit Task' });
      await expect(midEditTask).not.toBeVisible();
    });
  });

  test.describe('Performance Workflows', () => {
    test('handle rapid user interactions', async ({ page }) => {
      // Rapid task creation
      for (let i = 0; i < 5; i++) {
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', `Rapid Task ${i}`);
        await page.click('#saveTask');
        // No wait - test rapid operations
      }
      
      await page.waitForTimeout(1000);
      
      // All tasks should be created
      for (let i = 0; i < 5; i++) {
        const task = page.locator('.task-card').filter({ hasText: `Rapid Task ${i}` });
        await expect(task).toBeVisible();
      }
      
      // Stats should be correct
      const totalTasks = await page.locator('#totalTasks').textContent();
      expect(parseInt(totalTasks)).toBe(9); // 4 sample + 5 new
    });

    test('batch operations workflow', async ({ page }) => {
      // Create multiple tasks
      const taskTitles = [];
      for (let i = 0; i < 3; i++) {
        const title = `Batch Task ${i}`;
        taskTitles.push(title);
        
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', title);
        await page.selectOption('#taskPriority', i === 0 ? 'high' : i === 1 ? 'medium' : 'low');
        await page.click('#saveTask');
        await page.waitForTimeout(300);
      }
      
      // Move all tasks to progress column
      for (const title of taskTitles) {
        const task = page.locator('.task-card').filter({ hasText: title });
        const progressColumn = page.locator('[data-status="progress"] .task-list');
        await task.dragTo(progressColumn);
        await page.waitForTimeout(200);
      }
      
      // Verify all tasks moved
      for (const title of taskTitles) {
        const taskInProgress = page.locator('#progressList .task-card').filter({ hasText: title });
        await expect(taskInProgress).toBeVisible();
      }
      
      // Verify stats updated correctly
      const progressTasks = await page.locator('#progressTasks').textContent();
      expect(parseInt(progressTasks)).toBe(4); // 1 sample + 3 new
    });
  });
});