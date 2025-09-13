#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, extname } from 'path';

const backupSuffix = '.backup';

function transformImportsToJs(dir, isRestore = false) {
  const files = readdirSync(dir);

  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && file !== 'node_modules' && file !== 'dist') {
      transformImportsToJs(fullPath, isRestore);
    } else if (extname(file) === '.ts' && !file.endsWith('.backup')) {
      if (isRestore) {
        const backupPath = fullPath + backupSuffix;
        try {
          const backupContent = readFileSync(backupPath, 'utf-8');
          writeFileSync(fullPath, backupContent);
          // Don't delete backup files here, we'll do it separately
        } catch (err) {
          // Backup doesn't exist, skip
        }
      } else {
        let content = readFileSync(fullPath, 'utf-8');

        // Create backup
        writeFileSync(fullPath + backupSuffix, content);

        // Transform .ts imports to .js
        content = content.replace(/from ['"]([^'"]+)\.ts['"]/g, "from '$1.js'");
        content = content.replace(/import\s*\(\s*['"]([^'"]+)\.ts['"]\s*\)/g, "import('$1.js')");

        writeFileSync(fullPath, content);
      }
    }
  }
}

function cleanupBackups(dir) {
  const files = readdirSync(dir);

  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && file !== 'node_modules' && file !== 'dist') {
      cleanupBackups(fullPath);
    } else if (file.endsWith(backupSuffix)) {
      try {
        unlinkSync(fullPath);
      } catch (err) {
        // Ignore errors
      }
    }
  }
}

const command = process.argv[2];

if (command === 'prepare') {
  transformImportsToJs('./src');
  console.log('Transformed .ts imports to .js for build');
} else if (command === 'restore') {
  transformImportsToJs('./src', true);
  cleanupBackups('./src');
  console.log('Restored original .ts imports');
} else {
  console.log('Usage: node scripts/transform-imports.js [prepare|restore]');
  process.exit(1);
}