// TaskFlow - Modern Task Manager (Performance Optimized)



class TaskFlowApp {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        this.currentTaskId = null;
        this.currentPage = 'tasks'; // Track current page
        this.currentCategory = null; // Track current category filter
        this.debounceTimers = new Map();
        this.domCache = new Map();
        this.inputListeners = new Map();
        this.renderQueue = new Set();
        this.isRendering = false;
        this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
        this.authToken = localStorage.getItem('authToken') || null;
        
        // Enhanced performance caches
        this.styleCache = new Map();
        this.validationCache = new Map();
        this.fragmentCache = new Map();
        this.renderScheduler = null;
        this.calendarListenersSetup = false;
        this.searchListenersSetup = false;
        
        // Initialize MessageChannel for better task scheduling
        if (window.MessageChannel) {
            this.messageChannel = new MessageChannel();
            this.messageChannel.port2.addEventListener('message', () => {
                this.flushInputQueue();
            });
            this.messageChannel.port2.start();
        }
    }

    async init() {
        this.cacheDOM();
        this.setupNavigation(); // New navigation setup
        this.setupEventListeners();
        this.setupAuthEventListeners();
        this.updateAuthUI();
        
        // Load calendar events for dashboard
        await this.loadUpcomingEvents();
        
        // Set up periodic refresh for calendar events
        this.setupCalendarRefresh();
        
        // Initialize with current page
        this.navigateToPage(this.currentPage);
    }

    // Cache DOM elements to reduce queries
    cacheDOM() {
        const elements = [
            'addTaskBtn', 'headerAddTaskBtn', 'closeModal', 'cancelTask', 
            'taskForm', 'taskModal', 'todoList', 'progressList', 'completedList',
            'todoCount', 'progressCount', 'completedCount', 'totalTasks', 
            'todoTasks', 'progressTasks', 'completedTasks',
            // Cache form elements to avoid repeated DOM queries
            'taskTitle', 'taskDescription', 'taskPriority', 'taskCategory',
            'taskDueDate', 'taskDueTime', 'taskFiles', 'filePreview', 'modalTitle',
            // Cache additional button elements
            'prevMonth', 'nextMonth', 'todayBtn', 'searchBtn', 'clearFilters',
            'saveTask', 'submitLogin', 'submitRegister', 'loginBtn', 'profileBtn', 'logoutBtn',
            'closeLoginModal', 'closeRegisterModal', 'closeProfileModal',
            'showRegisterModal', 'showLoginModal'
        ];
        
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) this.domCache.set(id, element);
        });
    }

    // Enhanced debounce function with intelligent timing
    debounce(func, wait, options = {}) {
        const { leading = false, trailing = true, maxWait } = options;
        let lastCallTime, lastInvokeTime = 0;
        let timerId, maxTimerId;
        
        return (...args) => {
            const now = Date.now();
            const isInvoking = lastCallTime === undefined;
            
            lastCallTime = now;
            
            const shouldInvoke = () => {
                if (isInvoking && leading) return true;
                if (maxWait && (now - lastInvokeTime) >= maxWait) return true;
                return false;
            };
            
            const invokeFunc = () => {
                lastInvokeTime = now;
                return func.apply(this, args);
            };
            
            // Clear existing timers
            if (timerId) clearTimeout(timerId);
            if (maxTimerId) clearTimeout(maxTimerId);
            
            if (shouldInvoke()) {
                return invokeFunc();
            }
            
            // Set up trailing invocation
            if (trailing) {
                timerId = setTimeout(() => {
                    lastCallTime = undefined;
                    invokeFunc();
                }, wait);
            }
            
            // Set up max wait invocation
            if (maxWait && !maxTimerId) {
                maxTimerId = setTimeout(() => {
                    if (lastCallTime !== undefined) {
                        invokeFunc();
                    }
                }, maxWait);
            }
        };
    }

    setupEventListeners() {
        // Add task buttons with keyboard support
        const addTaskHandler = () => this.showTaskModal();
        this.domCache.get('addTaskBtn')?.addEventListener('click', addTaskHandler);
        this.domCache.get('headerAddTaskBtn')?.addEventListener('click', addTaskHandler);
        
        // Add keyboard support for Add Task buttons
        this.domCache.get('addTaskBtn')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.showTaskModal();
            }
        });
        this.domCache.get('headerAddTaskBtn')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.showTaskModal();
            }
        });
        
        // Modal events with keyboard support
        this.domCache.get('closeModal')?.addEventListener('click', () => this.hideTaskModal());
        this.domCache.get('cancelTask')?.addEventListener('click', () => this.hideTaskModal());
        this.domCache.get('taskForm')?.addEventListener('submit', (e) => this.handleTaskSubmit(e));
        
        // Add keyboard support for modal close buttons
        this.domCache.get('closeModal')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.hideTaskModal();
            }
        });
        this.domCache.get('cancelTask')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.hideTaskModal();
            }
        });
        
        // Setup optimized input listeners for performance-critical fields
        this.setupOptimizedInputs();
        
        // Close modal when clicking outside - use passive listener
        this.domCache.get('taskModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'taskModal') {
                this.hideTaskModal();
            }
        }, { passive: true });

        // File upload handling
        const fileInput = this.domCache.get('taskFiles');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        }
    }

    setupOptimizedInputs() {
        // Performance-critical input fields with enhanced optimization
        const criticalInputs = ['taskTitle', 'taskDescription'];
        
        criticalInputs.forEach(inputId => {
            const input = this.domCache.get(inputId);
            if (!input) return;
            
            // Remove any existing listeners to prevent memory leaks
            if (this.inputListeners.has(inputId)) {
                const { handler } = this.inputListeners.get(inputId);
                input.removeEventListener('input', handler);
            }
            
            // Enhanced debounced handler with intelligent scheduling
            const debouncedHandler = this.debounce((e) => {
                // Use scheduler.postTask for better performance if available
                if ('scheduler' in window && 'postTask' in window.scheduler) {
                    window.scheduler.postTask(() => {
                        this.handleOptimizedInput(inputId, e.target.value);
                    }, { priority: 'user-blocking' });
                } else {
                    // Fallback to optimized RAF scheduling
                    this.scheduleInputUpdate(inputId, e.target.value);
                }
            }, 50); // Increased to 50ms for better debouncing
            
            // Use passive listener for better performance
            input.addEventListener('input', debouncedHandler, { passive: true });
            
            // Store reference for cleanup
            this.inputListeners.set(inputId, { handler: debouncedHandler });
            
            // Enhanced focus optimization
            input.addEventListener('focus', () => {
                this.prewarmInputCache(inputId);
                // Pre-calculate validation rules
                this.preCalculateValidation(inputId);
            }, { passive: true, once: false });
        });
    }

    scheduleInputUpdate(inputId, value) {
        // Use time slicing to prevent blocking
        requestIdleCallback((deadline) => {
            if (deadline.timeRemaining() > 0) {
                this.handleOptimizedInput(inputId, value);
            } else {
                // Defer to next idle period if no time available
                setTimeout(() => this.scheduleInputUpdate(inputId, value), 0);
            }
        }, { timeout: 100 });
    }

    handleOptimizedInput(inputId, value) {
        // Micro-batch validation and UI updates with priority scheduling
        const updateKey = 'input-' + inputId;
        
        if (!this.renderQueue.has(updateKey)) {
            this.renderQueue.add(updateKey);
            
            // Use scheduler.postTask for priority-based scheduling
            if ('scheduler' in window && 'postTask' in window.scheduler) {
                window.scheduler.postTask(() => {
                    this.flushInputQueue();
                }, { priority: 'user-visible' });
            } else {
                // Fallback with optimized timing
                if (!this.isRendering) {
                    this.isRendering = true;
                    // Use MessageChannel for better task scheduling
                    if (this.messageChannel) {
                        this.messageChannel.port1.postMessage(null);
                    } else {
                        requestAnimationFrame(() => this.flushInputQueue());
                    }
                }
            }
        }
    }

    prewarmInputCache(inputId) {
        // Enhanced pre-computation for smoother interactions
        const input = this.domCache.get(inputId);
        if (input) {
            // Batch style calculations to prevent layout thrashing
            requestAnimationFrame(() => {
                // Force style calculations in a single frame
                const computed = window.getComputedStyle(input);
                const dimensions = {
                    width: input.offsetWidth,
                    height: input.offsetHeight,
                    borderWidth: computed.borderWidth,
                    padding: computed.padding
                };
                
                // Cache computed styles for faster access
                this.styleCache.set(inputId, dimensions);
            });
        }
    }
    
    preCalculateValidation(inputId) {
        // Pre-calculate validation rules to avoid runtime computation
        const validationRules = {
            taskTitle: {
                maxLength: 100,
                minLength: 1,
                pattern: /^[\s\S]{1,100}$/
            },
            taskDescription: {
                maxLength: 500,
                minLength: 0,
                pattern: /^[\s\S]{0,500}$/
            }
        };
        
        this.validationCache.set(inputId, validationRules[inputId] || {});
    }

    flushInputQueue() {
        // Enhanced batched processing with time slicing
        const startTime = performance.now();
        const timeSliceLimit = 5; // 5ms time slice
        
        const queueArray = Array.from(this.renderQueue);
        let processed = 0;
        
        const processChunk = () => {
            while (processed < queueArray.length && (performance.now() - startTime) < timeSliceLimit) {
                const item = queueArray[processed];
                if (item.startsWith('input-')) {
                    const inputId = item.replace('input-', '');
                    this.processInputUpdate(inputId);
                }
                processed++;
            }
            
            if (processed < queueArray.length) {
                // Continue processing in next frame if more items remain
                requestAnimationFrame(processChunk);
            } else {
                // All items processed
                this.renderQueue.clear();
                this.isRendering = false;
            }
        };
        
        processChunk();
    }

    processInputUpdate(inputId) {
        // Enhanced validation with cached rules and minimal DOM manipulation
        const input = this.domCache.get(inputId);
        const validationRule = this.validationCache.get(inputId);
        
        if (!input || !validationRule) return;
        
        // Use cached validation rules for faster processing
        const value = input.value;
        const isValid = this.validateInputValue(value, validationRule);
        
        // Batch style updates to minimize layout thrashing
        requestAnimationFrame(() => {
            this.updateInputStyles(input, isValid, inputId);
        });
    }
    
    validateInputValue(value, rule) {
        // Optimized validation with pre-computed rules
        if (rule.maxLength && value.length > rule.maxLength) return false;
        if (rule.minLength && value.length < rule.minLength) return false;
        if (rule.pattern && !rule.pattern.test(value)) return false;
        return true;
    }
    
    updateInputStyles(input, isValid, inputId) {
        // Efficient style updates with caching
        const currentBorderColor = input.style.borderColor;
        const newBorderColor = isValid ? '' : 'var(--warning)';
        
        // Only update if style actually changed
        if (currentBorderColor !== newBorderColor) {
            input.style.borderColor = newBorderColor;
            
            // Cache the style change to prevent future unnecessary updates
            this.styleCache.set(inputId + '_borderColor', newBorderColor);
        }
    }

    setupDragAndDrop() {
        // Use event delegation for better performance
        document.addEventListener('dragstart', (e) => {
            const card = e.target.closest('.task-card');
            if (card) {
                card.classList.add('dragging');
                e.dataTransfer.setData('text/plain', card.dataset.taskId);
            }
        }, { passive: true });

        document.addEventListener('dragend', (e) => {
            const card = e.target.closest('.task-card');
            if (card) {
                card.classList.remove('dragging');
            }
        }, { passive: true });

        document.addEventListener('dragover', (e) => {
            const column = e.target.closest('.task-column');
            if (column) {
                e.preventDefault();
            }
        }, { passive: false });

        document.addEventListener('dragenter', (e) => {
            const column = e.target.closest('.task-column');
            if (column) {
                e.preventDefault();
                column.classList.add('drag-over');
            }
        }, { passive: false });

        document.addEventListener('dragleave', (e) => {
            const column = e.target.closest('.task-column');
            if (column && !column.contains(e.relatedTarget)) {
                column.classList.remove('drag-over');
            }
        }, { passive: true });

        document.addEventListener('drop', (e) => {
            const column = e.target.closest('.task-column');
            if (column) {
                e.preventDefault();
                const taskId = e.dataTransfer.getData('text/plain');
                const newStatus = column.dataset.status;
                
                this.updateTaskStatus(taskId, newStatus);
                column.classList.remove('drag-over');
            }
        }, { passive: false });
    }

    showTaskModal(taskId = null) {
        const modal = this.domCache.get('taskModal');
        const modalTitle = this.domCache.get('modalTitle');
        const form = this.domCache.get('taskForm');
        
        this.currentTaskId = taskId;
        
        if (taskId) {
            // Edit mode
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                modalTitle.textContent = 'Edit Task';
                this.populateTaskForm(task);
            }
        } else {
            // Add mode
            modalTitle.textContent = 'Add New Task';
            form.reset();
            
            // Auto-populate date and time fields as expected by tests
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            
            const dueDateField = this.domCache.get('taskDueDate');
            const dueTimeField = this.domCache.get('taskDueTime');
            
            if (dueDateField) dueDateField.value = today;
            if (dueTimeField) dueTimeField.value = currentTime;
        }
        
        modal.classList.add('show');
        
        // Focus management for accessibility
        this.previouslyFocusedElement = document.activeElement;
        
        // Focus on first input after modal animation
        requestAnimationFrame(() => {
            const firstInput = this.domCache.get('taskTitle');
            if (firstInput) firstInput.focus();
        });
        
        // Trap focus within modal
        this.setupFocusTrap(modal);
    }

    hideTaskModal() {
        const modal = this.domCache.get('taskModal');
        modal.classList.remove('show');
        this.currentTaskId = null;
        
        // Clear file selections
        this.selectedFiles = [];
        const filePreview = this.domCache.get('filePreview');
        if (filePreview) filePreview.innerHTML = '';
        const fileInput = this.domCache.get('taskFiles');
        if (fileInput) fileInput.value = '';
        
        // Restore focus for accessibility
        if (this.previouslyFocusedElement) {
            this.previouslyFocusedElement.focus();
            this.previouslyFocusedElement = null;
        }
        
        // Remove focus trap
        this.removeFocusTrap();
    }

    setupFocusTrap(modal) {
        // Get all focusable elements within the modal
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        // Store the handler for cleanup
        this.focusTrapHandler = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstFocusable) {
                        e.preventDefault();
                        lastFocusable.focus();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastFocusable) {
                        e.preventDefault();
                        firstFocusable.focus();
                    }
                }
            }
            
            // Close modal on Escape
            if (e.key === 'Escape') {
                this.hideTaskModal();
            }
        };
        
        modal.addEventListener('keydown', this.focusTrapHandler);
    }

    removeFocusTrap() {
        const modal = this.domCache.get('taskModal');
        if (modal && this.focusTrapHandler) {
            modal.removeEventListener('keydown', this.focusTrapHandler);
            this.focusTrapHandler = null;
        }
    }

    populateTaskForm(task) {
        // Use cached DOM elements to avoid repeated queries
        const elements = {
            title: this.domCache.get('taskTitle'),
            description: this.domCache.get('taskDescription'),
            priority: this.domCache.get('taskPriority'),
            category: this.domCache.get('taskCategory'),
            dueDate: this.domCache.get('taskDueDate'),
            dueTime: this.domCache.get('taskDueTime')
        };
        
        // Temporarily disable input listeners during population to prevent re-renders
        this.disableInputOptimization();
        
        // Use DocumentFragment for efficient DOM manipulation
        const fragment = document.createDocumentFragment();
        
        // Batch all form updates in a single frame with proper scheduling
        requestAnimationFrame(() => {
            // Batch DOM writes to minimize layout thrashing
            Object.entries(elements).forEach(([key, element]) => {
                if (!element) return;
                
                let value = '';
                switch(key) {
                    case 'title': value = task.title; break;
                    case 'description': value = task.description || ''; break;
                    case 'priority': value = task.priority; break;
                    case 'category': value = task.category; break;
                    case 'dueDate': 
                        // Convert dueDateTime to date format
                        if (task.dueDateTime) {
                            value = task.dueDateTime.split('T')[0];
                        } else {
                            value = new Date().toISOString().split('T')[0];
                        }
                        break;
                    case 'dueTime':
                        // Convert dueDateTime to time format
                        if (task.dueDateTime) {
                            const time = new Date(task.dueDateTime);
                            value = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
                        } else {
                            const now = new Date();
                            value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        }
                        break;
                }
                
                // Set value only if different to prevent unnecessary re-renders
                if (element.value !== value) {
                    element.value = value;
                }
            });
            
            // Re-enable input optimization after population
            requestAnimationFrame(() => {
                this.enableInputOptimization();
            });
        });
    }

    disableInputOptimization() {
        // Temporarily remove input listeners during form population
        this.inputListeners.forEach(({ handler }, inputId) => {
            const input = this.domCache.get(inputId);
            if (input) {
                input.removeEventListener('input', handler);
            }
        });
    }

    enableInputOptimization() {
        // Re-add input listeners after form population
        this.inputListeners.forEach(({ handler }, inputId) => {
            const input = this.domCache.get(inputId);
            if (input) {
                input.addEventListener('input', handler, { passive: true });
            }
        });
    }

    async handleTaskSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        
        // Get values from FormData now that we have proper name attributes
        const title = formData.get('taskTitle');
        const description = formData.get('taskDescription');
        const priority = formData.get('taskPriority');
        const category = formData.get('taskCategory');
        const dueDate = formData.get('taskDueDate');
        const dueTime = formData.get('taskDueTime');
        
        // Combine date and time into a single DateTime
        const dueDateTime = dueDate && dueTime ? `${dueDate}T${dueTime}:00.000Z` : null;

        const taskData = {
            title: title,
            description: description,
            priority: priority,
            category: category,
            dueDateTime: dueDateTime,
            createdAt: new Date().toISOString(),
            status: 'todo'
        };

        try {
            if (this.currentTaskId) {
                // Update existing task
                await this.updateTask(this.currentTaskId, taskData);
            } else {
                // Create new task
                await this.createTask(taskData);
            }
            
            // Only hide modal after task is successfully created/updated
            this.hideTaskModal();
        } catch (error) {
            console.error('Task submission error:', error);
            // Don't hide modal if there was an error
        }
    }

    handleFileSelection(e) {
        const files = Array.from(e.target.files);
        this.selectedFiles = files;
        this.updateFilePreview(files);
    }

    updateFilePreview(files) {
        const preview = this.domCache.get('filePreview');
        if (!preview) return;

        preview.innerHTML = files.map((file, index) => `
            <div class="file-item">
                <i class="fas fa-file"></i>
                <span>${file.name}</span>
                <button type="button" class="file-remove" data-file-index="${index}" aria-label="Remove file">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        // Add event listeners for remove buttons
        preview.querySelectorAll('.file-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileIndex = parseInt(e.target.closest('.file-remove').dataset.fileIndex);
                this.removeFile(fileIndex);
            });
        });
    }

    removeFile(index) {
        if (this.selectedFiles) {
            this.selectedFiles.splice(index, 1);
            this.updateFilePreview(this.selectedFiles);
            
            // Update the file input
            const fileInput = this.domCache.get('taskFiles');
            if (fileInput && this.selectedFiles.length === 0) {
                fileInput.value = '';
            }
        }
    }

    async uploadFiles(files) {
        if (!files || files.length === 0) return [];

        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });

        if (this.currentUser) {
            formData.append('userId', this.currentUser.id);
        }

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
                headers: this.authToken ? {
                    'Authorization': 'Bearer ' + this.authToken
                } : {}
            });

            const data = await response.json();
            if (data.success) {
                return data.files;
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('File upload error:', error);
            this.showToast('Failed to upload files: ' + error.message, 'error');
            return [];
        }
    }

    async createTask(taskData) {
        try {
            // Upload files if any were selected
            let attachments = [];
            if (this.selectedFiles && this.selectedFiles.length > 0) {
                attachments = await this.uploadFiles(this.selectedFiles);
            }

            // Parse dueDateTime into separate fields for database
            let dueDate = null;
            let dueTime = null;
            if (taskData.dueDateTime) {
                const dueDateTime = new Date(taskData.dueDateTime);
                dueDate = dueDateTime.toISOString().split('T')[0];
                dueTime = dueDateTime.toTimeString().split(' ')[0].substring(0, 5);
            }

            const requestData = {
                userId: this.currentUser?.id || 'default',
                title: taskData.title,
                description: taskData.description,
                priority: taskData.priority,
                category: taskData.category,
                status: taskData.status || 'todo',
                dueDate: dueDate,
                dueTime: dueTime,
                dueDateTime: taskData.dueDateTime
            };

            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.authToken && { 'Authorization': 'Bearer ' + this.authToken })
                },
                body: JSON.stringify(requestData)
            });

            const data = await response.json();
            
            if (data.success) {
                // Convert database format back to frontend format
                const task = {
                    id: data.task.id,
                    title: data.task.title,
                    description: data.task.description,
                    priority: data.task.priority,
                    category: data.task.category,
                    status: data.task.status,
                    dueDateTime: data.task.due_datetime,
                    createdAt: data.task.created_at,
                    attachments: attachments
                };

                // Handle file attachments
                if (attachments.length > 0) {
                    for (const file of attachments) {
                        await this.addTaskAttachment(task.id, file.id);
                    }
                    task.attachments = attachments;
                }

                this.tasks.push(task);
                this.renderTasks();
                this.updateStats();
                this.showToast('Task created successfully!', 'success');
                
                // Clear selected files
                this.selectedFiles = [];
                return task;
            } else {
                throw new Error(data.error || 'Failed to create task');
            }
        } catch (error) {
            console.error('Create task error:', error);
            this.showToast('Failed to create task: ' + error.message, 'error');
            throw error;
        }
    }

    async updateTask(taskId, taskData) {
        try {
            // Parse dueDateTime into separate fields for database
            let dueDate = null;
            let dueTime = null;
            if (taskData.dueDateTime) {
                const dueDateTime = new Date(taskData.dueDateTime);
                dueDate = dueDateTime.toISOString().split('T')[0];
                dueTime = dueDateTime.toTimeString().split(' ')[0].substring(0, 5);
            }

            const requestData = {
                title: taskData.title,
                description: taskData.description,
                priority: taskData.priority,
                category: taskData.category,
                status: taskData.status,
                dueDate: dueDate,
                dueTime: dueTime,
                dueDateTime: taskData.dueDateTime
            };

            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.authToken && { 'Authorization': 'Bearer ' + this.authToken })
                },
                body: JSON.stringify(requestData)
            });

            const data = await response.json();
            
            if (data.success) {
                // Update local task
                const taskIndex = this.tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    this.tasks[taskIndex] = {
                        ...this.tasks[taskIndex],
                        title: data.task.title,
                        description: data.task.description,
                        priority: data.task.priority,
                        category: data.task.category,
                        status: data.task.status,
                        dueDateTime: data.task.due_datetime
                    };
                }
                
                this.renderTasks();
                this.updateStats();
                this.showToast('Task updated successfully!', 'success');
            } else {
                throw new Error(data.error || 'Failed to update task');
            }
        } catch (error) {
            console.error('Update task error:', error);
            this.showToast('Failed to update task: ' + error.message, 'error');
        }
    }

    async updateTaskStatus(taskId, newStatus) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.authToken && { 'Authorization': 'Bearer ' + this.authToken })
                },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await response.json();
            
            if (data.success) {
                const task = this.tasks.find(t => t.id === taskId);
                if (task) {
                    task.status = newStatus;
                    this.renderTasks();
                    this.updateStats();
                    this.showToast(`Task moved to ${newStatus}!`, 'success');
                }
            } else {
                throw new Error(data.error || 'Failed to update task status');
            }
        } catch (error) {
            console.error('Update task status error:', error);
            this.showToast('Failed to update task status: ' + error.message, 'error');
        }
    }

    async deleteTask(taskId) {
        // Delete immediately without confirmation
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                    ...(this.authToken && { 'Authorization': 'Bearer ' + this.authToken })
                }
            });

            const data = await response.json();
            
            if (data.success) {
                this.tasks = this.tasks.filter(t => t.id !== taskId);
                this.renderTasks();
                this.updateStats();
                this.showToast('Task deleted successfully!', 'success');
            } else {
                throw new Error(data.error || 'Failed to delete task');
            }
        } catch (error) {
            console.error('Delete task error:', error);
            this.showToast('Failed to delete task: ' + error.message, 'error');
        }
    }

    renderTasks() {
        // Prevent concurrent renders
        if (this.isRendering) {
            this.renderQueue.add('tasks');
            return;
        }
        
        this.isRendering = true;
        
        // Use optimized rendering with virtual scrolling for large lists
        this.renderTasksOptimized().finally(() => {
            this.isRendering = false;
            
            // Process any queued renders
            if (this.renderQueue.has('tasks')) {
                this.renderQueue.delete('tasks');
                requestAnimationFrame(() => this.renderTasks());
            }
        });
    }

    async renderTasksOptimized() {
        // Group tasks by status with caching
        const taskGroups = this.groupTasksByStatus();
        const fragments = await this.createTaskFragments(taskGroups);
        
        // Schedule DOM updates using RAF for smooth performance
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                this.updateTaskColumns(fragments, taskGroups);
                resolve();
            });
        });
    }

    groupTasksByStatus() {
        // Use Map for better performance with frequent lookups
        const groups = new Map([
            ['todo', []],
            ['progress', []],
            ['completed', []]
        ]);
        
        // Single pass through tasks for better performance
        this.tasks.forEach(task => {
            const group = groups.get(task.status);
            if (group) group.push(task);
        });
        
        return groups;
    }

    async createTaskFragments(taskGroups) {
        const fragments = new Map();
        const BATCH_SIZE = 10; // Process tasks in batches to avoid blocking
        
        for (const [status, tasks] of taskGroups.entries()) {
            const fragment = document.createDocumentFragment();
            
            // Process tasks in batches to maintain responsiveness
            for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
                const batch = tasks.slice(i, i + BATCH_SIZE);
                
                // Create batch of task cards
                const batchFragment = document.createDocumentFragment();
                batch.forEach(task => {
                    const card = this.createTaskCardOptimized(task);
                    if (card) batchFragment.appendChild(card);
                });
                
                fragment.appendChild(batchFragment);
                
                // Yield control to browser after each batch
                if (i + BATCH_SIZE < tasks.length) {
                    await this.yieldToMain();
                }
            }
            
            fragments.set(status, fragment);
        }
        
        return fragments;
    }

    yieldToMain() {
        return new Promise(resolve => {
            setTimeout(resolve, 0);
        });
    }

    updateTaskColumns(fragments, taskGroups) {
        const columns = {
            todo: this.domCache.get('todoList'),
            progress: this.domCache.get('progressList'),
            completed: this.domCache.get('completedList')
        };
        
        const counts = {
            todo: this.domCache.get('todoCount'),
            progress: this.domCache.get('progressCount'),
            completed: this.domCache.get('completedCount')
        };
        
        // Batch all DOM mutations
        Object.entries(columns).forEach(([status, column]) => {
            if (!column) return;
            
            // Clear column efficiently
            column.textContent = '';
            
            // Append new content
            const fragment = fragments.get(status);
            if (fragment) {
                column.appendChild(fragment);
            }
            
            // Update count
            const count = counts[status];
            const taskCount = taskGroups.get(status)?.length || 0;
            if (count) count.textContent = taskCount;
        });
    }

    createTaskCard(task) {
        return this.createTaskCardOptimized(task);
    }

    createTaskCardOptimized(task) {
        // Create card element with performance optimizations
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.taskId = task.id;
        card.setAttribute('draggable', true);
        card.setAttribute('role', 'listitem');
        card.setAttribute('aria-label', `Task: ${this.escapeHtml(task.title)}`);

        // Pre-compute values to avoid repeated calculations
        const priorityClass = `priority-${task.priority}`;
        
        // Cache frequently accessed values
        const escapedTitle = this.escapeHtml(task.title);
        const escapedDescription = task.description ? this.escapeHtml(task.description) : '';
        
        
        // Format due date and time
        const dueDateInfo = this.formatTaskDueDate(task.dueDateTime);
        
        // Format attachments
        const attachmentsHtml = task.attachments && task.attachments.length > 0 ? 
            `<div class="task-attachments">
                ${task.attachments.map(file => 
                    `<div class="attachment-item" onclick="window.open('${file.url}', '_blank')" title="${file.originalname}">
                        <i class="fas fa-paperclip" aria-hidden="true"></i>
                        <span>${file.originalname}</span>
                    </div>`
                ).join('')}
            </div>` : '';

        // Optimized template with minimal string interpolation
        const cardHTML = [
            `<div class="task-priority ${priorityClass}" aria-label="Priority: ${task.priority}"></div>`,
            `<div class="task-title">${escapedTitle}</div>`,
            task.description ? `<div class="task-description">${escapedDescription}</div>` : '',
            '<div class="task-meta">',
            dueDateInfo ? `  <div class="task-date">${dueDateInfo}</div>` : '',
            '  <div class="task-tags">',
            `    <span class="task-tag">${task.category}</span>`,
            '  </div>',
            '</div>',
            attachmentsHtml,
            '<div class="task-actions" style="margin-top: 1rem; display: flex; gap: 0.5rem;">',
            `  <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" data-action="edit" data-task-id="${task.id}" aria-label="Edit task: ${escapedTitle}">`,
            '    <i class="fas fa-edit" aria-hidden="true"></i>',
            '  </button>',
            `  <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--error);" data-action="delete" data-task-id="${task.id}" aria-label="Delete task: ${escapedTitle}">`,
            '    <i class="fas fa-trash" aria-hidden="true"></i>',
            '  </button>',
            '</div>'
        ].join('');

        // Single innerHTML assignment for better performance
        card.innerHTML = cardHTML;

        // Use single event listener for better memory efficiency
        card.addEventListener('click', this.createTaskCardClickHandler(task.id), { passive: true });

        return card;
    }

    createTaskCardClickHandler(taskId) {
        // Create optimized click handler with proper closure
        return (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            
            e.stopPropagation();
            
            const action = button.dataset.action;
            
            // Use requestIdleCallback for non-critical actions
            if (window.requestIdleCallback) {
                window.requestIdleCallback(() => {
                    this.handleTaskAction(action, taskId);
                });
            } else {
                // Fallback for browsers without requestIdleCallback
                setTimeout(() => {
                    this.handleTaskAction(action, taskId);
                }, 0);
            }
        };
    }

    handleTaskAction(action, taskId) {
        switch (action) {
            case 'edit':
                this.editTask(taskId);
                break;
            case 'delete':
                this.deleteTask(taskId);
                break;
        }
    }

    editTask(taskId) {
        this.showTaskModal(taskId);
    }

    updateStats() {
        // Debounce stats updates to prevent excessive calculations
        this.debouncedUpdateStats();
    }

    debouncedUpdateStats = this.debounce(() => {
        const total = this.tasks.length;
        const todo = this.tasks.filter(t => t.status === 'todo').length;
        const progress = this.tasks.filter(t => t.status === 'progress').length;
        const completed = this.tasks.filter(t => t.status === 'completed').length;

        requestAnimationFrame(() => {
            this.domCache.get('totalTasks').textContent = total;
            this.domCache.get('todoTasks').textContent = todo;
            this.domCache.get('progressTasks').textContent = progress;
            this.domCache.get('completedTasks').textContent = completed;
        });
    }, 100);

    filterByCategory(category) {
        console.log('Filtering by category:', category);
        
        // Update current category
        this.currentCategory = category;
        
        // Update navigation active states
        this.updateNavigationActiveStates();
        
        // Apply filter to current view
        if (this.currentPage === 'tasks') {
            this.applyCategoryFilter(category);
        }
    }

    applyCategoryFilter(category) {
        // Get all task cards
        const taskCards = document.querySelectorAll('.task-card');
        
        taskCards.forEach(card => {
            const taskCategory = card.getAttribute('data-category');
            if (category === 'all' || taskCategory === category) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
        
        // Update stats
        this.updateStats();
    }

    // View management methods
    showTaskBoard() {
        // Hide other views
        this.hideAllViews();
        
        // Show the task manager section
        const taskBoard = document.getElementById('taskBoard');
        const statsGrid = document.querySelector('.stats-grid');
        
        if (taskBoard) taskBoard.style.display = 'grid';
        if (statsGrid) statsGrid.style.display = 'grid';
        
        // Refresh tasks and stats
        this.renderTasks();
        this.updateStats();
    }
    
    showCalendarView() {
        // Hide other views
        this.hideAllViews();
        
        // Show calendar view
        const calendarView = document.getElementById('calendarView');
        if (calendarView) {
            calendarView.style.display = 'block';
            // Initialize calendar if needed
            if (!this.calendarInitialized) {
                this.initializeCalendar();
                this.calendarInitialized = true;
            }
        }
    }
    
    
    showSearchView() {
        // Hide other views
        this.hideAllViews();
        
        // Show search view
        const searchView = document.getElementById('searchView');
        if (searchView) {
            searchView.style.display = 'block';
            // Initialize search if needed
            if (!this.searchInitialized) {
                this.initializeSearch();
                this.searchInitialized = true;
            }
        }
    }
    
    hideAllViews() {
        // Hide all main views
        const views = [
            'taskBoard',
            'calendarView', 
            'searchView'
        ];
        
        views.forEach(viewId => {
            const view = document.getElementById(viewId);
            if (view) view.style.display = 'none';
        });
        
        // Hide stats grid when not on task board
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) statsGrid.style.display = 'none';
    }

    // Initialize methods for different views
    initializeCalendar() {
        console.log('Initializing calendar view...');
        // Basic calendar initialization - can be expanded later
        const calendarGrid = document.getElementById('calendarGrid');
        if (calendarGrid) {
            calendarGrid.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Calendar view coming soon...</div>';
        }
    }
    
    
    initializeSearch() {
        console.log('Initializing search view...');
        // Basic search initialization - can be expanded later
        const searchResults = document.getElementById('searchResults');
        if (searchResults) {
            searchResults.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Search functionality coming soon...</div>';
        }
    }

    // Loading and error state methods
    showLoadingState(viewType) {
        const loadingOverlay = this.createLoadingOverlay(viewType);
        const targetView = this.getViewElement(viewType);
        
        if (targetView && loadingOverlay) {
            targetView.appendChild(loadingOverlay);
        }
    }

    hideLoadingState(viewType) {
        const targetView = this.getViewElement(viewType);
        if (targetView) {
            const loadingOverlay = targetView.querySelector('.loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.remove();
            }
        }
    }

    showErrorState(viewType, errorMessage) {
        this.hideLoadingState(viewType);
        const errorOverlay = this.createErrorOverlay(viewType, errorMessage);
        const targetView = this.getViewElement(viewType);
        
        if (targetView && errorOverlay) {
            targetView.appendChild(errorOverlay);
        }
    }

    hideErrorState(viewType) {
        const targetView = this.getViewElement(viewType);
        if (targetView) {
            const errorOverlay = targetView.querySelector('.error-overlay');
            if (errorOverlay) {
                errorOverlay.remove();
            }
        }
    }

    getViewElement(viewType) {
        const viewMap = {
            'calendar': document.getElementById('calendarView'),
            'search': document.getElementById('searchView'),
            'tasks': document.getElementById('taskBoard')
        };
        return viewMap[viewType];
    }

    createLoadingOverlay(viewType) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                </div>
                <div class="loading-text">Loading ${viewType} view...</div>
            </div>
        `;
        return overlay;
    }

    createErrorOverlay(viewType, errorMessage) {
        const overlay = document.createElement('div');
        overlay.className = 'error-overlay';
        overlay.innerHTML = `
            <div class="error-content">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="error-title">Oops! Something went wrong</div>
                <div class="error-message">${errorMessage}</div>
                <button class="btn btn-primary retry-btn" onclick="app.retryView('${viewType}')">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
        return overlay;
    }

    retryView(viewType) {
        this.hideErrorState(viewType);
        
        // Retry the view based on type
        switch (viewType) {
            case 'calendar':
                this.showCalendarView();
                break;
            case 'search':
                this.showSearchView();
                break;
            default:
                this.showTaskBoard();
        }
    }
    
    clearSearchFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('priorityFilter').value = '';
        document.getElementById('categoryFilter').value = '';
        document.getElementById('sortBy').value = 'relevance';
        this.performSearch();
    }
    
    hideCalendarView() {
        const calendarView = document.getElementById('calendarView');
        if (calendarView) calendarView.style.display = 'none';
    }
    
    
    hideSearchView() {
        const searchView = document.getElementById('searchView');
        if (searchView) searchView.style.display = 'none';
    }
    
    // Helper functions
    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }
    
    getTasksForDate(date) {
        return this.tasks.filter(task => {
            if (!task.dueDateTime) return false;
            
            const taskDate = new Date(task.dueDateTime);
            return this.isSameDay(taskDate, date);
        });
    }
    
    getPriorityColor(priority) {
        switch (priority) {
            case 'high': return 'var(--error)';
            case 'medium': return 'var(--warning)';
            case 'low': return 'var(--success)';
            default: return 'var(--accent)';
        }
    }
    
    getStatusColor(status) {
        switch (status) {
            case 'todo': return 'var(--warning)';
            case 'progress': return 'var(--primary)';
            case 'completed': return 'var(--success)';
            default: return 'var(--accent)';
        }
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }
    
    formatTaskDueDate(dueDateTime) {
        if (!dueDateTime) return null;
        
        const dueDate = new Date(dueDateTime);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const taskDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        
        const timeString = `${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`;
        
        if (taskDate.getTime() === today.getTime()) {
            return `<i class="fas fa-clock" aria-hidden="true"></i> Today at ${timeString}`;
        } else if (taskDate.getTime() === today.getTime() + 24 * 60 * 60 * 1000) {
            return `<i class="fas fa-clock" aria-hidden="true"></i> Tomorrow at ${timeString}`;
        } else {
            return `<i class="fas fa-clock" aria-hidden="true"></i> ${taskDate.toLocaleDateString()} at ${timeString}`;
        }
    }

    // Calendar helper methods
    showTaskModalForDate(date) {
        // Pre-fill the date in the task modal
        this.showTaskModal();
        
        // Set the date field to the clicked date
        const dateString = date.toISOString().split('T')[0];
        const dueDateField = this.domCache.get('taskDueDate');
        if (dueDateField) {
            dueDateField.value = dateString;
        }
        
        // Set a default time
        const dueTimeField = this.domCache.get('taskDueTime');
        if (dueTimeField && !dueTimeField.value) {
            dueTimeField.value = '09:00';
        }
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        document.getElementById('toastContainer').appendChild(toast);

        // Show toast
        requestAnimationFrame(() => toast.classList.add('show'));

        // Hide and remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    saveTasks() {
        // Debounce localStorage writes
        this.debouncedSaveTasks();
    }

    debouncedSaveTasks = this.debounce(() => {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
        // Also save to server if logged in
        if (this.currentUser && this.authToken) {
            this.saveUserTasks();
        }
    }, 300);

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }


    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Cleanup method for performance optimization
    cleanup() {
        // Clear all debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        // Clean up input listeners
        this.inputListeners.forEach(({ handler }, inputId) => {
            const input = this.domCache.get(inputId);
            if (input) {
                input.removeEventListener('input', handler);
            }
        });
        this.inputListeners.clear();
        
        // Clear render queue
        this.renderQueue.clear();
        this.isRendering = false;
        
        // Clear DOM cache
        this.domCache.clear();
    }

    // Performance monitoring helper
    measurePerformance(name, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        console.log(`${name}: ${end - start}ms`);
        return result;
    }

    // Authentication Methods
    setupAuthEventListeners() {
        // Login button
        document.getElementById('loginBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginModal();
        });

        // Profile button
        document.getElementById('profileBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showProfileModal();
        });

        // Logout button
        document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Modal close buttons
        document.getElementById('closeLoginModal')?.addEventListener('click', () => this.hideLoginModal());
        document.getElementById('closeRegisterModal')?.addEventListener('click', () => this.hideRegisterModal());
        document.getElementById('closeProfileModal')?.addEventListener('click', () => this.hideProfileModal());

        // Modal switching
        document.getElementById('showRegisterModal')?.addEventListener('click', () => {
            this.hideLoginModal();
            this.showRegisterModal();
        });

        document.getElementById('showLoginModal')?.addEventListener('click', () => {
            this.hideRegisterModal();
            this.showLoginModal();
        });

        // Form submissions
        document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm')?.addEventListener('submit', (e) => this.handleRegister(e));

        // Close modals when clicking outside
        ['loginModal', 'registerModal', 'profileModal'].forEach(modalId => {
            document.getElementById(modalId)?.addEventListener('click', (e) => {
                if (e.target.id === modalId) {
                    this.hideAuthModals();
                }
            });
        });
    }

    showLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.classList.add('show');
            document.getElementById('loginEmail')?.focus();
        }
    }

    hideLoginModal() {
        document.getElementById('loginModal')?.classList.remove('show');
    }

    showRegisterModal() {
        const modal = document.getElementById('registerModal');
        if (modal) {
            modal.classList.add('show');
            document.getElementById('registerName')?.focus();
        }
    }

    hideRegisterModal() {
        document.getElementById('registerModal')?.classList.remove('show');
    }

    showProfileModal() {
        if (this.currentUser) {
            this.updateProfileModal();
            const modal = document.getElementById('profileModal');
            if (modal) modal.classList.add('show');
        } else {
            this.showToast('Please login to view your profile', 'error');
        }
    }

    hideProfileModal() {
        document.getElementById('profileModal')?.classList.remove('show');
    }

    hideAuthModals() {
        this.hideLoginModal();
        this.hideRegisterModal();
        this.hideProfileModal();
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail')?.value;
        const password = document.getElementById('loginPassword')?.value;

        if (!email || !password) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.currentUser = data.user;
                this.authToken = data.token;
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                localStorage.setItem('authToken', this.authToken);
                
                this.updateAuthUI();
                this.hideLoginModal();
                this.showToast(`Welcome back, ${this.currentUser.name}!`, 'success');
                
                // Load user's tasks from server
                await this.loadUserTasks();
            } else {
                this.showToast(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Connection error. Please try again.', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const name = document.getElementById('registerName')?.value;
        const email = document.getElementById('registerEmail')?.value;
        const password = document.getElementById('registerPassword')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;

        if (!name || !email || !password || !confirmPassword) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showToast('Passwords do not match', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Registration successful! Please login.', 'success');
                this.hideRegisterModal();
                this.showLoginModal();
                
                // Pre-fill login form
                document.getElementById('loginEmail').value = email;
            } else {
                this.showToast(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showToast('Connection error. Please try again.', 'error');
        }
    }

    logout() {
        this.currentUser = null;
        this.authToken = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        
        this.updateAuthUI();
        this.showToast('You have been logged out', 'success');
        
        // Clear tasks or reload default tasks
        this.tasks = [];
        this.renderTasks();
        this.updateStats();
    }

    updateAuthUI() {
        const body = document.body;
        
        if (this.currentUser) {
            body.classList.remove('logged-out');
            body.classList.add('logged-in');
            
            // Update user info in sidebar (if elements exist)
            const userName = document.getElementById('userName');
            const userStatus = document.getElementById('userStatus');
            const userAvatar = document.getElementById('userAvatar');
            
            if (userName) userName.textContent = this.currentUser.name;
            if (userStatus) userStatus.textContent = 'Logged in';
            if (userAvatar) userAvatar.textContent = this.currentUser.name.charAt(0).toUpperCase();
        } else {
            body.classList.remove('logged-in');
            body.classList.add('logged-out');
            
            // Update user info in sidebar (if elements exist)
            const userName = document.getElementById('userName');
            const userStatus = document.getElementById('userStatus');
            const userAvatar = document.getElementById('userAvatar');
            
            if (userName) userName.textContent = 'Guest User';
            if (userStatus) userStatus.textContent = 'Not logged in';
            if (userAvatar) userAvatar.textContent = '?';
        }
    }

    updateProfileModal() {
        if (!this.currentUser) return;
        
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profileTasksCompleted = document.getElementById('profileTasksCompleted');
        const profileMemberSince = document.getElementById('profileMemberSince');
        
        if (profileName) profileName.textContent = this.currentUser.name;
        if (profileEmail) profileEmail.textContent = this.currentUser.email;
        
        if (profileTasksCompleted) {
            const completedTasks = this.tasks.filter(t => t.status === 'completed').length;
            profileTasksCompleted.textContent = completedTasks.toString();
        }
        
        if (profileMemberSince) {
            profileMemberSince.textContent = new Date().toLocaleDateString();
        }
    }

    async loadUserTasks() {
        try {
            const userId = this.currentUser?.id || 'default';
            const response = await fetch(`/api/tasks?userId=${userId}&withAttachments=true`, {
                headers: {
                    ...(this.authToken && { 'Authorization': 'Bearer ' + this.authToken })
                }
            });
            
            const data = await response.json();
            if (data.success) {
                // Convert database format to frontend format
                this.tasks = data.tasks.map(task => ({
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    category: task.category,
                    status: task.status,
                    dueDateTime: task.due_datetime,
                    createdAt: task.created_at,
                    attachments: task.attachments || []
                }));
                
                this.renderTasks();
                this.updateStats();
            }
        } catch (error) {
            console.error('Error loading user tasks:', error);
            // Fall back to localStorage if available
            const localTasks = localStorage.getItem('tasks');
            if (localTasks) {
                this.tasks = JSON.parse(localTasks);
                this.renderTasks();
                this.updateStats();
            }
        }
    }

    async loadUpcomingEvents() {
        try {
            const userId = this.currentUser?.id || 'default';
            const response = await fetch(`/api/events?userId=${userId}`, {
                headers: {
                    ...(this.authToken && { 'Authorization': 'Bearer ' + this.authToken })
                }
            });

            if (response.ok) {
                const data = await response.json();
                const events = data.events || [];
                this.displayUpcomingEvents(events);
                this.updateEventStats(events);
            }
        } catch (error) {
            console.error('Error loading calendar events:', error);
        }
    }

    displayUpcomingEvents(events) {
        const container = document.getElementById('upcomingEventsContainer');
        if (!container) return;

        // Filter to show only today and future events
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcomingEvents = events.filter(event => {
            const eventDate = new Date(event.date);
            // Handle timezone issues by comparing just the date parts
            const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
            const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            return eventDateOnly >= todayDateOnly;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));

        // Show only the next 5 events
        const eventsToShow = upcomingEvents.slice(0, 5);

        if (eventsToShow.length === 0) {
            container.innerHTML = `
                <div class="no-events-message">
                    <i class="fas fa-calendar-check" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                    <p>No upcoming events</p>
                    <a href="calendar.html" class="btn btn-primary" style="margin-top: 1rem;">
                        <i class="fas fa-plus"></i> Add Event
                    </a>
                </div>
            `;
            return;
        }

        container.innerHTML = eventsToShow.map(event => {
            const eventDate = new Date(event.date);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            return `
                <div class="event-card" onclick="window.location.href='calendar.html'">
                    <div class="event-date-box">
                        <div class="event-date-day">${eventDate.getDate()}</div>
                        <div class="event-date-month">${monthNames[eventDate.getMonth()]}</div>
                    </div>
                    <div class="event-info">
                        <div class="event-title">${this.escapeHtml(event.title || 'Untitled Event')}</div>
                        ${event.description ? `<div class="event-description">${this.escapeHtml(event.description)}</div>` : ''}
                        <div class="event-meta">
                            ${event.time ? `
                                <div class="event-meta-item">
                                    <i class="fas fa-clock"></i>
                                    <span>${this.formatTime(event.time)}</span>
                                </div>
                            ` : ''}
                            ${event.location ? `
                                <div class="event-meta-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <span>${this.escapeHtml(event.location)}</span>
                                </div>
                            ` : ''}
                            ${event.type ? `
                                <div class="event-meta-item">
                                    <i class="fas fa-tag"></i>
                                    <span>${this.escapeHtml(event.type)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateEventStats(events) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const weekFromToday = new Date(today);
        weekFromToday.setDate(weekFromToday.getDate() + 7);

        // Calculate stats
        const totalEvents = events.length;
        const todayEvents = events.filter(event => {
            const eventDate = new Date(event.date);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate.getTime() === today.getTime();
        }).length;
        
        const thisWeekEvents = events.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate >= today && eventDate < weekFromToday;
        }).length;
        
        const upcomingEvents = events.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate >= tomorrow;
        }).length;

        // Update DOM elements
        const totalEventsEl = document.getElementById('totalEvents');
        const todayEventsEl = document.getElementById('todayEvents');
        const thisWeekEventsEl = document.getElementById('thisWeekEvents');
        const upcomingEventsEl = document.getElementById('upcomingEvents');

        if (totalEventsEl) totalEventsEl.textContent = totalEvents;
        if (todayEventsEl) todayEventsEl.textContent = todayEvents;
        if (thisWeekEventsEl) thisWeekEventsEl.textContent = thisWeekEvents;
        if (upcomingEventsEl) upcomingEventsEl.textContent = upcomingEvents;
    }

    formatTime(timeString) {
        if (!timeString) return '';
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupCalendarRefresh() {
        // Refresh calendar events every 30 seconds when dashboard is active
        setInterval(() => {
            if (this.currentPage === 'dashboard') {
                this.loadUpcomingEvents();
            }
        }, 30000);

        // Also refresh when window gains focus (user returns from calendar)
        window.addEventListener('focus', () => {
            if (this.currentPage === 'dashboard') {
                this.loadUpcomingEvents();
            }
        });

        // Listen for real-time updates from calendar page
        this.setupRealTimeEventUpdates();
    }

    setupRealTimeEventUpdates() {
        // Listen for localStorage changes (calendar notifications)
        window.addEventListener('storage', (e) => {
            if (e.key === 'calendarEventsUpdated' && this.currentPage === 'dashboard') {
                console.log('🔄 Received calendar update notification, refreshing dashboard...');
                this.loadUpcomingEvents();
            }
        });

        // Listen for postMessage (if calendar is in popup/iframe)
        window.addEventListener('message', (e) => {
            if (e.data === 'eventsUpdated' && this.currentPage === 'dashboard') {
                console.log('🔄 Received calendar postMessage, refreshing dashboard...');
                this.loadUpcomingEvents();
            }
        });

        // Poll for localStorage changes (fallback for same-tab updates)
        let lastUpdateTimestamp = localStorage.getItem('calendarEventsUpdated');
        setInterval(() => {
            const currentTimestamp = localStorage.getItem('calendarEventsUpdated');
            if (currentTimestamp && currentTimestamp !== lastUpdateTimestamp && this.currentPage === 'dashboard') {
                console.log('🔄 Detected calendar update via polling, refreshing dashboard...');
                lastUpdateTimestamp = currentTimestamp;
                this.loadUpcomingEvents();
            }
        }, 1000); // Check every second
    }

    async saveUserTasks() {
        // Tasks are now automatically saved to database via API calls
        // Keep localStorage as backup
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }

    async addTaskAttachment(taskId, fileId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}/attachments/${fileId}`, {
                method: 'POST',
                headers: {
                    ...(this.authToken && { 'Authorization': 'Bearer ' + this.authToken })
                }
            });
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to add attachment');
            }
        } catch (error) {
            console.error('Add attachment error:', error);
            throw error;
        }
    }

    async removeTaskAttachment(taskId, fileId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}/attachments/${fileId}`, {
                method: 'DELETE',
                headers: {
                    ...(this.authToken && { 'Authorization': 'Bearer ' + this.authToken })
                }
            });
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to remove attachment');
            }
        } catch (error) {
            console.error('Remove attachment error:', error);
            throw error;
        }
    }

    // New navigation system
    setupNavigation() {
        // Get all navigation elements
        const navItems = document.querySelectorAll('.nav-item[data-page]');
        const categoryItems = document.querySelectorAll('.nav-item[data-category]');
        const searchBtn = document.getElementById('searchTasksBtn');
        
        // Add click listeners to page navigation
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                this.navigateToPage(page);
            });
        });
        
        // Add click listeners to category navigation
        categoryItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const category = item.getAttribute('data-category');
                this.filterByCategory(category);
            });
        });
        
        // Add click listener to search button
        if (searchBtn) {
            searchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToPage('search');
            });
        }
    }

    navigateToPage(page) {
        console.log('Navigating to page:', page);
        
        // Handle calendar page - redirect to calendar.html
        if (page === 'calendar') {
            window.location.href = 'calendar.html';
            return;
        }
        
        // Update current page
        this.currentPage = page;
        
        // Clear category filter when navigating to different pages
        this.currentCategory = null;
        
        // Update active states
        this.updateNavigationActiveStates();
        
        // Update page title
        this.updatePageTitle(page);
        
        // Show the appropriate view
        this.showPage(page);
    }

    updateNavigationActiveStates() {
        // Clear all active states
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Set active state for current page
        const currentPageItem = document.querySelector(`[data-page="${this.currentPage}"]`);
        if (currentPageItem) {
            currentPageItem.classList.add('active');
        }
        
        // Set active state for current category if any
        if (this.currentCategory) {
            const currentCategoryItem = document.querySelector(`[data-category="${this.currentCategory}"]`);
            if (currentCategoryItem) {
                currentCategoryItem.classList.add('active');
            }
        }
    }

    updatePageTitle(page) {
        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) {
            switch (page) {
                case 'tasks':
                    pageTitle.textContent = 'Task Board';
                    break;
                case 'calendar':
                    pageTitle.textContent = 'Calendar View';
                    break;
                case 'search':
                    pageTitle.textContent = 'Search Tasks';
                    break;
                default:
                    pageTitle.textContent = 'TaskFlow';
            }
        }
    }

    showPage(page) {
        // Hide all views first
        this.hideAllViews();
        
        switch (page) {
            case 'tasks':
                this.showTaskBoard();
                break;
            case 'calendar':
                this.showCalendarView();
                break;
            case 'search':
                this.showSearchView();
                break;
        }
    }
}

