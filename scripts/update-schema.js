#!/usr/bin/env node

/**
 * Schema Update Script for Neon Database
 * 
 * This script updates the database schema to fix task creation issues.
 * Run this after deploying the updated database.js file.
 */

require('dotenv').config();
const { DatabaseService } = require('../lib/database');

async function updateSchema() {
  console.log('🔧 Starting schema update...');
  
  try {
    const database = new DatabaseService();
    await database.initialize();
    
    console.log('✅ Database connected successfully');
    
    // Check if we're using PostgreSQL (Neon)
    if (database.dbType === 'postgres') {
      console.log('🐘 Updating PostgreSQL schema...');
      
      // Remove foreign key constraint from tasks table
      try {
        await database.query(`
          ALTER TABLE IF EXISTS tasks 
          DROP CONSTRAINT IF EXISTS tasks_user_id_fkey
        `);
        console.log('✅ Removed foreign key constraint from tasks table');
      } catch (error) {
        console.log('⚠️  Foreign key constraint may not exist:', error.message);
      }
      
      // Verify the tasks table structure
      const result = await database.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'tasks' 
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Current tasks table structure:');
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
      });
      
    } else {
      console.log('🔧 SQLite database detected - no migration needed');
    }
    
    // Test task creation
    console.log('🧪 Testing task creation...');
    const testTask = {
      id: 'test_' + Date.now(),
      userId: 'default',
      title: 'Schema Update Test Task',
      description: 'This is a test task created after schema update',
      priority: 'medium',
      category: 'test',
      status: 'todo'
    };
    
    const createResult = await database.createTask(testTask);
    console.log('✅ Test task created successfully:', createResult.rows[0]?.title);
    
    // Clean up test task
    await database.deleteTask(testTask.id);
    console.log('🧹 Test task cleaned up');
    
  } catch (error) {
    console.error('❌ Schema update failed:', error);
    process.exit(1);
  }
  
  console.log('🎉 Schema update completed successfully!');
  process.exit(0);
}

if (require.main === module) {
  updateSchema();
}

module.exports = { updateSchema };