const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function cleanupDuplicates() {
    try {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set');
        }

        const sql = neon(process.env.DATABASE_URL);
        
        console.log('Connecting to database...');
        
        // First, get all tasks to see the duplicates
        const allTasks = await sql`SELECT * FROM tasks ORDER BY created_at DESC`;
        console.log(`Total tasks in database: ${allTasks.length}`);
        
        // Group tasks by title to find duplicates
        const tasksByTitle = {};
        allTasks.forEach(task => {
            if (!tasksByTitle[task.title]) {
                tasksByTitle[task.title] = [];
            }
            tasksByTitle[task.title].push(task);
        });
        
        // Find titles that have duplicates
        const duplicateTitles = Object.keys(tasksByTitle).filter(title => tasksByTitle[title].length > 1);
        console.log(`Found ${duplicateTitles.length} titles with duplicates`);
        
        // Keep only the most recent task for each duplicate title
        let deletedCount = 0;
        for (const title of duplicateTitles) {
            const tasks = tasksByTitle[title];
            // Sort by created_at descending (newest first)
            tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            // Keep the first (newest) and delete the rest
            const tasksToDelete = tasks.slice(1);
            
            for (const task of tasksToDelete) {
                await sql`DELETE FROM tasks WHERE id = ${task.id}`;
                deletedCount++;
                console.log(`Deleted duplicate task: "${task.title}" (ID: ${task.id})`);
            }
        }
        
        console.log(`\nCleanup complete!`);
        console.log(`Deleted ${deletedCount} duplicate tasks`);
        
        // Get final count
        const remainingTasks = await sql`SELECT COUNT(*) as count FROM tasks`;
        console.log(`Remaining tasks in database: ${remainingTasks[0].count}`);
        
    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
}

// Run the cleanup
cleanupDuplicates();