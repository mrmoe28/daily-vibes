// Calendar JavaScript
let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let selectedDate = null;
let events = [];
let editingEventId = null;
let isInitialized = false;

// Initialize calendar on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!isInitialized) {
        isInitialized = true;
        initializeCalendar();
        loadEvents();
        setupEventListeners();
        setupCategoryTabs();
        handleURLParameters();
    }
});

function initializeCalendar() {
    renderCalendar();
    updateMonthYearDisplay();
}

function setupEventListeners() {
    // Prevent duplicate listeners
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    const todayBtn = document.getElementById('todayBtn');
    const addEventBtn = document.getElementById('addEventBtn');
    const addTaskBtn = document.getElementById('addTaskBtn'); // Add Task button in navigation
    const addEventForDayBtn = document.getElementById('addEventForDay');
    const closeEventDetailsBtn = document.getElementById('closeEventDetails');
    const eventForm = document.getElementById('eventForm');
    const deleteEventBtn = document.getElementById('deleteEvent');

    // Remove existing listeners by cloning elements
    if (prevBtn) {
        const newPrevBtn = prevBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
        newPrevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            renderCalendar();
            updateMonthYearDisplay();
        });
    }

    if (nextBtn) {
        const newNextBtn = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
        newNextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            renderCalendar();
            updateMonthYearDisplay();
        });
    }

    if (todayBtn) {
        const newTodayBtn = todayBtn.cloneNode(true);
        todayBtn.parentNode.replaceChild(newTodayBtn, todayBtn);
        newTodayBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const today = new Date();
            currentMonth = today.getMonth();
            currentYear = today.getFullYear();
            renderCalendar();
            updateMonthYearDisplay();
        });
    }

    if (addEventBtn) {
        const newAddEventBtn = addEventBtn.cloneNode(true);
        addEventBtn.parentNode.replaceChild(newAddEventBtn, addEventBtn);
        newAddEventBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openEventModal();
        });
    }

    if (addTaskBtn) {
        const newAddTaskBtn = addTaskBtn.cloneNode(true);
        addTaskBtn.parentNode.replaceChild(newAddTaskBtn, addTaskBtn);
        newAddTaskBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openEventModal(); // Open the same event modal for consistency
        });
    }

    if (addEventForDayBtn) {
        const newAddEventForDayBtn = addEventForDayBtn.cloneNode(true);
        addEventForDayBtn.parentNode.replaceChild(newAddEventForDayBtn, addEventForDayBtn);
        newAddEventForDayBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (selectedDate) {
                closeEventDetailsModal();
                openEventModal(selectedDate);
            }
        });
    }

    if (closeEventDetailsBtn) {
        const newCloseBtn = closeEventDetailsBtn.cloneNode(true);
        closeEventDetailsBtn.parentNode.replaceChild(newCloseBtn, closeEventDetailsBtn);
        newCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeEventDetailsModal();
        });
    }

    if (eventForm) {
        const newEventForm = eventForm.cloneNode(true);
        eventForm.parentNode.replaceChild(newEventForm, eventForm);
        newEventForm.addEventListener('submit', handleEventSubmit);
    }

    if (deleteEventBtn) {
        const newDeleteBtn = deleteEventBtn.cloneNode(true);
        deleteEventBtn.parentNode.replaceChild(newDeleteBtn, deleteEventBtn);
        newDeleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleDeleteEvent();
        });
    }

    // Add modal close handlers
    window.addEventListener('click', (e) => {
        const eventModal = document.getElementById('eventModal');
        const eventDetailsModal = document.getElementById('eventDetailsModal');
        if (e.target === eventModal) {
            closeEventModal();
        }
        if (e.target === eventDetailsModal) {
            closeEventDetailsModal();
        }
    });

    // Add escape key handler for modal close
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEventModal();
            closeEventDetailsModal();
        }
    });

    // Add navigation handler to ensure modals close when navigating
    window.addEventListener('beforeunload', () => {
        closeEventModal();
        closeEventDetailsModal();
    });
}

