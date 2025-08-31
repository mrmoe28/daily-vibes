# TaskFlow - Daily Vibes Context Documentation

## Project Overview

TaskFlow (daily-vibes) is a modern, full-stack task management application with a focus on user experience, performance, and scalability. The project combines a robust backend with a sophisticated frontend to deliver a comprehensive task management solution.

### Key Features
- **Task Management**: Create, edit, delete, and organize tasks across different statuses (todo, in-progress, completed)
- **User Authentication**: JWT-based authentication with secure session management
- **File Attachments**: Support for file uploads and attachments to tasks
- **Real-time Updates**: Dynamic UI updates without page reloads
- **Responsive Design**: Mobile-first approach with modern UI components
- **Performance Optimized**: Advanced performance optimizations including debouncing, caching, and virtual scrolling
- **Drag & Drop**: Intuitive task status management through drag and drop interface
- **Dark Theme**: Modern dark theme with glass morphism effects

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: JWT + bcrypt for password hashing
- **File Handling**: Multer for file uploads
- **Security**: CORS, input validation, encryption services
- **Deployment**: Vercel serverless functions

### Frontend
- **Language**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with CSS Variables, Glass morphism effects
- **Architecture**: Class-based application architecture
- **Performance**: Advanced optimizations including DOM caching, debouncing, virtual scrolling
- **Icons**: Font Awesome 6.4.0
- **Fonts**: Inter (Google Fonts)

### Dependencies
```json
{
  "bcrypt": "^5.1.1",
  "cors": "^2.8.5",
  "express": "^4.18.2",
  "jsonwebtoken": "^9.0.2",
  "multer": "^1.4.5-lts.1",
  "sqlite3": "^5.1.6",
  "pg": "^8.16.3",
  "uuid": "^9.0.1"
}
```

## Architecture

### Backend Architecture

#### Core Services
1. **DatabaseService** (`lib/database.js`)
   - Supports both SQLite and PostgreSQL
   - Handles table creation and schema management
   - Provides unified query interface
   - Methods for users, tasks, files, sessions, and attachments

2. **UserManager** (`lib/user-manager.js`)
   - User registration and authentication
   - JWT token generation and validation
   - Password hashing and verification
   - Session management

3. **EncryptionService** (`lib/encryption.js`)
   - Secure encryption/decryption utilities
   - API key generation
   - Data protection services

4. **Logger** (`lib/logger.js`)
   - Structured logging service
   - Error tracking and debugging support

5. **ConfigManager** (`lib/config-manager.js`)
   - Environment configuration management
   - Public/private config separation

#### Server Structure
- **server.js**: Main Express server for local development
- **api/index.js**: Vercel serverless function entry point
- Dual-deployment support (local + serverless)

### Frontend Architecture

#### Main Application Class
**TaskFlowApp** (`public/js/app.js`) - 2000+ lines of optimized JavaScript:

##### Performance Features
- **DOM Caching**: Pre-cached DOM elements for faster access
- **Debouncing**: Smart input debouncing with configurable timing
- **Virtual Scrolling**: Efficient rendering for large task lists
- **Time Slicing**: Non-blocking UI updates using `requestIdleCallback`
- **Batch Processing**: Grouped DOM operations to prevent layout thrashing
- **Message Channel**: Advanced task scheduling for better performance
- **Fragment Caching**: Reusable DOM fragments for faster rendering

##### Core Methods
- `init()`: Application initialization
- `cacheDOM()`: DOM element caching
- `renderTasksOptimized()`: High-performance task rendering
- `createTaskCardOptimized()`: Optimized task card creation
- `setupDragAndDrop()`: Drag and drop functionality
- `navigateToPage()`: Single-page application navigation

##### State Management
- Local state management with localStorage fallback
- Server synchronization for authenticated users
- Real-time UI updates without page reloads

## Database Schema

### Tables

#### Users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  name TEXT,
  api_key TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### Tasks
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  category TEXT DEFAULT 'personal',
  status TEXT DEFAULT 'todo',
  due_date DATE,
  due_time TIME,
  due_datetime TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### Files
```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY,
  user_id TEXT,
  filename TEXT NOT NULL,
  originalname TEXT,
  mimetype TEXT,
  size INTEGER,
  path TEXT,
  url TEXT,
  created_at TIMESTAMP
);
```

#### Task Attachments
```sql
CREATE TABLE task_attachments (
  id INTEGER PRIMARY KEY,
  task_id TEXT,
  file_id INTEGER,
  created_at TIMESTAMP
);
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify` - Token verification

