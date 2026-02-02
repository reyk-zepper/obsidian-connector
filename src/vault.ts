import * as fs from 'fs/promises';
import * as path from 'path';
import { VaultConfig, NoteMetadata } from './types.js';
import { parseFrontmatter, extractHeadings } from './utils/markdown.js';
import { extractWikilinks } from './utils/links.js';
import { validatePath, ensureMarkdownExtension, ensureDirectory } from './utils/path-security.js';

export class Vault {
  private config: VaultConfig;

  constructor(config: VaultConfig) {
    this.config = config;
  }

  async readNote(notePath: string): Promise<{ content: string; metadata: NoteMetadata }> {
    const fullPath = validatePath(this.config.path, ensureMarkdownExtension(notePath));
    const content = await fs.readFile(fullPath, 'utf-8');
    const stats = await fs.stat(fullPath);

    const { frontmatter, content: body, tags } = parseFrontmatter(content);
    const headings = extractHeadings(body);
    const outgoingLinks = extractWikilinks(body);

    const metadata: NoteMetadata = {
      path: notePath,
      title: frontmatter.title || path.basename(notePath, '.md'),
      tags,
      frontmatter,
      outgoingLinks,
      headings,
      modifiedAt: stats.mtime.toISOString(),
      createdAt: stats.birthtime.toISOString(),
    };

    return { content, metadata };
  }

  async createNote(notePath: string, content: string): Promise<void> {
    const fullPath = validatePath(this.config.path, ensureMarkdownExtension(notePath));

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await ensureDirectory(dir);

    // Use exclusive write flag to prevent race conditions
    try {
      await fs.writeFile(fullPath, content, { encoding: 'utf-8', flag: 'wx' });
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        throw new Error(`Note already exists: ${notePath}`);
      }
      throw err;
    }
  }

  async editNote(notePath: string, content: string): Promise<void> {
    const fullPath = validatePath(this.config.path, ensureMarkdownExtension(notePath));

    // Verify file exists
    await fs.access(fullPath);

    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async deleteNote(notePath: string): Promise<void> {
    const fullPath = validatePath(this.config.path, ensureMarkdownExtension(notePath));
    const trashDir = path.join(this.config.path, '.trash');

    await ensureDirectory(trashDir);

    const fileName = path.basename(fullPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uniqueId = Math.random().toString(36).substring(2, 8);
    const trashPath = path.join(trashDir, `${timestamp}-${uniqueId}-${fileName}`);

    await fs.rename(fullPath, trashPath);
  }

  async fileExists(notePath: string): Promise<boolean> {
    try {
      const fullPath = validatePath(this.config.path, ensureMarkdownExtension(notePath));
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
