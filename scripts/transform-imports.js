#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync, cpSync } from 'fs';
import { join, extname, dirname, relative } from 'path';

const tempDir = '.temp-build';

function copyDirectory(src, dest) {
    try {
        cpSync(src, dest, { recursive: true });
    } catch (err) {
        console.error(`Failed to copy ${src} to ${dest}:`, err.message);
    }
}

function ensureDirectoryExists(dirPath) {
    try {
        mkdirSync(dirPath, { recursive: true });
    } catch (err) {
        // Directory already exists or other error
    }
}

function transformImportsToJs(dir) {
  const files = readdirSync(dir);

  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

      if (stat.isDirectory() && file !== 'node_modules' && file !== 'dist' && file !== '.temp-build') {
          transformImportsToJs(fullPath);
      } else if (extname(file) === '.ts') {
          let content = readFileSync(fullPath, 'utf-8');

        // Transform .ts imports to .js
        content = content.replace(/from ['"]([^'"]+)\.ts['"]/g, "from '$1.js'");
        content = content.replace(/import\s*\(\s*['"]([^'"]+)\.ts['"]\s*\)/g, "import('$1.js')");

            writeFileSync(fullPath, content);
        }
    }
}

function cleanupTempDir() {
    try {
      rmSync(tempDir, { recursive: true, force: true });
  } catch (err) {
      // Ignore errors if directory doesn't exist
  }
}

const command = process.argv[2];

if (command === 'prepare') {
    // Clean up any existing temp directory
    cleanupTempDir();

    // Create temp directory and copy src to it
    ensureDirectoryExists(tempDir);
    copyDirectory('./src', join(tempDir, 'src'));

    // Transform imports in the temp directory
    transformImportsToJs(join(tempDir, 'src'));

    console.log('Created temporary build directory with transformed .ts imports to .js');
} else if (command === 'cleanup') {
    cleanupTempDir();
    console.log('Cleaned up temporary build directory');
} else {
    console.log('Usage: node scripts/transform-imports.js [prepare|cleanup]');
    console.log('  prepare: Create temp directory with transformed imports');
    console.log('  cleanup: Remove temp directory');
  process.exit(1);
}