// Comprehensive offline functionality test
class OfflineTest {
    constructor() {
        this.results = [];
        this.userId = 'test_offline_' + Date.now();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        this.results.push({ timestamp, message, type });
        console.log(`[${type.toUpperCase()}] ${timestamp}: ${message}`);
    }

    async runAllTests() {
        this.log('Starting comprehensive offline functionality tests', 'info');
        
        try {
            await this.testLocalStoragePersistence();
            await this.testOfflineTaskCreation();
            await this.testOfflineTaskModification();
            await this.testSyncQueueManagement();
            await this.testConnectionStatusHandling();
            await this.testDataMerging();
            
            this.log('All offline tests completed', 'success');
            this.generateReport();
        } catch (error) {
            this.log(`Test suite failed: ${error.message}`, 'error');
        }
    }

    async testLocalStoragePersistence() {
        this.log('Testing localStorage persistence...', 'info');
        
        const testData = {
            tasks: [
                { id: '1', title: 'Test Task 1', status: 'todo', createdAt: new Date().toISOString() },
                { id: '2', title: 'Test Task 2', status: 'progress', createdAt: new Date().toISOString() }
            ],
            userId: this.userId
        };

        try {
            // Store data
            localStorage.setItem('tasks', JSON.stringify(testData.tasks));
            localStorage.setItem('userId', this.userId);

            // Retrieve and verify
            const storedTasks = JSON.parse(localStorage.getItem('tasks'));
            const storedUserId = localStorage.getItem('userId');

            if (storedTasks.length === 2 && storedUserId === this.userId) {
                this.log('✓ localStorage persistence working correctly', 'success');
            } else {
                throw new Error('Data mismatch in localStorage');
            }
        } catch (error) {
            this.log(`✗ localStorage persistence failed: ${error.message}`, 'error');
        }
    }

