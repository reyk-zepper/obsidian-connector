import * as path from 'path';
import * as fs from 'fs/promises';

export function validatePath(vaultPath: string, notePath: string): string {
  // Normalize and resolve the path
  const normalized = path.normalize(notePath);

  // Reject path traversal attempts
  if (normalized.includes('..')) {
    throw new Error('Path traversal not allowed');
  }

  // Ensure path is relative
  if (path.isAbsolute(normalized)) {
    throw new Error('Absolute paths not allowed');
  }

  // Construct full path
  const fullPath = path.join(vaultPath, normalized);

  // Ensure the resolved path is still within vault
  const vaultPathResolved = path.resolve(vaultPath);
  const fullPathResolved = path.resolve(fullPath);

  if (!fullPathResolved.startsWith(vaultPathResolved)) {
    throw new Error('Path must be within vault directory');
  }

  return fullPath;
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export function ensureMarkdownExtension(filePath: string): string {
  if (!filePath.endsWith('.md')) {
    return `${filePath}.md`;
  }
  return filePath;
}
