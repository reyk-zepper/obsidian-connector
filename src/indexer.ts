import * as fs from 'fs/promises';
import * as path from 'path';
import chokidar from 'chokidar';
import { NoteMetadata, VaultStructure } from './types.js';
import { Vault } from './vault.js';

export class Indexer {
  private vault: Vault;
  private vaultPath: string;
  private index: Map<string, NoteMetadata> = new Map();
  private backlinks: Map<string, Set<string>> = new Map();
  private watcher?: chokidar.FSWatcher;

  constructor(vault: Vault, vaultPath: string) {
    this.vault = vault;
    this.vaultPath = vaultPath;
  }

  async initialize(): Promise<void> {
    await this.scanVault();
    this.buildBacklinks();
    this.startWatcher();
  }

  private async scanVault(): Promise<void> {
    const files = await this.findMarkdownFiles(this.vaultPath);

    for (const file of files) {
      const relativePath = path.relative(this.vaultPath, file);
      await this.indexFile(relativePath);
    }
  }

  private async findMarkdownFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.name.startsWith('.')) continue; // Skip hidden files/folders

      if (entry.isDirectory()) {
        const subFiles = await this.findMarkdownFiles(fullPath);
        results.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }

    return results;
  }

  private async indexFile(relativePath: string): Promise<void> {
    try {
      const { metadata } = await this.vault.readNote(relativePath);
      this.index.set(relativePath, metadata);
    } catch (err) {
      console.error(`Failed to index ${relativePath}:`, err);
    }
  }

  private buildBacklinks(): void {
    this.backlinks.clear();

    for (const [notePath, metadata] of this.index.entries()) {
      for (const link of metadata.outgoingLinks) {
        const targetPath = this.normalizeLink(link);

        if (!this.backlinks.has(targetPath)) {
          this.backlinks.set(targetPath, new Set());
        }
        this.backlinks.get(targetPath)!.add(notePath);
      }
    }
  }

  private normalizeLink(link: string): string {
    // Add .md extension if missing
    return link.endsWith('.md') ? link : `${link}.md`;
  }

  private startWatcher(): void {
    this.watcher = chokidar.watch('**/*.md', {
      cwd: this.vaultPath,
      ignoreInitial: true,
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
    });

    this.watcher.on('add', (path) => this.indexFile(path));
    this.watcher.on('change', (path) => this.indexFile(path));
    this.watcher.on('unlink', (path) => {
      this.index.delete(path);
      this.buildBacklinks();
    });
  }

  getMetadata(notePath: string): NoteMetadata | undefined {
    return this.index.get(notePath);
  }

  getBacklinks(notePath: string): string[] {
    const normalized = this.normalizeLink(notePath);
    return Array.from(this.backlinks.get(normalized) || []);
  }

  getAllNotes(): NoteMetadata[] {
    return Array.from(this.index.values());
  }

  getStructure(): VaultStructure {
    const folders = new Set<string>();
    const tagCounts = new Map<string, number>();
    const linkCounts = new Map<string, number>();

    for (const metadata of this.index.values()) {
      // Collect folders
      const folder = path.dirname(metadata.path);
      if (folder !== '.') {
        folders.add(folder);
      }

      // Count tags
      for (const tag of metadata.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }

      // Count links
      for (const link of metadata.outgoingLinks) {
        linkCounts.set(link, (linkCounts.get(link) || 0) + 1);
      }
    }

    // Get top 10 links
    const topLinks = Array.from(linkCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([target, count]) => ({ target, count }));

    return {
      folders: Array.from(folders).sort(),
      tags: Object.fromEntries(tagCounts),
      topLinks,
      stats: {
        totalNotes: this.index.size,
        totalFolders: folders.size,
        totalTags: tagCounts.size,
      },
    };
  }

  async shutdown(): Promise<void> {
    await this.watcher?.close();
  }
}
