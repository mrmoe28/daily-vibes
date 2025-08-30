#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

const backupDir = path.join(__dirname, '..', 'backups');

async function listBackups() {
  try {
    const backups = await fs.readdir(backupDir);
    const validBackups = [];
    
    for (const backup of backups) {
      const backupPath = path.join(backupDir, backup);
      const stats = await fs.stat(backupPath);
      
      if (stats.isDirectory()) {
        const infoPath = path.join(backupPath, 'backup-info.json');
        if (await fs.pathExists(infoPath)) {
          const info = await fs.readJson(infoPath);
          validBackups.push({
            name: backup,
            path: backupPath,
            timestamp: info.timestamp,
            version: info.version
          });
        }
      }
    }
    
    return validBackups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    return [];
  }
}

async function restoreBackup(backupName) {
  try {
    const backupPath = path.join(backupDir, backupName);
    
    if (!await fs.pathExists(backupPath)) {
      console.error(`❌ Backup not found: ${backupName}`);
      return false;
    }
    
    console.log(`🔄 Restoring from backup: ${backupName}`);
    
    // Read backup info
    const infoPath = path.join(backupPath, 'backup-info.json');
    const info = await fs.readJson(infoPath);
    
    // Restore files
    for (const file of info.files) {
      const sourcePath = path.join(backupPath, file);
      const destPath = path.join(__dirname, '..', file);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.ensureDir(path.dirname(destPath));
        await fs.copy(sourcePath, destPath);
        console.log(`✅ Restored: ${file}`);
      } else {
        console.log(`⚠️  File not found in backup: ${file}`);
      }
    }
    
    console.log(`\n✅ Restore completed successfully!`);
    console.log(`📅 Backup timestamp: ${info.timestamp}`);
    console.log(`📦 App version: ${info.version}`);
    
    return true;
  } catch (error) {
    console.error('❌ Restore failed:', error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Available backups:');
    const backups = await listBackups();
    
    if (backups.length === 0) {
      console.log('❌ No backups found');
      process.exit(1);
    }
    
    backups.forEach((backup, index) => {
      console.log(`${index + 1}. ${backup.name} (${backup.timestamp})`);
    });
    
    console.log('\nUsage: npm run restore <backup-name>');
    process.exit(0);
  }
  
  const backupName = args[0];
  const success = await restoreBackup(backupName);
  process.exit(success ? 0 : 1);
}

main();
