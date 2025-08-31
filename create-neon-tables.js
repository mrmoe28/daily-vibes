const { neon } = require('@neondatabase/serverless');

async function createNeonTables() {
  try {
    const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_3uEBxwXZMgV0@ep-super-pine-adgm4g8e-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
    
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    console.log('🔗 Connecting to Neon database...');
    console.log('🔧 Using DATABASE_URL:', DATABASE_URL.replace(/\/\/[^@]*@/, '//**:**@')); // Hide credentials in log
    
    const sql = neon(DATABASE_URL, {
      fetchOptions: {
        cache: 'no-store'
      }
    });
    
    console.log('📋 Creating users table...');
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        avatar TEXT,
        preferences JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Users table created successfully');

    console.log('📋 Creating tasks table...');
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default',
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        category TEXT NOT NULL DEFAULT 'personal',
        status TEXT NOT NULL DEFAULT 'todo',
        due_date DATE,
        due_time TIME,
        due_datetime TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Tasks table created successfully');

    console.log('📋 Creating file_attachments table...');
    await sql`
      CREATE TABLE IF NOT EXISTS file_attachments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        original_name TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ File attachments table created successfully');

    // Test the connection with a simple query
    console.log('🧪 Testing database connection...');
    const result = await sql`SELECT 1 as test`;
    console.log('✅ Database connection test successful:', result);

    // Insert a test task to verify everything works
    console.log('🧪 Testing task insertion...');
    const testTask = await sql`
      INSERT INTO tasks (id, user_id, title, description, priority, category, status)
      VALUES ('test-task-123', 'default', 'Database Test Task', 'Testing Neon serverless setup', 'high', 'work', 'todo')
      ON CONFLICT (id) DO UPDATE SET 
        title = EXCLUDED.title,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    console.log('✅ Test task created:', testTask[0]);

    // Test fetching tasks
    console.log('🧪 Testing task retrieval...');
    const tasks = await sql`SELECT * FROM tasks WHERE user_id = 'default' LIMIT 5`;
    console.log(`✅ Found ${tasks.length} tasks for default user`);

    console.log('🎉 All Neon database operations successful!');
    console.log('📊 Database is ready for production use');

  } catch (error) {
    console.error('❌ Error setting up Neon database:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the setup
createNeonTables().then(() => {
  console.log('✅ Neon database setup complete');
  process.exit(0);
});