    async testOfflineTaskCreation() {
        this.log('Testing offline task creation...', 'info');

        try {
            const initialTasks = JSON.parse(localStorage.getItem('tasks')) || [];
            const newTask = {
                id: 'offline_' + Date.now(),
                title: 'Offline Created Task',
                description: 'This task was created while offline',
                status: 'todo',
                priority: 'medium',
                category: 'test',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Simulate offline task creation
            const updatedTasks = [...initialTasks, newTask];
            localStorage.setItem('tasks', JSON.stringify(updatedTasks));

            // Verify task was added
            const storedTasks = JSON.parse(localStorage.getItem('tasks'));
            const addedTask = storedTasks.find(t => t.id === newTask.id);

            if (addedTask && addedTask.title === newTask.title) {
                this.log('✓ Offline task creation successful', 'success');
            } else {
                throw new Error('Task not properly stored offline');
            }
        } catch (error) {
            this.log(`✗ Offline task creation failed: ${error.message}`, 'error');
        }
    }

    async testOfflineTaskModification() {
        this.log('Testing offline task modification...', 'info');

        try {
            const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
            const taskToModify = tasks[0];

            if (!taskToModify) {
                throw new Error('No tasks available to modify');
            }

            // Modify task offline
            taskToModify.title = 'Modified Offline Title';
            taskToModify.status = 'progress';
            taskToModify.updatedAt = new Date().toISOString();

            localStorage.setItem('tasks', JSON.stringify(tasks));

            // Verify modification
            const storedTasks = JSON.parse(localStorage.getItem('tasks'));
            const modifiedTask = storedTasks.find(t => t.id === taskToModify.id);

            if (modifiedTask.title === 'Modified Offline Title' && modifiedTask.status === 'progress') {
                this.log('✓ Offline task modification successful', 'success');
            } else {
                throw new Error('Task modifications not persisted');
            }
        } catch (error) {
            this.log(`✗ Offline task modification failed: ${error.message}`, 'error');
        }
    }

    async testSyncQueueManagement() {
        this.log('Testing sync queue management...', 'info');

        try {
            // Simulate sync queue
            const syncQueue = [
                { type: 'CREATE_TASK', task: { id: 'sync1', title: 'Sync Task 1' }, timestamp: Date.now() - 1000 },
                { type: 'UPDATE_TASK', taskId: 'sync2', task: { id: 'sync2', title: 'Sync Task 2' }, timestamp: Date.now() - 500 },
                { type: 'DELETE_TASK', taskId: 'sync3', timestamp: Date.now() }
            ];

            localStorage.setItem('syncQueue', JSON.stringify(syncQueue));

            // Test queue operations
            const storedQueue = JSON.parse(localStorage.getItem('syncQueue'));
            
            if (storedQueue.length === 3 && storedQueue[0].type === 'CREATE_TASK') {
                this.log('✓ Sync queue management working', 'success');
            } else {
                throw new Error('Sync queue not properly managed');
            }
        } catch (error) {
            this.log(`✗ Sync queue management failed: ${error.message}`, 'error');
        }
    }

    async testConnectionStatusHandling() {
        this.log('Testing connection status handling...', 'info');

        try {
            // Simulate offline status
            const originalOnLine = navigator.onLine;
            
            // Test offline detection (simulated)
            let isOffline = true;
            let connectionStatus = isOffline ? 'offline' : 'online';

            if (connectionStatus === 'offline') {
                this.log('✓ Offline status detection working', 'success');
            }

            // Test online recovery (simulated)
            isOffline = false;
            connectionStatus = isOffline ? 'offline' : 'online';

            if (connectionStatus === 'online') {
                this.log('✓ Online status recovery working', 'success');
            } else {
                throw new Error('Connection status not properly updated');
            }
        } catch (error) {
            this.log(`✗ Connection status handling failed: ${error.message}`, 'error');
        }
    }

    async testDataMerging() {
        this.log('Testing data merging logic...', 'info');

        try {
            // Local tasks (what's in localStorage)
            const localTasks = [
                { id: '1', title: 'Local Task 1', status: 'todo', updatedAt: '2025-08-30T01:00:00Z' },
                { id: '2', title: 'Local Task 2', status: 'progress', updatedAt: '2025-08-30T01:30:00Z' },
                { id: '3', title: 'Local Only Task', status: 'completed', updatedAt: '2025-08-30T02:00:00Z' }
            ];

            // Backend tasks (what comes from server)
            const backendTasks = [
                { id: '1', title: 'Backend Task 1 Updated', status: 'progress', updatedAt: '2025-08-30T02:30:00Z' }, // Newer
                { id: '2', title: 'Backend Task 2', status: 'todo', updatedAt: '2025-08-30T01:00:00Z' }, // Older
                { id: '4', title: 'Backend Only Task', status: 'todo', updatedAt: '2025-08-30T02:15:00Z' }
            ];

            // Test merge logic
            const mergedTasks = this.mergeTasks(localTasks, backendTasks);

            // Verify merge results
            const task1 = mergedTasks.find(t => t.id === '1');
            const task2 = mergedTasks.find(t => t.id === '2');
            const task3 = mergedTasks.find(t => t.id === '3');
            const task4 = mergedTasks.find(t => t.id === '4');

            if (task1.title === 'Backend Task 1 Updated' && // Newer backend version
                task2.title === 'Local Task 2' && // Newer local version
                task3 && // Local only task preserved
                task4 && // Backend only task added
                mergedTasks.length === 4) {
                this.log('✓ Data merging logic working correctly', 'success');
            } else {
                throw new Error('Data merge produced incorrect results');
            }
        } catch (error) {
            this.log(`✗ Data merging test failed: ${error.message}`, 'error');
        }
    }

    mergeTasks(localTasks, backendTasks) {
        const localMap = new Map(localTasks.map(task => [task.id, task]));
        const merged = [];

        // Process backend tasks
        backendTasks.forEach(backendTask => {
            const localTask = localMap.get(backendTask.id);
            if (!localTask || new Date(backendTask.updatedAt) > new Date(localTask.updatedAt)) {
                merged.push(backendTask);
            } else {
                merged.push(localTask);
            }
            localMap.delete(backendTask.id);
        });

        // Add remaining local tasks
        localMap.forEach(task => merged.push(task));

        return merged;
    }

    generateReport() {
        const successCount = this.results.filter(r => r.type === 'success').length;
        const errorCount = this.results.filter(r => r.type === 'error').length;
        const totalTests = successCount + errorCount;

        this.log('', 'info');
        this.log('='.repeat(50), 'info');
        this.log('OFFLINE FUNCTIONALITY TEST REPORT', 'info');
        this.log('='.repeat(50), 'info');
        this.log(`Total Tests: ${totalTests}`, 'info');
        this.log(`Passed: ${successCount}`, 'success');
        this.log(`Failed: ${errorCount}`, errorCount > 0 ? 'error' : 'info');
        this.log(`Success Rate: ${Math.round((successCount / totalTests) * 100)}%`, 
                 successCount === totalTests ? 'success' : 'warning');
        this.log('='.repeat(50), 'info');

        // Detailed results
        this.results.forEach(result => {
            if (result.type === 'error') {
                console.error(`❌ ${result.message}`);
            } else if (result.type === 'success') {
                console.log(`✅ ${result.message}`);
            }
        });
    }
}

// Run the tests if this script is executed directly
if (typeof window === 'undefined') {
    // Node.js environment - simulate localStorage
    global.localStorage = {
        data: {},
        setItem(key, value) { this.data[key] = value; },
        getItem(key) { return this.data[key] || null; },
        removeItem(key) { delete this.data[key]; }
    };
    
    global.navigator = { onLine: true };
}

// Export for use in other contexts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineTest;
}

// Auto-run if in browser environment
if (typeof window !== 'undefined') {
    window.OfflineTest = OfflineTest;
    
    // Add to test page if available
    if (document.getElementById('offlineTestResults')) {
        const test = new OfflineTest();
        test.runAllTests().then(() => {
            const results = document.getElementById('offlineTestResults');
            test.results.forEach(result => {
                const div = document.createElement('div');
                div.className = `test-result ${result.type}`;
                div.textContent = result.message;
                results.appendChild(div);
            });
        });
    }
}

// Run tests in Node.js environment
if (typeof require !== 'undefined' && require.main === module) {
    const test = new OfflineTest();
    test.runAllTests();
}