### Tasks
- `GET /api/tasks` - Get user tasks (with optional status filter)
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get specific task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/stats/:userId` - Get task statistics
- `GET /api/tasks/date-range/:userId` - Get tasks by date range

### File Management
- `POST /api/upload` - Upload files
- `POST /api/tasks/:taskId/attachments/:fileId` - Add attachment to task
- `DELETE /api/tasks/:taskId/attachments/:fileId` - Remove attachment

### System
- `GET /api/health` - Health check
- `GET /api/config` - Public configuration

## UI Components & Styling

### Design System
- **Color Scheme**: Dark theme with purple/blue gradients
- **Typography**: Inter font family with carefully selected weights
- **Spacing**: Consistent spacing scale using CSS custom properties
- **Animations**: Smooth transitions with cubic-bezier timing functions
- **Glass Morphism**: Backdrop blur effects and translucent surfaces

### CSS Architecture
- CSS Custom Properties for theming
- Responsive design with mobile-first approach
- Component-based styling structure
- Advanced CSS Grid and Flexbox layouts

### Key UI Components
1. **Navigation Bar**: Fixed header with brand, navigation, and user controls
2. **Task Board**: Kanban-style columns for task status management
3. **Task Cards**: Rich cards with priority indicators, metadata, and actions
4. **Modals**: Backdrop-blurred modals for forms and dialogs
5. **Stats Cards**: Dashboard statistics with hover effects
6. **Toast Notifications**: Sliding toast messages for user feedback

## File Structure

```
daily-vibes-main/
├── api/
│   └── index.js                 # Vercel serverless entry point
├── lib/
│   ├── config-manager.js        # Configuration management
│   ├── database.js              # Database service layer
│   ├── encryption.js            # Encryption utilities
│   ├── logger.js                # Logging service
│   └── user-manager.js          # User authentication
├── public/
│   ├── css/
│   │   └── main.css             # Main stylesheet (1400+ lines)
│   ├── js/
│   │   └── app.js               # Main application (2000+ lines)
│   └── index.html               # Single-page application
├── tests/
│   ├── navigation.spec.js       # Navigation tests
│   ├── new-task.spec.js         # Task creation tests
│   └── performance-accessibility.spec.js
├── data/
│   └── app.db                   # SQLite database
├── uploads/                     # File upload directory
├── server.js                    # Express server
├── package.json                 # Dependencies and scripts
└── vercel.json                  # Vercel configuration
```

## Performance Optimizations

### Frontend Optimizations
1. **DOM Caching**: All frequently accessed elements cached on initialization
2. **Debounced Input Handling**: Smart input debouncing with configurable delays
3. **Virtual Scrolling**: Efficient rendering for large lists
4. **Batch DOM Operations**: Grouped DOM updates to prevent layout thrashing
5. **RequestIdleCallback**: Non-blocking UI updates during idle periods
6. **Message Channel**: Advanced task scheduling for better performance
7. **Fragment Caching**: Reusable DOM fragments
8. **Time Slicing**: Breaking large operations into smaller chunks

### Backend Optimizations
1. **Database Connection Pooling**: Efficient database connections
2. **Query Optimization**: Optimized SQL queries with proper indexing
3. **File Upload Handling**: Efficient file processing with Multer
4. **Session Management**: Secure and efficient session handling
5. **Error Handling**: Comprehensive error handling and logging

## Security Features

### Authentication & Authorization
- JWT-based authentication with secure token handling
- bcrypt password hashing with salt rounds
- Session-based token validation
- Secure API endpoints with authorization middleware

### Data Protection
- Input validation and sanitization
- SQL injection prevention through parameterized queries
- File upload security with type validation
- CORS configuration for cross-origin requests
- Environment variable protection for sensitive data

### Frontend Security
- XSS prevention through proper HTML escaping
- Secure token storage in localStorage with fallbacks
- Input validation on client side
- Secure file handling for attachments

## Testing

### Test Suite
- **Playwright**: End-to-end testing framework
- **Navigation Tests**: Testing page navigation and routing
- **Task Management Tests**: CRUD operations for tasks
- **Performance Tests**: Performance and accessibility testing

### Test Scripts
```json
{
  "test": "playwright test",
  "test:ui": "playwright test --ui"
}
```

## Deployment

### Development
```bash
npm install
npm run dev  # Starts on http://localhost:3000
```

### Production (Vercel)
- Automatic deployment through Vercel
- Serverless function architecture
- Environment variable configuration
- Database connection handling for production PostgreSQL

### Environment Variables
```
DATABASE_URL=sqlite://./data/app.db
JWT_SECRET=your-jwt-secret
NODE_ENV=development
PORT=3000
```

## Browser Support

### Supported Features
- Modern ES6+ JavaScript features
- CSS Grid and Flexbox
- CSS Custom Properties
- Intersection Observer API
- RequestIdleCallback (with fallbacks)
- MessageChannel API (with fallbacks)

### Fallbacks
- Graceful degradation for older browsers
- Polyfills for missing APIs
- Progressive enhancement approach

## Future Enhancements

### Planned Features
1. **Calendar View**: Visual calendar interface for task scheduling
2. **Analytics Dashboard**: Task completion trends and productivity metrics
3. **Advanced Search**: Full-text search and filtering capabilities
4. **Real-time Collaboration**: WebSocket-based real-time updates
5. **Mobile Application**: React Native or PWA implementation
6. **Advanced Notifications**: Email and push notification system

### Technical Improvements
1. **Service Worker**: Offline capability and caching
2. **WebSocket Integration**: Real-time updates
3. **Advanced Caching**: Redis for session and query caching
4. **API Rate Limiting**: Request throttling and abuse prevention
5. **Monitoring**: Application performance monitoring
6. **CI/CD Pipeline**: Automated testing and deployment

## Contributing Guidelines

### Code Style
- ESLint configuration for JavaScript
- Consistent naming conventions
- Comprehensive error handling
- Performance-first approach
- Security-conscious development

### Git Workflow
- Feature branch workflow
- Conventional commit messages
- Code reviews required
- Automated testing on PR

### Development Setup
1. Clone repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run development server: `npm run dev`
5. Run tests: `npm test`

---

This documentation provides a comprehensive overview of the TaskFlow application architecture, features, and implementation details for development teams and contributors.