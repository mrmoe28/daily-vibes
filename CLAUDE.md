# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Local Development
```bash
npm run dev        # Start development server on http://localhost:3000
npm start          # Start production server
npm run build      # Create necessary directories (data/, uploads/)
```

### Testing
```bash
npm test           # Run all Playwright tests
npm run test:ui    # Run tests with Playwright UI mode
```

### Specific Test Execution
Run individual test files:
```bash
npx playwright test tests/new-task.spec.js
npx playwright test tests/navigation.spec.js  
npx playwright test tests/performance-accessibility.spec.js
```

Run tests with browser visible (helpful for debugging):
```bash
npx playwright test tests/new-task.spec.js --headed
```

## Architecture Overview

### Dual Server Architecture
This application runs in two modes:
- **Development**: `server.js` - Full Express server with all middleware and routes
- **Production**: `api/index.js` - Vercel serverless function with simplified implementation

Both entry points serve the same single-page application (`public/index.html`) but handle backend functionality differently.

### Database Abstraction
The `DatabaseService` (`lib/database.js`) supports both SQLite and PostgreSQL:
- **SQLite**: Default for development (`sqlite://./data/app.db`)
- **PostgreSQL**: Production via `DATABASE_URL` environment variable

The service automatically handles SQL dialect differences, including parameter syntax (`$1` vs `?`) and `RETURNING` clause support.

### Frontend Architecture
The frontend is a sophisticated vanilla JavaScript single-page application (`public/js/app.js`, 2000+ lines) with advanced performance optimizations:

**Core Performance Features:**
- **DOM Caching**: All frequently accessed elements cached in `domCache` Map
- **Debounced Input Handling**: Smart debouncing with configurable timing and `maxWait` options
- **Virtual Scrolling**: Batch processing of large task lists using `createTaskFragments()`
- **Time Slicing**: Non-blocking operations via `requestIdleCallback()` and `MessageChannel`
- **Render Queuing**: Prevents concurrent renders using `isRendering` flag and `renderQueue` Set

**State Management:**
- Local state with `localStorage` fallback
- Server synchronization for authenticated users
- Real-time UI updates without page reloads

### Service Layer Architecture
Core services in `lib/` directory:

1. **UserManager**: JWT authentication, password hashing, session management
2. **DatabaseService**: Unified database interface with multi-dialect support  
3. **EncryptionService**: Security utilities and API key generation
4. **Logger**: Structured logging service
5. **ConfigManager**: Environment-based configuration management

### Task Management System
Tasks flow through a sophisticated state machine:
- **Frontend**: Drag & drop interface updates task status instantly
- **API Layer**: RESTful endpoints handle CRUD operations (`/api/tasks/*`)
- **Database**: Relational schema with foreign key constraints and proper indexing
- **File Attachments**: Many-to-many relationship via `task_attachments` junction table

## Key Implementation Details

### Authentication Flow
1. User registration creates JWT token and database session
2. Frontend stores token in `localStorage` with `authToken` key
3. All API requests include `Authorization: Bearer <token>` header
4. Server validates token against database sessions table
5. Expired sessions automatically cleaned up

### File Upload Architecture  
- **Local Development**: Files stored in `./uploads/` directory
- **Production**: Designed for cloud storage integration (S3, Cloudinary)
- **Database Integration**: File metadata stored in `files` table
- **Task Attachments**: Junction table links files to tasks

### Performance Considerations
The frontend implements several advanced optimization patterns:

**Input Optimization:**
- Debounced handlers with intelligent scheduling using `scheduler.postTask()` when available
- Input validation caching to avoid repeated computation
- Style update batching to prevent layout thrashing

**Rendering Optimization:**
- Fragment-based DOM construction for efficient manipulation  
- Batch processing with configurable `BATCH_SIZE` (currently 10)
- `yieldToMain()` pattern to maintain responsiveness during large operations

### Database Schema Design
Tables are designed with both SQLite and PostgreSQL compatibility:
- Timestamps use appropriate types (`DATETIME` vs `TIMESTAMPTZ`)
- Auto-incrementing IDs handle dialect differences (`AUTOINCREMENT` vs `SERIAL`)
- Foreign key constraints maintain referential integrity
- Indexes optimize common query patterns

## Testing Strategy

Tests use Playwright with multiple browser configurations:
- **Chrome**: Standard browser testing
- **Performance**: Specialized configuration for performance monitoring

The test suite covers:
- Task creation and management workflows
- Navigation and routing functionality  
- Performance benchmarks and accessibility compliance

Test configuration automatically starts development server (`npm run dev`) and provides detailed reporting in HTML, JSON, and JUnit formats.

## Environment Configuration

Required environment variables:
```bash
DATABASE_URL=sqlite://./data/app.db  # or PostgreSQL connection string
JWT_SECRET=your-jwt-secret-key
NODE_ENV=development
PORT=3000
```

The application gracefully handles missing environment variables with sensible defaults where appropriate.