// Initialize the app
(async function() {
// AI Chat Widget Class
class AIChatWidget {
    constructor() {
        this.isOpen = false;
        this.isMinimized = false;
        this.sessionId = 'session_' + Date.now();
        this.conversationHistory = [];
        this.isTyping = false;
        
        this.initializeElements();
        this.setupEventListeners();
        
        // Auto-open the chat widget when page loads
        setTimeout(() => {
            this.openChat();
        }, 1000); // Wait 1 second after page load
    }

    initializeElements() {
        this.widget = document.getElementById('aiChatWidget');
        this.toggle = document.getElementById('aiChatToggle');
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.voiceBtn = document.getElementById('voiceBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.minimizeBtn = document.getElementById('minimizeChat');
        this.closeBtn = document.getElementById('closeChat');
        this.chatStatus = document.getElementById('chatStatus');
        this.quickActions = document.querySelectorAll('.quick-action-btn');
    }

    setupEventListeners() {
        // Toggle chat
        this.toggle.addEventListener('click', () => this.toggleChat());
        
        // Minimize/maximize
        this.minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMinimize();
        });
        
        // Close chat
        this.closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeChat();
        });
        
        // Chat header click to toggle minimize
        document.getElementById('chatHeader').addEventListener('click', () => {
            if (this.isOpen && !this.isMinimized) {
                this.toggleMinimize();
            }
        });
        
        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // Enter to send
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Voice input (placeholder)
        this.voiceBtn.addEventListener('click', () => this.toggleVoiceInput());
        
        // Quick actions
        this.quickActions.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.sendQuickAction(action);
            });
        });
        
        // Auto-resize input
        this.chatInput.addEventListener('input', () => {
            this.updateSendButton();
        });
        
        this.updateSendButton();
    }

    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    openChat() {
        this.isOpen = true;
        this.widget.classList.add('open');
        this.toggle.classList.add('hidden');
        this.chatInput.focus();
        this.updateStatus('Ready to help');
    }

    closeChat() {
        this.isOpen = false;
        this.isMinimized = false;
        this.widget.classList.remove('open', 'minimized');
        this.toggle.classList.remove('hidden');
        this.updateStatus('Ready to help');
    }

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        if (this.isMinimized) {
            this.widget.classList.add('minimized');
            this.updateStatus('Minimized');
        } else {
            this.widget.classList.remove('minimized');
            this.updateStatus('Ready to help');
            this.chatInput.focus();
        }
    }

    async sendMessage(messageText = null) {
        const message = messageText || this.chatInput.value.trim();
        if (!message) return;

        // Clear input
        this.chatInput.value = '';
        this.updateSendButton();

        // Add user message to chat
        this.addMessage(message, 'user');

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Send to AI assistant API
            const response = await fetch('/api/assistant/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
                },
                body: JSON.stringify({
                    message: message,
                    sessionId: this.sessionId
                })
            });

            const data = await response.json();

            // Hide typing indicator
            this.hideTypingIndicator();

            if (data.success) {
                // Add AI response
                this.addMessage(data.response, 'ai');
                
                // Handle actions if any
                if (data.action) {
                    this.handleAction(data.action, data.data, data.actionResult);
                }

                // If an event was created, force calendar refresh
                if (data.action === 'EVENT_CREATED' && window.app) {
                    setTimeout(() => {
                        console.log('AI: Force refreshing calendar after event creation');
                        window.app.loadUpcomingEvents();
                    }, 500);
                }

                // Update status
                this.updateStatus('Ready to help');
                
                // Store conversation
                this.conversationHistory.push({
                    userMessage: message,
                    aiResponse: data.response,
                    timestamp: new Date(),
                    intent: data.intent,
                    entities: data.entities
                });

            } else {
                this.addMessage(data.error || 'Sorry, I had trouble understanding that.', 'ai');
                this.updateStatus('Error occurred');
            }

        } catch (error) {
            console.error('Chat API error:', error);
            this.hideTypingIndicator();
            this.addMessage('I\'m having trouble connecting right now. Please try again.', 'ai');
            this.updateStatus('Connection error');
        }
    }

    sendQuickAction(action) {
        this.sendMessage(action);
    }

    addMessage(text, sender) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${sender}-message`;
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageEl.innerHTML = `
            <div class="message-content">
                <div class="message-text">${this.formatMessage(text)}</div>
                <div class="message-time">${timeStr}</div>
                ${sender === 'ai' ? this.getMessageActions() : ''}
            </div>
        `;
        
        this.chatMessages.appendChild(messageEl);
        this.scrollToBottom();
        
        // Add fade-in animation
        messageEl.style.opacity = '0';
        requestAnimationFrame(() => {
            messageEl.style.transition = 'opacity 0.3s ease';
            messageEl.style.opacity = '1';
        });
    }

    formatMessage(text) {
        // Convert line breaks and basic formatting
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    getMessageActions() {
        return `
            <div class="message-actions">
                <button class="action-btn" onclick="aiChat.provideFeedback('positive')">
                    <i class="fas fa-thumbs-up"></i> Good
                </button>
                <button class="action-btn" onclick="aiChat.provideFeedback('negative')">
                    <i class="fas fa-thumbs-down"></i> Poor
                </button>
            </div>
        `;
    }

    showTypingIndicator() {
        if (this.isTyping) return;
        
        this.isTyping = true;
        this.updateStatus('Thinking...');
        
        const typingEl = document.createElement('div');
        typingEl.className = 'typing-indicator';
        typingEl.id = 'typingIndicator';
        typingEl.innerHTML = `
            Assistant is typing
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        this.chatMessages.appendChild(typingEl);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingEl = document.getElementById('typingIndicator');
        if (typingEl) {
            typingEl.remove();
        }
        this.isTyping = false;
    }

    handleAction(action, data, actionResult) {
        switch (action) {
            case 'EVENT_CREATED':
                this.showEventCreatedNotification(data);
                break;
            case 'SHOW_SCHEDULE':
                this.showScheduleView(data);
                break;
            case 'REQUEST_DATE':
            case 'REQUEST_TIME':
                this.showDateTimePicker(action, data);
                break;
        }
    }

    showEventCreatedNotification(data) {
        // Always refresh the calendar view
        if (window.app) {
            window.app.loadUpcomingEvents();
        }
        
        // Show success toast
        this.showToast('Event created successfully!', 'success');
    }

    showScheduleView(data) {
        // Could integrate with calendar view
        console.log('Schedule view data:', data);
    }

    showDateTimePicker(requestType, data) {
        // Could show a date/time picker widget
        console.log(`Date/time picker needed for ${requestType}:`, data);
    }

    async provideFeedback(type) {
        if (this.conversationHistory.length === 0) return;
        
        const lastConversation = this.conversationHistory[this.conversationHistory.length - 1];
        
        try {
            await fetch('/api/assistant/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
                },
                body: JSON.stringify({
                    conversationId: lastConversation.id || Date.now(),
                    feedbackType: type
                })
            });
            
            this.showToast(`Thank you for the ${type} feedback!`, 'info');
            
        } catch (error) {
            console.error('Feedback error:', error);
        }
    }

    toggleVoiceInput() {
        // Voice input implementation (placeholder)
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            console.log('Voice input not yet implemented');
            this.showToast('Voice input coming soon!', 'info');
        } else {
            this.showToast('Voice input not supported in this browser', 'warning');
        }
    }

    updateStatus(status) {
        if (this.chatStatus) {
            this.chatStatus.textContent = status;
        }
    }

    updateSendButton() {
        const hasText = this.chatInput.value.trim().length > 0;
        this.sendBtn.disabled = !hasText;
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    showToast(message, type = 'info') {
        // Integrate with existing toast system if available
        console.log(`Toast: ${message} (${type})`);
        
        // Create a simple toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary);
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            z-index: 1001;
            max-width: 300px;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s ease';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Public methods for external integration
    sendMessageFromExternal(message) {
        if (!this.isOpen) {
            this.openChat();
        }
        
        setTimeout(() => {
            this.sendMessage(message);
        }, 300);
    }

    getConversationHistory() {
        return this.conversationHistory;
    }

    clearHistory() {
        this.conversationHistory = [];
        this.chatMessages.innerHTML = `
            <div class="message ai-message">
                <div class="message-content">
                    <div class="message-text">
                        👋 Hi! I'm your calendar assistant. How can I help you today?
                    </div>
                    <div class="message-time">just now</div>
                </div>
            </div>
        `;
    }
}

    // Ensure DOM is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        await initApp();
    }
    
    async function initApp() {
        try {
            // Make app globally available for onclick handlers
            window.app = new TaskFlowApp();
            await window.app.init();
            
            // Initialize AI Chat Widget
            window.aiChat = new AIChatWidget();
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
        }
    }
})().catch(error => {
    console.error('Failed to initialize app:', error);
});
