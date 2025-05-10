import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverTypesPath = path.join(__dirname, '../src/types/game.ts');
const clientTypesPath = path.join(__dirname, '../../src/types/game.ts');

// Create client types directory if it doesn't exist
const clientTypesDir = path.dirname(clientTypesPath);
if (!fs.existsSync(clientTypesDir)) {
  fs.mkdirSync(clientTypesDir, { recursive: true });
}

// Copy the types file
fs.copyFileSync(serverTypesPath, clientTypesPath);
console.log('Types copied successfully!'); 