function renderCalendar() {
    try {
        const calendarDays = document.getElementById('calendarDays');
        if (!calendarDays) return;
        
        calendarDays.innerHTML = '';

        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

        // Add previous month's trailing days
        for (let i = firstDay - 1; i >= 0; i--) {
            const dayDiv = createDayElement(prevMonthDays - i, true, false);
            if (dayDiv) calendarDays.appendChild(dayDiv);
        }

        // Add current month's days
        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = isDateToday(currentYear, currentMonth, day);
            const dayDiv = createDayElement(day, false, isToday);
            if (dayDiv) calendarDays.appendChild(dayDiv);
        }

        // Add next month's leading days
        const totalCells = calendarDays.children.length;
        const remainingCells = 42 - totalCells; // 6 rows × 7 days
        for (let day = 1; day <= remainingCells; day++) {
            const dayDiv = createDayElement(day, true, false);
            if (dayDiv) calendarDays.appendChild(dayDiv);
        }
    } catch (error) {
        console.error('Error rendering calendar:', error);
    }
}

function createDayElement(day, isOtherMonth, isToday) {
    try {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        if (isOtherMonth) {
            dayDiv.classList.add('other-month');
        }
        
        if (isToday) {
            dayDiv.classList.add('today');
        }

        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayDiv.appendChild(dayNumber);

        // Add events preview
        if (!isOtherMonth) {
            const dateStr = formatDateString(currentYear, currentMonth, day);
            const dayEvents = events.filter(event => {
                if (!event || !event.date) return false;
                // Handle both formats: "2025-08-31" and "2025-08-31T04:00:00.000Z"
                const eventDateStr = event.date.split('T')[0]; // Extract date part
                const matches = eventDateStr === dateStr;
                if (matches) {
                    console.log(`🗓️ Event "${event.title}" matches date ${dateStr}`);
                }
                return matches;
            });
            
            if (dayEvents.length > 1) {
                console.log(`📊 Day ${dateStr} has ${dayEvents.length} events:`, dayEvents.map(e => e.title));
            }
            
            if (dayEvents.length > 0) {
                dayDiv.classList.add('has-events');
                const eventsPreview = document.createElement('div');
                eventsPreview.className = 'day-events-preview';
                
                // Show only the first event prominently for better readability
                const firstEvent = dayEvents[0];
                const eventPreview = document.createElement('div');
                eventPreview.className = `event-preview ${firstEvent.color || 'blue'}`;
                
                const eventTitle = document.createElement('div');
                eventTitle.className = 'event-preview-title';
                eventTitle.textContent = firstEvent.title || 'Untitled Event';
                eventPreview.appendChild(eventTitle);
                
                // Show description if available
                if (firstEvent.description) {
                    const eventDesc = document.createElement('div');
                    eventDesc.className = 'event-preview-description';
                    eventDesc.textContent = firstEvent.description;
                    eventPreview.appendChild(eventDesc);
                }
                
                // Show time and additional info
                const eventDetails = document.createElement('div');
                eventDetails.className = 'event-preview-details';
                
                if (firstEvent.time) {
                    const eventTime = document.createElement('div');
                    eventTime.className = 'event-preview-time';
                    eventTime.textContent = formatTime(firstEvent.time);
                    eventDetails.appendChild(eventTime);
                }
                
                // Show location if available
                if (firstEvent.location) {
                    const eventLocation = document.createElement('div');
                    eventLocation.className = 'event-preview-location';
                    eventLocation.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${escapeHtml(firstEvent.location)}`;
                    eventDetails.appendChild(eventLocation);
                }
                
                if (eventDetails.children.length > 0) {
                    eventPreview.appendChild(eventDetails);
                }
                
                // Add click handler to event preview
                eventPreview.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent day selection
                    editEvent(firstEvent);
                });
                
                eventsPreview.appendChild(eventPreview);
                
                // If more than 1 event, show count with click handler
                if (dayEvents.length > 1) {
                    const moreEvents = document.createElement('div');
                    moreEvents.className = 'more-events';
                    const additionalCount = dayEvents.length - 1;
                    moreEvents.innerHTML = `<i class="fas fa-calendar-plus"></i> ${additionalCount} more event${additionalCount > 1 ? 's' : ''}`;
                    
                    // Add click handler to show all events for the day
                    moreEvents.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent day selection
                        selectDate(currentYear, currentMonth, day);
                    });
                    
                    eventsPreview.appendChild(moreEvents);
                }
                
                dayDiv.appendChild(eventsPreview);
            }
        }

        // Add click event
        if (!isOtherMonth) {
            dayDiv.addEventListener('click', (e) => {
                e.preventDefault();
                selectDate(currentYear, currentMonth, day);
            });
        }

        return dayDiv;
    } catch (error) {
        console.error('Error creating day element:', error);
        return null;
    }
}

function selectDate(year, month, day) {
    try {
        // Remove previous selection
        document.querySelectorAll('.calendar-day.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // Find and select the clicked day
        const calendarDays = document.querySelectorAll('.calendar-day');
        calendarDays.forEach(dayEl => {
            const dayNumber = dayEl.querySelector('.day-number');
            if (dayNumber && parseInt(dayNumber.textContent) === day && !dayEl.classList.contains('other-month')) {
                dayEl.classList.add('selected');
            }
        });

        selectedDate = new Date(year, month, day);
        openEventDetailsModal(selectedDate);
    } catch (error) {
        console.error('Error selecting date:', error);
    }
}

function openEventDetailsModal(date) {
    try {
        const modal = document.getElementById('eventDetailsModal');
        if (modal) {
            modal.classList.add('show');

            // Display selected date
            const dateDisplay = document.getElementById('selectedDateDisplay');
            if (dateDisplay) {
                dateDisplay.textContent = formatDateDisplay(date);
            }

            // Display events for selected date
            displayDayEvents(date);
        }
    } catch (error) {
        console.error('Error opening event details modal:', error);
    }
}

function closeEventDetailsModal() {
    try {
        const modal = document.getElementById('eventDetailsModal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
            // Remove any event listeners to prevent memory leaks
            modal.removeAttribute('data-active');
        }
    } catch (error) {
        console.error('Error closing event details modal:', error);
    }
}

function displayDayEvents(date) {
    try {
        const dayEventsContainer = document.getElementById('dayEvents');
        if (!dayEventsContainer) return;
        
        const dateStr = formatDateString(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEvents = events.filter(event => {
            if (!event || !event.date) return false;
            // Handle both formats: "2025-08-31" and "2025-08-31T04:00:00.000Z"
            const eventDateStr = event.date.split('T')[0]; // Extract date part
            return eventDateStr === dateStr;
        });

        if (dayEvents.length === 0) {
            dayEventsContainer.innerHTML = '<p class="no-events">No events for this day</p>';
            return;
        }

        dayEventsContainer.innerHTML = '';
        dayEvents.forEach(event => {
            const eventCard = document.createElement('div');
            eventCard.className = `event-card ${event.color || 'blue'}`;
            eventCard.innerHTML = `
                <div class="event-card-title">${escapeHtml(event.title || '')}</div>
                ${event.time ? `<div class="event-card-time">${escapeHtml(event.time)}</div>` : ''}
                ${event.location ? `<div class="event-card-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(event.location)}</div>` : ''}
            `;
            eventCard.addEventListener('click', (e) => {
                e.preventDefault();
                editEvent(event);
            });
            dayEventsContainer.appendChild(eventCard);
        });
    } catch (error) {
        console.error('Error displaying day events:', error);
    }
}

function openEventModal(date = null) {
    try {
        const modal = document.getElementById('eventModal');
        if (modal) {
            modal.classList.add('show');
            
            // Reset form
            const eventForm = document.getElementById('eventForm');
            const modalTitle = document.getElementById('modalTitle');
            const deleteBtn = document.getElementById('deleteEvent');
            
            if (eventForm) eventForm.reset();
            if (modalTitle) modalTitle.textContent = 'Add New Event';
            if (deleteBtn) deleteBtn.style.display = 'none';
            editingEventId = null;

            // Set date if provided
            const eventDateInput = document.getElementById('eventDate');
            if (eventDateInput) {
                if (date) {
                    eventDateInput.value = formatDateInput(date);
                } else {
                    eventDateInput.value = formatDateInput(new Date());
                }
            }
        }
    } catch (error) {
        console.error('Error opening event modal:', error);
    }
}

function closeEventModal() {
    try {
        const modal = document.getElementById('eventModal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
        }
        editingEventId = null;
    } catch (error) {
        console.error('Error closing event modal:', error);
    }
}

function editEvent(event) {
    try {
        closeEventDetailsModal();
        openEventModal();
        
        const modalTitle = safeGetElement('modalTitle');
        const eventTitle = safeGetElement('eventTitle');
        const eventDescription = safeGetElement('eventDescription');
        const eventDate = safeGetElement('eventDate');
        const eventTime = safeGetElement('eventTime');
        const eventType = safeGetElement('eventType');
        const eventColor = safeGetElement('eventColor');
        const eventLocation = safeGetElement('eventLocation');
        const deleteEvent = safeGetElement('deleteEvent');
        
        if (modalTitle) modalTitle.textContent = 'Edit Event';
        if (eventTitle) eventTitle.value = event.title || '';
        if (eventDescription) eventDescription.value = event.description || '';
        if (eventDate) eventDate.value = event.date || '';
        if (eventTime) eventTime.value = event.time || '';
        if (eventType) eventType.value = event.type || 'other';
        if (eventColor) eventColor.value = event.color || 'blue';
        if (eventLocation) eventLocation.value = event.location || '';
        if (deleteEvent) deleteEvent.style.display = 'block';
        
        editingEventId = event.id;
    } catch (error) {
        console.error('Error editing event:', error);
    }
}

async function handleEventSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const eventData = {
        userId: 'default',
        title: formData.get('title'),
        description: formData.get('description'),
        date: formData.get('date'),
        time: formData.get('time'),
        type: formData.get('type'),
        color: formData.get('color'),
        location: formData.get('location'),
        allDay: formData.get('allDay') === 'on',
        recurring: formData.get('recurring') === 'on',
        recurringType: formData.get('recurringType')
    };

    try {
        const url = editingEventId ? `/api/events/${editingEventId}` : '/api/events';
        const method = editingEventId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        });

        const responseData = await response.json();
        
        if (response.ok && responseData.success) {
            // Add the new/updated event to local events array for immediate preview
            if (editingEventId) {
                // Update existing event
                const eventIndex = events.findIndex(e => e.id === editingEventId);
                if (eventIndex !== -1) {
                    events[eventIndex] = { ...eventData, id: editingEventId };
                }
            } else {
                // Add new event (use timestamp as temporary ID)
                const newEvent = { ...eventData, id: responseData.event?.id || Date.now() };
                events.push(newEvent);
            }
            
            closeEventModal();
            renderCalendar(); // Re-render to show event preview immediately
            
            if (selectedDate) {
                displayDayEvents(selectedDate);
            }
            showNotification(editingEventId ? 'Event updated successfully' : 'Event created successfully', 'success');
            
            // Notify dashboard about the event change
            notifyDashboardUpdate();
            
            // Reload events from server to ensure data consistency
            await loadEvents(true); // Skip render since we already rendered above
        } else {
            throw new Error(responseData.error || 'Failed to save event');
        }
    } catch (error) {
        console.error('Error saving event:', error);
        showNotification('Failed to save event: ' + error.message, 'error');
    }
}

async function handleDeleteEvent() {
    if (!editingEventId) return;
    
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
        const response = await fetch(`/api/events/${editingEventId}`, {
            method: 'DELETE'
        });

        const responseData = await response.json();

        if (response.ok && responseData.success) {
            // Remove event from local array for immediate UI update
            events = events.filter(event => event.id !== editingEventId);
            
            closeEventModal();
            renderCalendar(); // Re-render to remove event preview immediately
            
            if (selectedDate) {
                displayDayEvents(selectedDate);
            }
            showNotification('Event deleted successfully', 'success');
            
            // Notify dashboard about the event change
            notifyDashboardUpdate();
            
            // Reload events from server to ensure data consistency
            await loadEvents(true); // Skip render since we already rendered above
        } else {
            throw new Error(responseData.error || 'Failed to delete event');
        }
    } catch (error) {
        console.error('Error deleting event:', error);
        showNotification('Failed to delete event: ' + error.message, 'error');
    }
}

async function loadEvents(skipRender = false) {
    try {
        const response = await fetch('/api/events?userId=default');
        if (response.ok) {
            const data = await response.json();
            events = data.events || [];
            console.log(`📅 Loaded ${events.length} events from database`);
            
            // Debug: Check for duplicate events
            const eventTitles = events.map(e => e.title);
            const duplicates = eventTitles.filter((item, index) => eventTitles.indexOf(item) !== index);
            if (duplicates.length > 0) {
                console.warn('🔍 Duplicate events found:', duplicates);
            }
            
            // Only re-render if not explicitly skipped
            if (!skipRender) {
                renderCalendar();
            }
        } else {
            console.warn('Failed to load events:', response.status);
            events = []; // Use empty array as fallback
        }
    } catch (error) {
        console.warn('Error loading events:', error);
        events = []; // Use empty array as fallback
    }
}

// Utility functions

function isDateToday(year, month, day) {
    const today = new Date();
    return year === today.getFullYear() && 
           month === today.getMonth() && 
           day === today.getDate();
}

function formatDateString(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDateInput(date) {
    return formatDateString(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateDisplay(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to format time for display
function formatTime(timeString) {
    if (!timeString) return '';
    
    try {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours, 10);
        const minute = parseInt(minutes, 10);
        
        if (hour === 0) {
            return `12:${minute.toString().padStart(2, '0')} AM`;
        } else if (hour < 12) {
            return `${hour}:${minute.toString().padStart(2, '0')} AM`;
        } else if (hour === 12) {
            return `12:${minute.toString().padStart(2, '0')} PM`;
        } else {
            return `${hour - 12}:${minute.toString().padStart(2, '0')} PM`;
        }
    } catch (error) {
        return timeString; // Return original if parsing fails
    }
}

// Global modal functions for onclick handlers
window.closeEventModal = closeEventModal;
window.openEventModal = openEventModal;

// Enhanced error handling for missing DOM elements
function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with ID '${id}' not found`);
    }
    return element;
}

// Update DOM manipulation to use safe getter
function updateMonthYearDisplay() {
    try {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const element = safeGetElement('currentMonthYear');
        if (element) {
            element.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        }
    } catch (error) {
        console.error('Error updating month/year display:', error);
    }
}

function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.className = `notification ${type} show`;

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Add notification styles
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        padding: 1rem 1.5rem;
        background: var(--surface-elevated);
        color: var(--text-primary);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        transform: translateY(100px);
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 9999;
    }

    .notification.show {
        transform: translateY(0);
        opacity: 1;
    }

    .notification.success {
        background: var(--success);
        color: white;
    }

    .notification.error {
        background: var(--error);
        color: white;
    }

    .no-events {
        text-align: center;
        color: var(--text-muted);
        padding: 2rem;
        font-style: italic;
    }
`;
document.head.appendChild(notificationStyles);

function setupCategoryTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const subcategoryContainers = document.querySelectorAll('.subcategory-container');
    const eventTypeInput = document.getElementById('eventType');
    const eventSubtypeInput = document.getElementById('eventSubtype');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.dataset.category;
            
            // Update tab appearance
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show corresponding subcategory container
            subcategoryContainers.forEach(container => {
                container.classList.remove('active');
                if (container.dataset.category === category) {
                    container.classList.add('active');
                }
            });
            
            // Update hidden inputs
            eventTypeInput.value = category;
            
            // Update subcategory based on first option of active container
            const activeContainer = document.querySelector(`.subcategory-container[data-category="${category}"]`);
            const firstOption = activeContainer.querySelector('select option');
            if (firstOption) {
                eventSubtypeInput.value = firstOption.value;
            }
        });
    });
    
    // Set up subcategory change handlers
    document.getElementById('workSubcategory').addEventListener('change', (e) => {
        eventSubtypeInput.value = e.target.value;
    });
    
    document.getElementById('homeSubcategory').addEventListener('change', (e) => {
        eventSubtypeInput.value = e.target.value;
    });
    
    document.getElementById('goalsSubcategory').addEventListener('change', (e) => {
        eventSubtypeInput.value = e.target.value;
    });
}

function handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    const actionParam = urlParams.get('action');
    
    if (actionParam === 'add') {
        // Open the event modal
        setTimeout(() => {
            openEventModal();
            
            // If date parameter is provided, set it in the form
            if (dateParam) {
                const eventDateInput = document.getElementById('eventDate');
                if (eventDateInput) {
                    eventDateInput.value = dateParam;
                }
            }
        }, 500); // Small delay to ensure modal elements are ready
    }
}

function notifyDashboardUpdate() {
    // Use localStorage to notify dashboard of changes
    const timestamp = Date.now();
    localStorage.setItem('calendarEventsUpdated', timestamp.toString());
    
    // Also try to notify parent window if this is opened in a popup/iframe
    if (window.opener && !window.opener.closed) {
        window.opener.postMessage('eventsUpdated', '*');
    }
    
    console.log('📡 Notified dashboard of event changes');
}