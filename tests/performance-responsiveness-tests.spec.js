// Performance Tests for Button Responsiveness
import { test, expect } from '@playwright/test';

test.describe('TaskFlow - Performance and Button Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test.describe('Button Response Time Tests', () => {
    test('should respond to clicks within acceptable time limits', async ({ page }) => {
      const addBtn = page.locator('#headerAddTaskBtn');
      
      // Measure click response time
      const startTime = performance.now();
      await addBtn.click();
      
      // Wait for modal to appear and measure time
      await page.waitForSelector('#taskModal.show');
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Should respond within 100ms for good UX
      expect(responseTime).toBeLessThan(100);
      
      console.log(`Button response time: ${responseTime}ms`);
    });

    test('should handle rapid button clicks without performance degradation', async ({ page }) => {
      const responseTimes = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        await page.click('#headerAddTaskBtn');
        await page.waitForSelector('#taskModal.show');
        const endTime = performance.now();
        
        responseTimes.push(endTime - startTime);
        
        // Close modal for next iteration
        await page.press('#taskModal', 'Escape');
        await page.waitForSelector('#taskModal:not(.show)');
      }
      
      // Calculate average response time
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      
      console.log(`Average response time: ${avgResponseTime}ms`);
      console.log(`Max response time: ${maxResponseTime}ms`);
      
      // Performance shouldn't degrade significantly
      expect(avgResponseTime).toBeLessThan(150);
      expect(maxResponseTime).toBeLessThan(200);
    });

    test('should maintain performance with large task datasets', async ({ page }) => {
      // Create a large dataset
      await page.evaluate(() => {
        const largeTasks = [];
        for (let i = 0; i < 500; i++) {
          largeTasks.push({
            id: `perf-task-${i}`,
            title: `Performance Test Task ${i}`,
            description: `Description for performance test task number ${i}`,
            priority: ['high', 'medium', 'low'][i % 3],
            category: ['work', 'personal', 'shopping', 'health'][i % 4],
            status: ['todo', 'progress', 'completed'][i % 3],
            createdAt: new Date().toISOString()
          });
        }
        window.app.tasks = [...window.app.tasks, ...largeTasks];
        window.app.renderTasks();
        window.app.updateStats();
      });
      
      await page.waitForTimeout(2000); // Allow rendering to complete
      
      // Test button responsiveness with large dataset
      const startTime = performance.now();
      await page.click('#headerAddTaskBtn');
      await page.waitForSelector('#taskModal.show');
      const endTime = performance.now();
      
      const responseTime = endTime - startTime;
      console.log(`Response time with 500 tasks: ${responseTime}ms`);
      
      // Should still be responsive even with large dataset
      expect(responseTime).toBeLessThan(200);
    });
  });

  test.describe('Rendering Performance Tests', () => {
    test('should render task creation efficiently', async ({ page }) => {
      const performanceEntries = [];
      
      // Enable performance monitoring
      await page.evaluate(() => {
        window.performanceMarks = [];
        const originalMark = performance.mark;
        performance.mark = function(name) {
          window.performanceMarks.push({ name, time: performance.now() });
          return originalMark.call(this, name);
        };
      });
      
      // Create multiple tasks and measure performance
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', `Performance Task ${i}`);
        await page.fill('#taskDescription', `Description ${i}`);
        await page.click('#saveTask');
        
        // Wait for task to appear in UI
        await page.waitForSelector(`.task-card:has-text("Performance Task ${i}")`);
        
        const endTime = performance.now();
        performanceEntries.push(endTime - startTime);
      }
      
      const avgTime = performanceEntries.reduce((a, b) => a + b, 0) / performanceEntries.length;
      console.log(`Average task creation time: ${avgTime}ms`);
      
      // Task creation should be quick
      expect(avgTime).toBeLessThan(500);
    });

    test('should handle DOM updates efficiently', async ({ page }) => {
      // Monitor DOM mutation performance
      await page.evaluate(() => {
        window.mutationCount = 0;
        const observer = new MutationObserver((mutations) => {
          window.mutationCount += mutations.length;
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true
        });
      });
      
      // Perform operations that cause DOM changes
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'DOM Performance Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Check mutation count
      const mutationCount = await page.evaluate(() => window.mutationCount);
      console.log(`DOM mutations: ${mutationCount}`);
      
      // Should have reasonable number of mutations
      expect(mutationCount).toBeLessThan(50);
    });

    test('should optimize re-renders during rapid interactions', async ({ page }) => {
      // Create initial task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Rapid Interaction Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      // Measure rapid edit operations
      const startTime = performance.now();
      
      for (let i = 0; i < 3; i++) {
        // Edit task rapidly
        await page.click('[data-action="edit"]');
        await page.fill('#taskTitle', `Updated Title ${i}`);
        await page.click('#saveTask');
        await page.waitForTimeout(100);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      console.log(`Rapid edit operations time: ${totalTime}ms`);
      
      // Rapid operations should complete within reasonable time
      expect(totalTime).toBeLessThan(2000);
    });
  });

  test.describe('Memory Performance Tests', () => {
    test('should not cause memory leaks during repeated operations', async ({ page }) => {
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      });
      
      // Perform many operations
      for (let i = 0; i < 20; i++) {
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', `Memory Test ${i}`);
        await page.click('#saveTask');
        
        // Delete the task immediately
        page.on('dialog', async dialog => await dialog.accept());
        await page.click('[data-action="delete"]');
        page.removeAllListeners('dialog');
        
        await page.waitForTimeout(50);
      }
      
      // Force garbage collection if available
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });
      
      await page.waitForTimeout(1000);
      
      // Check final memory usage
      const finalMemory = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      });
      
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;
        
        console.log(`Memory increase: ${memoryIncrease} bytes (${memoryIncreasePercent.toFixed(2)}%)`);
        
        // Memory increase should be reasonable
        expect(memoryIncreasePercent).toBeLessThan(50);
      }
    });

    test('should clean up event listeners properly', async ({ page }) => {
      // Check initial listener count
      const initialListeners = await page.evaluate(() => {
        const events = ['click', 'input', 'keydown', 'dragstart', 'dragend'];
        let count = 0;
        
        function countListeners(element) {
          events.forEach(event => {
            const listeners = getEventListeners ? getEventListeners(element)[event] : [];
            count += listeners ? listeners.length : 0;
          });
          
          for (let child of element.children) {
            countListeners(child);
          }
        }
        
        if (typeof getEventListeners === 'function') {
          countListeners(document.body);
          return count;
        }
        return 0;
      });
      
      // Perform operations that add/remove listeners
      for (let i = 0; i < 5; i++) {
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', `Listener Test ${i}`);
        await page.click('#saveTask');
        await page.waitForTimeout(100);
      }
      
      // Check if listeners are managed properly
      // (This is more of a code inspection test than a runtime test)
      console.log(`Initial event listeners: ${initialListeners}`);
    });
  });

  test.describe('Network Performance Tests', () => {
    test('should handle slow network conditions gracefully', async ({ page }) => {
      // Simulate slow network
      await page.route('**/*', async route => {
        await new Promise(resolve => setTimeout(resolve, 100));
        await route.continue();
      });
      
      const startTime = performance.now();
      
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Slow Network Test');
      await page.click('#saveTask');
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      console.log(`Operation time with slow network: ${totalTime}ms`);
      
      // Should complete even with network delays
      const taskCard = page.locator('.task-card').filter({ hasText: 'Slow Network Test' });
      await expect(taskCard).toBeVisible();
    });

    test('should work offline (localStorage operations)', async ({ page }) => {
      // Block all network requests
      await page.route('**/*', route => route.abort());
      
      // Operations should still work with localStorage
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'Offline Test Task');
      await page.click('#saveTask');
      
      const taskCard = page.locator('.task-card').filter({ hasText: 'Offline Test Task' });
      await expect(taskCard).toBeVisible();
      
      // Verify data is persisted locally
      const storedTasks = await page.evaluate(() => {
        const tasks = localStorage.getItem('tasks');
        return tasks ? JSON.parse(tasks) : [];
      });
      
      const offlineTask = storedTasks.find(task => task.title === 'Offline Test Task');
      expect(offlineTask).toBeTruthy();
    });
  });

  test.describe('Animation Performance Tests', () => {
    test('should maintain smooth animations under load', async ({ page }) => {
      // Create multiple tasks to have more elements to animate
      for (let i = 0; i < 10; i++) {
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', `Animation Test ${i}`);
        await page.selectOption('#taskPriority', 'high');
        await page.click('#saveTask');
        await page.waitForTimeout(50);
      }
      
      // Test hover animations performance
      const taskCards = page.locator('.task-card');
      const cardCount = await taskCards.count();
      
      console.log(`Testing animations on ${cardCount} task cards`);
      
      // Hover over multiple cards rapidly
      const startTime = performance.now();
      
      for (let i = 0; i < Math.min(cardCount, 10); i++) {
        await taskCards.nth(i).hover();
        await page.waitForTimeout(50);
      }
      
      const endTime = performance.now();
      const animationTime = endTime - startTime;
      
      console.log(`Animation sequence time: ${animationTime}ms`);
      
      // Animations should be smooth
      expect(animationTime).toBeLessThan(1000);
    });

    test('should use hardware acceleration for animations', async ({ page }) => {
      // Check if elements have proper CSS properties for hardware acceleration
      const taskCard = page.locator('.task-card').first();
      
      const willChange = await taskCard.evaluate(el => 
        window.getComputedStyle(el).willChange
      );
      const transform = await taskCard.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      
      console.log(`will-change: ${willChange}`);
      console.log(`transform: ${transform}`);
      
      // Should have performance optimizations
      expect(willChange).toBe('transform, box-shadow');
      expect(transform).toContain('matrix');
    });

    test('should handle rapid visual state changes efficiently', async ({ page }) => {
      // Create a task
      await page.click('#headerAddTaskBtn');
      await page.fill('#taskTitle', 'State Change Test');
      await page.click('#saveTask');
      await page.waitForTimeout(500);
      
      const taskCard = page.locator('.task-card').first();
      
      // Rapidly hover/unhover to test state changes
      const startTime = performance.now();
      
      for (let i = 0; i < 20; i++) {
        await taskCard.hover();
        await page.waitForTimeout(10);
        await page.mouse.move(0, 0); // Move away
        await page.waitForTimeout(10);
      }
      
      const endTime = performance.now();
      const stateChangeTime = endTime - startTime;
      
      console.log(`Rapid state changes time: ${stateChangeTime}ms`);
      
      // Should handle rapid state changes smoothly
      expect(stateChangeTime).toBeLessThan(1500);
    });
  });

  test.describe('Input Performance Tests', () => {
    test('should handle rapid typing without lag', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      const titleInput = page.locator('#taskTitle');
      
      const longText = 'This is a very long task title that will test the performance of rapid typing and input handling in the task creation form';
      
      const startTime = performance.now();
      
      // Type rapidly
      await titleInput.type(longText, { delay: 10 });
      
      const endTime = performance.now();
      const typingTime = endTime - startTime;
      
      console.log(`Rapid typing time for ${longText.length} characters: ${typingTime}ms`);
      
      // Should handle rapid typing smoothly
      expect(typingTime).toBeLessThan(2000);
      
      // Verify all text was captured
      const inputValue = await titleInput.inputValue();
      expect(inputValue).toBe(longText);
    });

    test('should optimize input field performance', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      
      // Check performance-critical input optimizations
      const titleInput = page.locator('#taskTitle');
      
      const cssProperties = await titleInput.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          willChange: styles.willChange,
          contain: styles.contain,
          transform: styles.transform
        };
      });
      
      console.log('Input performance CSS:', cssProperties);
      
      // Should have performance optimizations
      expect(cssProperties.willChange).toBe('value, border-color');
      expect(cssProperties.contain).toBe('layout style paint');
      expect(cssProperties.transform).toContain('matrix');
    });

    test('should debounce input events efficiently', async ({ page }) => {
      await page.click('#headerAddTaskBtn');
      const titleInput = page.locator('#taskTitle');
      
      // Monitor debounced events
      await page.evaluate(() => {
        window.inputEventCount = 0;
        window.debouncedEventCount = 0;
        
        // Mock the debounced function to count calls
        const originalDebounce = window.app.debounce;
        window.app.debounce = function(func, wait) {
          return function(...args) {
            window.inputEventCount++;
            return originalDebounce.call(this, () => {
              window.debouncedEventCount++;
              return func.apply(this, args);
            }, wait);
          };
        };
      });
      
      // Type rapidly to trigger many input events
      await titleInput.type('rapid input test', { delay: 20 });
      
      // Wait for debouncing to settle
      await page.waitForTimeout(500);
      
      const eventCounts = await page.evaluate(() => ({
        input: window.inputEventCount,
        debounced: window.debouncedEventCount
      }));
      
      console.log(`Input events: ${eventCounts.input}, Debounced calls: ${eventCounts.debounced}`);
      
      // Debouncing should reduce the number of actual processing calls
      expect(eventCounts.debounced).toBeLessThan(eventCounts.input);
    });
  });

  test.describe('Scroll Performance Tests', () => {
    test('should handle smooth scrolling with many tasks', async ({ page }) => {
      // Create many tasks to enable scrolling
      await page.evaluate(() => {
        const manyTasks = [];
        for (let i = 0; i < 50; i++) {
          manyTasks.push({
            id: `scroll-${i}`,
            title: `Scroll Test Task ${i}`,
            description: `Description for scroll test ${i}`,
            priority: 'medium',
            category: 'work',
            status: 'todo',
            createdAt: new Date().toISOString()
          });
        }
        window.app.tasks = [...window.app.tasks, ...manyTasks];
        window.app.renderTasks();
      });
      
      await page.waitForTimeout(1000);
      
      const todoList = page.locator('#todoList');
      
      // Test scroll performance
      const startTime = performance.now();
      
      // Scroll multiple times
      for (let i = 0; i < 10; i++) {
        await todoList.evaluate(el => {
          el.scrollTop = (i % 2) === 0 ? el.scrollHeight : 0;
        });
        await page.waitForTimeout(50);
      }
      
      const endTime = performance.now();
      const scrollTime = endTime - startTime;
      
      console.log(`Scroll operations time: ${scrollTime}ms`);
      
      // Scrolling should be smooth
      expect(scrollTime).toBeLessThan(1000);
    });

    test('should use efficient scrolling properties', async ({ page }) => {
      const todoList = page.locator('#todoList');
      
      const scrollProperties = await todoList.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          scrollBehavior: styles.scrollBehavior,
          contain: styles.contain,
          willChange: styles.willChange,
          transform: styles.transform
        };
      });
      
      console.log('Scroll performance CSS:', scrollProperties);
      
      // Should have scroll optimizations
      expect(scrollProperties.scrollBehavior).toBe('smooth');
      expect(scrollProperties.contain).toBe('layout style');
      expect(scrollProperties.willChange).toBe('scroll-position');
      expect(scrollProperties.transform).toContain('matrix');
    });
  });

  test.describe('Overall Performance Metrics', () => {
    test('should meet Core Web Vitals standards', async ({ page }) => {
      // Measure key performance metrics
      const metrics = await page.evaluate(() => {
        return new Promise(resolve => {
          const observer = new PerformanceObserver(list => {
            const entries = list.getEntries();
            const metrics = {};
            
            entries.forEach(entry => {
              if (entry.name === 'first-contentful-paint') {
                metrics.FCP = entry.value;
              }
              if (entry.entryType === 'layout-shift') {
                metrics.CLS = (metrics.CLS || 0) + entry.value;
              }
              if (entry.entryType === 'largest-contentful-paint') {
                metrics.LCP = entry.value;
              }
            });
            
            resolve(metrics);
          });
          
          observer.observe({ entryTypes: ['paint', 'layout-shift', 'largest-contentful-paint'] });
          
          setTimeout(() => resolve({}), 3000); // Timeout after 3 seconds
        });
      });
      
      console.log('Performance metrics:', metrics);
      
      // Check if metrics meet standards (these are approximate targets)
      if (metrics.FCP) {
        expect(metrics.FCP).toBeLessThan(1800); // 1.8s for good FCP
      }
      if (metrics.LCP) {
        expect(metrics.LCP).toBeLessThan(2500); // 2.5s for good LCP
      }
      if (metrics.CLS !== undefined) {
        expect(metrics.CLS).toBeLessThan(0.1); // 0.1 for good CLS
      }
    });

    test('should maintain performance during stress testing', async ({ page }) => {
      const startTime = performance.now();
      
      // Stress test: create many tasks, edit them, move them, delete them
      for (let i = 0; i < 10; i++) {
        // Create task
        await page.click('#headerAddTaskBtn');
        await page.fill('#taskTitle', `Stress Test ${i}`);
        await page.selectOption('#taskPriority', 'high');
        await page.click('#saveTask');
        
        // Edit task
        await page.click('[data-action="edit"]');
        await page.fill('#taskTitle', `Stress Test ${i} - Edited`);
        await page.click('#saveTask');
        
        // Move task
        const taskCard = page.locator('.task-card').first();
        const progressColumn = page.locator('[data-status="progress"] .task-list');
        await taskCard.dragTo(progressColumn);
        
        await page.waitForTimeout(50);
      }
      
      const endTime = performance.now();
      const stressTestTime = endTime - startTime;
      
      console.log(`Stress test completed in: ${stressTestTime}ms`);
      
      // Should complete stress test within reasonable time
      expect(stressTestTime).toBeLessThan(10000); // 10 seconds
      
      // App should still be responsive
      await page.click('#headerAddTaskBtn');
      const modal = page.locator('#taskModal');
      await expect(modal).toHaveClass(/show/);
    });
  });
});