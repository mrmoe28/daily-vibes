#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Critical files that must exist
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

// Check if critical files exist
let allFilesExist = true;
const missingFiles = [];

console.log('🔍 Validating Daily Vibe app files...');

for (const file of criticalFiles) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    allFilesExist = false;
    missingFiles.push(file);
    console.log(`❌ Missing: ${file}`);
  } else {
    console.log(`✅ Found: ${file}`);
  }
}

// Check if index.html contains Daily Vibe content
const indexPath = path.join(__dirname, '..', 'public/index.html');
if (fs.existsSync(indexPath)) {
  const content = fs.readFileSync(indexPath, 'utf8');
  if (!content.includes('Daily Vibe') || content.includes('TaskFlow')) {
    console.log('⚠️  Warning: index.html may have been overwritten');
    console.log('   Expected: Daily Vibe content');
    console.log('   Found: Different app content');
  } else {
    console.log('✅ index.html contains Daily Vibe content');
  }
}

if (!allFilesExist) {
  console.log('\n❌ Validation failed! Missing files:');
  missingFiles.forEach(file => console.log(`   - ${file}`));
  console.log('\nPlease restore missing files before starting the app.');
  process.exit(1);
}

console.log('\n✅ All critical files found! Daily Vibe app is ready.');
process.exit(0);
