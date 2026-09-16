#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const entry = path.join(__dirname, '../dist/cli.js');
if (!fs.existsSync(entry)) {
  console.error(
    'expo-native-workspace is not built. In a source checkout, run pnpm build at the workspace root.',
  );
  process.exitCode = 2;
} else {
  require(entry);
}
