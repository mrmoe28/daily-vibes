// Calendar JavaScript
let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let selectedDate = null;
let events = [];
let editingEventId = null;

// Initialize calendar on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeCalendar();
    loadEvents();
    setupEventListeners();
    hideLoadingScreen();
});

function initializeCalendar() {
    renderCalendar();
    updateMonthYearDisplay();
}

function setupEventListeners() {
    // Month navigation
    document.getElementById('prevMonthBtn').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
        updateMonthYearDisplay();
    });

    document.getElementById('nextMonthBtn').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
        updateMonthYearDisplay();
    });

    document.getElementById('todayBtn').addEventListener('click', () => {
        currentDate = new Date();
        currentMonth = currentDate.getMonth();
        currentYear = currentDate.getFullYear();
        renderCalendar();
        updateMonthYearDisplay();
    });

    // Add event button
    document.getElementById('addEventBtn').addEventListener('click', openEventModal);
    document.getElementById('addEventForDay').addEventListener('click', () => {
        if (selectedDate) {
            openEventModal(selectedDate);
        }
    });

    // Event sidebar
    document.getElementById('closeEventSidebar').addEventListener('click', closeEventSidebar);

    // Event form
    document.getElementById('eventForm').addEventListener('submit', handleEventSubmit);
    document.getElementById('eventAllDay').addEventListener('change', (e) => {
        const timeInput = document.getElementById('eventTime');
        if (e.target.checked) {
            timeInput.disabled = true;
            timeInput.value = '';
        } else {
            timeInput.disabled = false;
        }
    });

    document.getElementById('eventRecurring').addEventListener('change', (e) => {
        const recurringOptions = document.getElementById('recurringOptions');
        recurringOptions.style.display = e.target.checked ? 'block' : 'none';
    });

    // Delete event button
    document.getElementById('deleteEvent').addEventListener('click', handleDeleteEvent);

    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });
}

function renderCalendar() {
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    // Add previous month's trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
        const dayDiv = createDayElement(prevMonthDays - i, true, false);
        calendarDays.appendChild(dayDiv);
    }

    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = isDateToday(currentYear, currentMonth, day);
        const dayDiv = createDayElement(day, false, isToday);
        calendarDays.appendChild(dayDiv);
    }

    // Add next month's leading days
    const totalCells = calendarDays.children.length;
    const remainingCells = 42 - totalCells; // 6 rows × 7 days
    for (let day = 1; day <= remainingCells; day++) {
        const dayDiv = createDayElement(day, true, false);
        calendarDays.appendChild(dayDiv);
    }
}

function createDayElement(day, isOtherMonth, isToday) {
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
        const dayEvents = events.filter(event => event.date === dateStr);
        
        if (dayEvents.length > 0) {
            dayDiv.classList.add('has-events');
            const eventsPreview = document.createElement('div');
            eventsPreview.className = 'day-events-preview';
            
            dayEvents.slice(0, 3).forEach(event => {
                const eventDot = document.createElement('div');
                eventDot.className = `event-dot ${event.color || 'blue'}`;
                eventsPreview.appendChild(eventDot);
            });
            
            dayDiv.appendChild(eventsPreview);
        }
    }

    // Add click event
    if (!isOtherMonth) {
        dayDiv.addEventListener('click', () => {
            selectDate(currentYear, currentMonth, day);
        });
    }

    return dayDiv;
}

function selectDate(year, month, day) {
    // Remove previous selection
    document.querySelectorAll('.calendar-day.selected').forEach(el => {
        el.classList.remove('selected');
    });

    // Add selection to clicked day
    const dayElements = document.querySelectorAll('.calendar-day:not(.other-month)');
    dayElements[day - 1].classList.add('selected');

    selectedDate = new Date(year, month, day);
    openEventSidebar(selectedDate);
}

