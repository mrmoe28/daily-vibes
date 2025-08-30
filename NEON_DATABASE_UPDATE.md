# Neon Database Schema Update Guide

## Issue Fixed
The task creation functionality was failing due to a foreign key constraint in the PostgreSQL database. The `tasks` table had a foreign key reference to `users(id)`, but tasks were being created with `user_id = 'default'` without a corresponding user record.

## Solution
1. **Removed foreign key constraint** from the tasks table
2. **Updated database schema** to allow tasks without strict user relationships
3. **Added migration logic** to handle existing databases
4. **Created update script** for safe schema migration

## Files Modified

### `/lib/database.js`
- Removed `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` from both PostgreSQL and SQLite schemas
- Added `runMigrations()` method to handle schema updates
- Updated `createTables()` to run migrations first

### `/scripts/update-schema.js` (NEW)
- Automated script to update Neon database schema
- Tests task creation after migration
- Provides detailed feedback on the update process

### `/package.json`
- Added `update-schema` npm script

## How to Apply the Fix

### Step 1: Deploy Updated Code
```bash
git add .
git commit -m "fix: update database schema to allow task creation"
git push origin main
```

### Step 2: Run Schema Update (Choose One)

#### Option A: Run via npm script
```bash
npm run update-schema
```

#### Option B: Run directly
```bash
node scripts/update-schema.js
```

#### Option C: Run on Vercel (if deployed)
```bash
vercel env add DATABASE_URL
# Then run the script locally with production DATABASE_URL
```

### Step 3: Test Task Creation
1. Open your application
2. Try creating a new task
3. Verify the task appears in the task board
4. Check that tasks persist after page refresh

## What the Update Does

1. **Connects to your Neon database**
2. **Removes the problematic foreign key constraint**
3. **Verifies the table structure**
4. **Tests task creation with a sample task**
5. **Cleans up the test task**
6. **Reports success/failure**

## Expected Output
```
🔧 Starting schema update...
✅ Database connected successfully
🐘 Updating PostgreSQL schema...
✅ Removed foreign key constraint from tasks table
📋 Current tasks table structure:
  - id: text NOT NULL
  - user_id: text NOT NULL DEFAULT 'default'::text
  - title: text NOT NULL
  - description: text NULL
  - priority: text NOT NULL DEFAULT 'medium'::text
  - category: text NOT NULL DEFAULT 'personal'::text
  - status: text NOT NULL DEFAULT 'todo'::text
  - due_date: date NULL
  - due_time: time NULL
  - due_datetime: timestamptz NULL
  - created_at: timestamptz NULL DEFAULT CURRENT_TIMESTAMP
  - updated_at: timestamptz NULL DEFAULT CURRENT_TIMESTAMP
🧪 Testing task creation...
✅ Test task created successfully: Schema Update Test Task
🧹 Test task cleaned up
🎉 Schema update completed successfully!
```

## Troubleshooting

### If the script fails:
1. **Check DATABASE_URL**: Ensure it's set correctly in your environment
2. **Verify Neon connection**: Test database connectivity
3. **Check permissions**: Ensure database user has ALTER table permissions
4. **Manual fix**: Connect to Neon directly and run:
   ```sql
   ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;
   ```

### If tasks still don't save:
1. **Check browser console** for JavaScript errors
2. **Check network tab** for failed API requests
3. **Verify API endpoint** is working: `POST /api/tasks`
4. **Test locally** with SQLite to isolate the issue

## Backup Recommendation
Before running the update, consider backing up your Neon database:
1. Go to your Neon dashboard
2. Create a branch or snapshot
3. Run the schema update
4. Test thoroughly before removing backup

## Why This Fix Works
- **Removes dependency**: Tasks no longer require a user record to exist
- **Maintains flexibility**: Supports both authenticated and guest users
- **Future-proof**: Can easily add user relationships later when auth is implemented
- **Safe migration**: Non-destructive changes with rollback capability