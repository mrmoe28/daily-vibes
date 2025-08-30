#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

const backupDir = path.join(__dirname, '..', 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

// Critical files to backup
const criticalFiles = [
  'public/index.html',
  'public/css/main.css',
  'public/js/app.js',
  'server.js',
  'lib/database.js',
  'lib/user-manager.js',
  'lib/logger.js',
  'lib/config-manager.js'
];

async function createBackup() {
  try {
    // Create backup directory
    const backupPath = path.join(backupDir, `backup-${timestamp}`);
    await fs.ensureDir(backupPath);
    
    console.log(`📦 Creating backup: ${backupPath}`);
    
    // Copy critical files
    for (const file of criticalFiles) {
      const sourcePath = path.join(__dirname, '..', file);
      const destPath = path.join(backupPath, file);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.ensureDir(path.dirname(destPath));
        await fs.copy(sourcePath, destPath);
        console.log(`✅ Backed up: ${file}`);
      } else {
        console.log(`⚠️  File not found: ${file}`);
      }
    }
    
    // Create backup info
    const backupInfo = {
      timestamp: new Date().toISOString(),
      files: criticalFiles,
      version: require('../package.json').version
    };
    
    await fs.writeJson(path.join(backupPath, 'backup-info.json'), backupInfo, { spaces: 2 });
    
    console.log(`\n✅ Backup completed successfully!`);
    console.log(`📁 Location: ${backupPath}`);
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
}

createBackup();
