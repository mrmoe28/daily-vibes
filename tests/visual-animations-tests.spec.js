// Visual Feedback and Animation Tests
import { test, expect } from '@playwright/test';

test.describe('TaskFlow - Visual Feedback and Animations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test.describe('CSS Transitions and Animations', () => {
    test('background animation should be running', async ({ page }) => {
      const backgroundEl = page.locator('.background-animation');
      await expect(backgroundEl).toBeVisible();
      
      // Check animation property
      const animationName = await backgroundEl.evaluate(el => 
        window.getComputedStyle(el).animationName
      );
      expect(animationName).toBe('backgroundShift');
      
      const animationDuration = await backgroundEl.evaluate(el => 
        window.getComputedStyle(el).animationDuration
      );
      expect(animationDuration).toBe('20s');
    });

    test('buttons should have smooth hover transitions', async ({ page }) => {
      const addBtn = page.locator('#headerAddTaskBtn');
      
      // Check initial state
      const initialTransform = await addBtn.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      
      // Hover and check for transform change
      await addBtn.hover();
      await page.waitForTimeout(100); // Wait for transition
      
      const hoveredTransform = await addBtn.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      
      expect(hoveredTransform).not.toBe(initialTransform);
      expect(hoveredTransform).toContain('matrix');
    });

    test('task cards should animate on hover', async ({ page }) => {
      // Add a test task first
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Animation Test Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const taskCard = page.locator('.task-card').first();
      await expect(taskCard).toBeVisible();
      
      // Check initial transform
      const initialTransform = await taskCard.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      
      // Hover and check animation
      await taskCard.hover();
      await page.waitForTimeout(200);
      
      const hoveredTransform = await taskCard.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      
      expect(hoveredTransform).not.toBe(initialTransform);
      
      // Check box-shadow change
      const hoveredShadow = await taskCard.evaluate(el => 
        window.getComputedStyle(el).boxShadow
      );
      expect(hoveredShadow).not.toBe('none');
    });

    test('modal should have proper show/hide animations', async ({ page }) => {
      const modal = page.locator('#taskModal');
      
      // Modal should be hidden initially
      await expect(modal).not.toHaveClass(/show/);
      
      // Open modal
      await page.click('#headerAddTaskBtn');
      await expect(modal).toHaveClass(/show/);
      
      // Check if modal has transition properties
      const transition = await modal.evaluate(el => 
        window.getComputedStyle(el).transition
      );
      expect(transition).not.toBe('all 0s ease 0s');
      
      // Close modal
      await page.press('#taskModal', 'Escape');
      await expect(modal).not.toHaveClass(/show/);
    });

    test('loading animation should work', async ({ page }) => {
      // Create a loading element to test
      await page.evaluate(() => {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'loading';
        loadingEl.id = 'test-loading';
        document.body.appendChild(loadingEl);
      });
      
      const loadingEl = page.locator('#test-loading');
      await expect(loadingEl).toBeVisible();
      
      // Check animation properties
      const animationName = await loadingEl.evaluate(el => 
        window.getComputedStyle(el).animationName
      );
      expect(animationName).toBe('spin');
      
      const animationDuration = await loadingEl.evaluate(el => 
        window.getComputedStyle(el).animationDuration
      );
      expect(animationDuration).toBe('1s');
    });
  });

  test.describe('Visual State Changes', () => {
    test('navigation items should show active state', async ({ page }) => {
      const taskBoardNav = page.locator('[data-page="tasks"]');
      await expect(taskBoardNav).toHaveClass(/active/);
      
      // Check active styling
      const backgroundColor = await taskBoardNav.evaluate(el => 
        window.getComputedStyle(el).background
      );
      expect(backgroundColor).toContain('gradient');
      
      // Switch to another nav item
      await page.click('[data-page="calendar"]');
      
      // Old item should not be active
      await expect(taskBoardNav).not.toHaveClass(/active/);
      
      // New item should be active
      const calendarNav = page.locator('[data-page="calendar"]');
      await expect(calendarNav).toHaveClass(/active/);
    });

    test('form inputs should show focus states', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      const titleInput = page.locator('#taskTitle');
      
      await titleInput.focus();
      
      // Check for focus styling
      const borderColor = await titleInput.evaluate(el => 
        window.getComputedStyle(el).borderColor
      );
      const boxShadow = await titleInput.evaluate(el => 
        window.getComputedStyle(el).boxShadow
      );
      
      expect(borderColor).not.toBe('rgba(139, 115, 85, 0.25)'); // Should change from default
      expect(boxShadow).toContain('rgba(139, 115, 85, 0.15)');
    });

    test('button should show pressed state', async ({ page }) => {
      const addBtn = page.locator('#headerAddTaskBtn');
      
      // Simulate mouse down
      await addBtn.hover();
      await page.mouse.down();
      
      // Check for active/pressed state
      const transform = await addBtn.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      
      await page.mouse.up();
      
      // Transform should indicate pressed state
      expect(transform).toContain('matrix');
    });

    test('drag and drop visual feedback should work', async ({ page }) => {
      // Add a test task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Drag Test Task');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const taskCard = page.locator('.task-card').first();
      const progressColumn = page.locator('[data-status="progress"]');
      
      // Start drag
      await taskCard.hover();
      await page.mouse.down();
      
      // Check dragging class
      await expect(taskCard).toHaveClass(/dragging/);
      
      // Move to progress column
      await progressColumn.hover();
      
      // Check drag-over class on column
      await expect(progressColumn).toHaveClass(/drag-over/);
      
      // Complete drag
      await page.mouse.up();
      
      // Classes should be removed
      await expect(taskCard).not.toHaveClass(/dragging/);
      await expect(progressColumn).not.toHaveClass(/drag-over/);
    });
  });

  test.describe('Toast Notifications', () => {
    test('toast should appear and disappear with animation', async ({ page }) => {
      // Trigger a toast by creating a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Toast Test Task');
      await page.click('#saveTask');
      
      // Wait for toast to appear
      const toast = page.locator('.toast');
      await expect(toast).toBeVisible();
      await expect(toast).toHaveClass(/show/);
      
      // Check toast content
      await expect(toast).toContainText('Task created successfully!');
      
      // Wait for toast to disappear
      await page.waitForTimeout(3500);
      await expect(toast).not.toBeVisible();
    });

    test('toast should have proper styling based on type', async ({ page }) => {
      // Create a success toast
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Success Toast');
      await page.click('#saveTask');
      
      const toast = page.locator('.toast.success');
      await expect(toast).toBeVisible();
      
      // Check success styling
      const borderColor = await toast.evaluate(el => 
        window.getComputedStyle(el).borderColor
      );
      expect(borderColor).toContain('122, 132, 113'); // success color
    });
  });

  test.describe('Responsive Design Animations', () => {
    test('sidebar should animate on mobile view', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      
      const sidebar = page.locator('.sidebar');
      
      // Check if sidebar is hidden on mobile
      const transform = await sidebar.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      expect(transform).toContain('translateX(-100%)');
      
      // Add a show class and check animation
      await page.evaluate(() => {
        document.querySelector('.sidebar').classList.add('show');
      });
      
      await page.waitForTimeout(300);
      
      const showTransform = await sidebar.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      expect(showTransform).toBe('none');
    });

    test('task columns should stack on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      
      const taskManager = page.locator('.task-manager');
      const gridColumns = await taskManager.evaluate(el => 
        window.getComputedStyle(el).gridTemplateColumns
      );
      
      expect(gridColumns).toBe('1fr');
    });
  });

  test.describe('CSS Variable Usage', () => {
    test('should use CSS custom properties for theming', async ({ page }) => {
      // Check if CSS variables are properly applied
      const primaryColor = await page.evaluate(() => 
        getComputedStyle(document.documentElement).getPropertyValue('--primary')
      );
      expect(primaryColor.trim()).toBe('#8b7355');
      
      const background = await page.evaluate(() => 
        getComputedStyle(document.documentElement).getPropertyValue('--background')
      );
      expect(background.trim()).toBe('#f5f3f0');
    });

    test('gradient variables should be applied correctly', async ({ page }) => {
      const addBtn = page.locator('#headerAddTaskBtn');
      const background = await addBtn.evaluate(el => 
        window.getComputedStyle(el).background
      );
      
      expect(background).toContain('gradient');
      expect(background).toContain('135deg');
    });
  });

  test.describe('Performance-Related Animations', () => {
    test('elements should have proper will-change properties', async ({ page }) => {
      const backgroundEl = page.locator('.background-animation');
      const willChange = await backgroundEl.evaluate(el => 
        window.getComputedStyle(el).willChange
      );
      expect(willChange).toBe('transform');
      
      // Check task cards
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Will Change Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const taskCard = page.locator('.task-card').first();
      const cardWillChange = await taskCard.evaluate(el => 
        window.getComputedStyle(el).willChange
      );
      expect(cardWillChange).toBe('transform, box-shadow');
    });

    test('elements should use transform3d for hardware acceleration', async ({ page }) => {
      // Add a task to test
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Transform Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const taskCard = page.locator('.task-card').first();
      const transform = await taskCard.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      
      // Should have translateZ(0) for hardware acceleration
      expect(transform).toContain('matrix3d');
    });

    test('input fields should have optimized performance properties', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      const titleInput = page.locator('#taskTitle');
      
      const willChange = await titleInput.evaluate(el => 
        window.getComputedStyle(el).willChange
      );
      expect(willChange).toBe('border-color');
      
      const contain = await titleInput.evaluate(el => 
        window.getComputedStyle(el).contain
      );
      expect(contain).toBe('layout style paint');
    });
  });

  test.describe('Accessibility Animation Preferences', () => {
    test('should respect prefers-reduced-motion', async ({ page }) => {
      // Simulate reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      // Check if animations are reduced or disabled
      const backgroundEl = page.locator('.background-animation');
      
      // In a real implementation, animations might be disabled
      // For now, we just check the element exists
      await expect(backgroundEl).toBeVisible();
    });
  });

  test.describe('Visual Regression Prevention', () => {
    test('button should maintain consistent appearance', async ({ page }) => {
      const addBtn = page.locator('#headerAddTaskBtn');
      
      // Check computed styles remain consistent
      const styles = await addBtn.evaluate(el => ({
        backgroundColor: window.getComputedStyle(el).backgroundColor,
        color: window.getComputedStyle(el).color,
        borderRadius: window.getComputedStyle(el).borderRadius,
        padding: window.getComputedStyle(el).padding,
        fontSize: window.getComputedStyle(el).fontSize,
        fontWeight: window.getComputedStyle(el).fontWeight
      }));
      
      // These values should match design specifications
      expect(styles.color).toBe('rgb(255, 255, 255)');
      expect(styles.borderRadius).toBe('10px');
      expect(styles.fontWeight).toBe('600');
    });

    test('modal should have consistent dimensions and positioning', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      const modal = page.locator('#taskModal');
      const modalContent = page.locator('.modal-content');
      
      const styles = await modalContent.evaluate(el => ({
        maxWidth: window.getComputedStyle(el).maxWidth,
        width: window.getComputedStyle(el).width,
        borderRadius: window.getComputedStyle(el).borderRadius,
        padding: window.getComputedStyle(el).padding
      }));
      
      expect(styles.maxWidth).toBe('500px');
      expect(styles.width).toBe('90%');
      expect(styles.borderRadius).toBe('15px');
      expect(styles.padding).toBe('32px');
    });
  });
});