function openEventSidebar(date) {
    const sidebar = document.getElementById('eventSidebar');
    sidebar.classList.add('open');

    // Display selected date
    const dateDisplay = document.getElementById('selectedDateDisplay');
    dateDisplay.textContent = formatDateDisplay(date);

    // Display events for selected date
    displayDayEvents(date);
}

function closeEventSidebar() {
    const sidebar = document.getElementById('eventSidebar');
    sidebar.classList.remove('open');
}

function displayDayEvents(date) {
    const dayEventsContainer = document.getElementById('dayEvents');
    const dateStr = formatDateString(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEvents = events.filter(event => event.date === dateStr);

    if (dayEvents.length === 0) {
        dayEventsContainer.innerHTML = '<p class="no-events">No events for this day</p>';
        return;
    }

    dayEventsContainer.innerHTML = '';
    dayEvents.forEach(event => {
        const eventCard = document.createElement('div');
        eventCard.className = `event-card ${event.color || 'blue'}`;
        eventCard.innerHTML = `
            <div class="event-card-title">${event.title}</div>
            ${event.time ? `<div class="event-card-time">${event.time}</div>` : ''}
            ${event.location ? `<div class="event-card-location"><i class="fas fa-map-marker-alt"></i> ${event.location}</div>` : ''}
        `;
        eventCard.addEventListener('click', () => editEvent(event));
        dayEventsContainer.appendChild(eventCard);
    });
}

function openEventModal(date = null) {
    const modal = document.getElementById('eventModal');
    modal.classList.add('show');
    
    // Reset form
    document.getElementById('eventForm').reset();
    document.getElementById('modalTitle').textContent = 'Add New Event';
    document.getElementById('deleteEvent').style.display = 'none';
    editingEventId = null;

    // Set date if provided
    if (date) {
        document.getElementById('eventDate').value = formatDateInput(date);
    } else {
        document.getElementById('eventDate').value = formatDateInput(new Date());
    }
}

function closeEventModal() {
    const modal = document.getElementById('eventModal');
    modal.classList.remove('show');
    editingEventId = null;
}

function editEvent(event) {
    openEventModal();
    
    document.getElementById('modalTitle').textContent = 'Edit Event';
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('eventDate').value = event.date;
    document.getElementById('eventTime').value = event.time || '';
    document.getElementById('eventType').value = event.type || 'other';
    document.getElementById('eventColor').value = event.color || 'blue';
    document.getElementById('eventLocation').value = event.location || '';
    document.getElementById('eventAllDay').checked = event.allDay || false;
    document.getElementById('deleteEvent').style.display = 'block';
    
    editingEventId = event.id;
}

async function handleEventSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const eventData = {
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

        if (response.ok) {
            closeEventModal();
            await loadEvents();
            renderCalendar();
            if (selectedDate) {
                displayDayEvents(selectedDate);
            }
            showNotification(editingEventId ? 'Event updated successfully' : 'Event created successfully', 'success');
        } else {
            throw new Error('Failed to save event');
        }
    } catch (error) {
        console.error('Error saving event:', error);
        showNotification('Failed to save event', 'error');
    }
}

async function handleDeleteEvent() {
    if (!editingEventId) return;
    
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
        const response = await fetch(`/api/events/${editingEventId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            closeEventModal();
            await loadEvents();
            renderCalendar();
            if (selectedDate) {
                displayDayEvents(selectedDate);
            }
            showNotification('Event deleted successfully', 'success');
        } else {
            throw new Error('Failed to delete event');
        }
    } catch (error) {
        console.error('Error deleting event:', error);
        showNotification('Failed to delete event', 'error');
    }
}

async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        if (response.ok) {
            const data = await response.json();
            events = data.events || [];
        }
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

// Utility functions
function updateMonthYearDisplay() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('currentMonthYear').textContent = `${monthNames[currentMonth]} ${currentYear}`;
}

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

function hideLoadingScreen() {
    setTimeout(() => {
        document.getElementById('loadingScreen').style.display = 'none';
    }, 500);
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