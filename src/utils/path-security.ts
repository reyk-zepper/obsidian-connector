import * as path from 'path';
import * as fs from 'fs/promises';

export function validatePath(vaultPath: string, notePath: string): string {
  // Input validation
  if (!vaultPath || !notePath) {
    throw new Error('vaultPath and notePath are required');
  }

  // Normalize and resolve the path
  const normalized = path.normalize(notePath);

  // Ensure path is relative
  if (path.isAbsolute(normalized)) {
    throw new Error('Absolute paths not allowed');
  }

  // Construct full path
  const fullPath = path.join(vaultPath, normalized);

  // Ensure the resolved path is still within vault
  const vaultPathResolved = path.resolve(vaultPath);
  const fullPathResolved = path.resolve(fullPath);

  if (!fullPathResolved.startsWith(vaultPathResolved + path.sep) &&
      fullPathResolved !== vaultPathResolved) {
    throw new Error('Path must be within vault directory');
  }

  return fullPath;
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  if (!dirPath) {
    throw new Error('dirPath is required');
  }
  await fs.mkdir(dirPath, { recursive: true });
}

export function ensureMarkdownExtension(filePath: string): string {
  if (!filePath) {
    return '.md';
  }
  if (!filePath.toLowerCase().endsWith('.md')) {
    return `${filePath}.md`;
  }
  return filePath;
}
