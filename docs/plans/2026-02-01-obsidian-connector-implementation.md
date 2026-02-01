# Obsidian Connector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript MCP server that connects Claude (Code + Desktop) bidirectionally with Obsidian vaults

**Architecture:** MCP server with direct filesystem access, in-memory indexing with file-watcher, 13 tools (5 read, 4 write, 4 organize) plus MCP resources

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, chokidar, gray-matter, Node.js

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `README.md`

**Step 1: Initialize npm package**

Run: `npm init -y`

**Step 2: Create package.json with dependencies**

```json
{
  "name": "obsidian-connector",
  "version": "0.1.0",
  "description": "MCP server to connect Claude with Obsidian vaults",
  "main": "dist/index.js",
  "bin": {
    "obsidian-connector": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "prepare": "npm run build"
  },
  "keywords": ["mcp", "obsidian", "claude", "notes"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "chokidar": "^4.0.1",
    "gray-matter": "^4.0.3"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0"
  },
  "files": [
    "dist"
  ]
}
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "lib": ["ES2022"],
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
*.log
.DS_Store
```

**Step 5: Create README.md**

```markdown
# Obsidian Connector

MCP server to connect Claude (Code + Desktop) with Obsidian vaults.

## Installation

\`\`\`bash
npx obsidian-connector
\`\`\`

## Configuration

Add to your Claude MCP settings:

\`\`\`json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["obsidian-connector"],
      "env": {
        "VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
\`\`\`

## Features

- **Read**: Search, read, list notes, get vault structure, get backlinks
- **Write**: Create, edit, update frontmatter, delete notes
- **Organize**: Move notes, add links, suggest structure, apply templates
```

**Step 6: Install dependencies**

Run: `npm install`

**Step 7: Commit**

```bash
git add .
git commit -m "chore: initial project setup with TypeScript and MCP SDK"
```

---

## Task 2: Core Types & Interfaces

**Files:**
- Create: `src/types.ts`

**Step 1: Create type definitions**

```typescript
export interface VaultConfig {
  path: string;
}

export interface NoteMetadata {
  path: string;
  title: string;
  tags: string[];
  frontmatter: Record<string, any>;
  outgoingLinks: string[];
  headings: string[];
  modifiedAt: Date;
  createdAt: Date;
}

export interface SearchResult {
  path: string;
  title: string;
  score: number;
  preview: string;
}

export interface VaultStructure {
  folders: string[];
  tags: Map<string, number>;
  topLinks: Array<{ target: string; count: number }>;
  stats: {
    totalNotes: number;
    totalFolders: number;
    totalTags: number;
  };
}
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add core type definitions"
```

---

## Task 3: Markdown Utilities

**Files:**
- Create: `src/utils/markdown.ts`

**Step 1: Create frontmatter and heading parser**

```typescript
import matter from 'gray-matter';

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, any>;
  content: string;
  tags: string[];
} {
  const { data, content: body } = matter(content);

  // Extract tags from frontmatter
  const tags = new Set<string>();
  if (data.tags) {
    if (Array.isArray(data.tags)) {
      data.tags.forEach(tag => tags.add(tag));
    } else if (typeof data.tags === 'string') {
      tags.add(data.tags);
    }
  }

  return {
    frontmatter: data,
    content: body,
    tags: Array.from(tags),
  };
}

export function extractHeadings(content: string): string[] {
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const headings: string[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    headings.push(match[1].trim());
  }

  return headings;
}

export function updateFrontmatter(
  content: string,
  updates: Record<string, any>
): string {
  const { data, content: body } = matter(content);
  const newData = { ...data, ...updates };
  return matter.stringify(body, newData);
}
```

**Step 2: Commit**

```bash
git add src/utils/markdown.ts
git commit -m "feat: add markdown frontmatter and heading utilities"
```

---

## Task 4: Wikilink Utilities

**Files:**
- Create: `src/utils/links.ts`

**Step 1: Create wikilink parser and updater**

```typescript
export function extractWikilinks(content: string): string[] {
  const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;

  while ((match = wikilinkRegex.exec(content)) !== null) {
    // Handle [[link|alias]] format
    const linkText = match[1].split('|')[0].trim();
    links.push(linkText);
  }

  return links;
}

export function updateWikilinks(
  content: string,
  oldPath: string,
  newPath: string
): string {
  // Convert paths to link format (without .md extension)
  const oldLink = oldPath.replace(/\.md$/, '');
  const newLink = newPath.replace(/\.md$/, '');

  // Update [[oldPath]] and [[oldPath|alias]] formats
  const regex = new RegExp(`\\[\\[${escapeRegex(oldLink)}(\\|[^\\]]+)?\\]\\]`, 'g');
  return content.replace(regex, (match, alias) => {
    return `[[${newLink}${alias || ''}]]`;
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

**Step 2: Commit**

```bash
git add src/utils/links.ts
git commit -m "feat: add wikilink parsing and updating utilities"
```

---

## Task 5: Path Security Utilities

**Files:**
- Create: `src/utils/path-security.ts`

**Step 1: Create path validation utilities**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/utils/path-security.ts
git commit -m "feat: add path security validation utilities"
```

---

## Task 6: Vault Manager - Basic File Operations

**Files:**
- Create: `src/vault.ts`

**Step 1: Create Vault class with basic operations**

```typescript
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
      modifiedAt: stats.mtime,
      createdAt: stats.birthtime,
    };

    return { content, metadata };
  }

  async createNote(notePath: string, content: string): Promise<void> {
    const fullPath = validatePath(this.config.path, ensureMarkdownExtension(notePath));

    // Check if file exists
    try {
      await fs.access(fullPath);
      throw new Error(`Note already exists: ${notePath}`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await ensureDirectory(dir);

    await fs.writeFile(fullPath, content, 'utf-8');
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
    const trashPath = path.join(trashDir, `${timestamp}-${fileName}`);

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
```

**Step 2: Commit**

```bash
git add src/vault.ts
git commit -m "feat: add Vault class with basic file operations"
```

---

## Task 7: Indexer - Scan and Index

**Files:**
- Create: `src/indexer.ts`

**Step 1: Create Indexer class with scanning**

```typescript
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
      tags: tagCounts,
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
```

**Step 2: Commit**

```bash
git add src/indexer.ts
git commit -m "feat: add Indexer with scanning and file watching"
```

---

## Task 8: Read Tools

**Files:**
- Create: `src/tools/read.ts`

**Step 1: Implement read tools**

```typescript
import { Vault } from '../vault.js';
import { Indexer } from '../indexer.js';
import { SearchResult } from '../types.js';

export function createReadTools(vault: Vault, indexer: Indexer) {
  return {
    search_notes: async (args: {
      query: string;
      tags?: string[];
      folder?: string;
      limit?: number;
    }): Promise<SearchResult[]> => {
      const notes = indexer.getAllNotes();
      const results: SearchResult[] = [];
      const query = args.query.toLowerCase();

      for (const metadata of notes) {
        // Filter by folder
        if (args.folder && !metadata.path.startsWith(args.folder)) {
          continue;
        }

        // Filter by tags
        if (args.tags && !args.tags.some(tag => metadata.tags.includes(tag))) {
          continue;
        }

        // Read content for search
        const { content } = await vault.readNote(metadata.path);
        const contentLower = content.toLowerCase();

        // Calculate relevance score
        let score = 0;
        if (metadata.title.toLowerCase().includes(query)) score += 10;
        if (contentLower.includes(query)) score += 1;

        if (score > 0) {
          // Extract preview around first match
          const matchIndex = contentLower.indexOf(query);
          const start = Math.max(0, matchIndex - 50);
          const end = Math.min(content.length, matchIndex + 100);
          const preview = content.slice(start, end).trim();

          results.push({
            path: metadata.path,
            title: metadata.title,
            score,
            preview: `...${preview}...`,
          });
        }
      }

      // Sort by score and limit
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, args.limit || 10);
    },

    read_note: async (args: { path: string }) => {
      const { content, metadata } = await vault.readNote(args.path);
      const backlinks = indexer.getBacklinks(args.path);

      return {
        path: metadata.path,
        title: metadata.title,
        content,
        tags: metadata.tags,
        frontmatter: metadata.frontmatter,
        outgoingLinks: metadata.outgoingLinks,
        backlinks,
        headings: metadata.headings,
        modifiedAt: metadata.modifiedAt,
        createdAt: metadata.createdAt,
      };
    },

    list_notes: async (args: {
      folder?: string;
      tags?: string[];
      has_links_to?: string;
      modified_after?: string;
      sort_by?: 'modified' | 'created' | 'title';
    }) => {
      let notes = indexer.getAllNotes();

      // Filter by folder
      if (args.folder) {
        notes = notes.filter(n => n.path.startsWith(args.folder!));
      }

      // Filter by tags
      if (args.tags) {
        notes = notes.filter(n => args.tags!.some(tag => n.tags.includes(tag)));
      }

      // Filter by links
      if (args.has_links_to) {
        notes = notes.filter(n => n.outgoingLinks.includes(args.has_links_to!));
      }

      // Filter by date
      if (args.modified_after) {
        const date = new Date(args.modified_after);
        notes = notes.filter(n => n.modifiedAt > date);
      }

      // Sort
      if (args.sort_by === 'modified') {
        notes.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
      } else if (args.sort_by === 'created') {
        notes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      } else if (args.sort_by === 'title') {
        notes.sort((a, b) => a.title.localeCompare(b.title));
      }

      return notes.map(n => ({
        path: n.path,
        title: n.title,
        tags: n.tags,
        modifiedAt: n.modifiedAt,
      }));
    },

    get_structure: async () => {
      return indexer.getStructure();
    },

    get_backlinks: async (args: { path: string }) => {
      const backlinks = indexer.getBacklinks(args.path);
      return { path: args.path, backlinks };
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/tools/read.ts
git commit -m "feat: implement read tools (search, read, list, structure, backlinks)"
```

---

## Task 9: Write Tools

**Files:**
- Create: `src/tools/write.ts`

**Step 1: Implement write tools**

```typescript
import { Vault } from '../vault.js';
import { parseFrontmatter, updateFrontmatter, extractHeadings } from '../utils/markdown.js';
import matter from 'gray-matter';

export function createWriteTools(vault: Vault) {
  return {
    create_note: async (args: {
      path: string;
      content: string;
      tags?: string[];
      frontmatter?: Record<string, any>;
    }) => {
      let finalContent = args.content;

      // Add frontmatter if provided
      if (args.frontmatter || args.tags) {
        const fm = args.frontmatter || {};
        if (args.tags) {
          fm.tags = args.tags;
        }
        finalContent = matter.stringify(args.content, fm);
      }

      await vault.createNote(args.path, finalContent);
      return { path: args.path, created: true };
    },

    edit_note: async (args: {
      path: string;
      content?: string;
      append?: string;
      section?: string;
    }) => {
      if (args.content) {
        // Full content replacement
        await vault.editNote(args.path, args.content);
      } else if (args.append) {
        // Append to end
        const { content } = await vault.readNote(args.path);
        const newContent = content + '\n\n' + args.append;
        await vault.editNote(args.path, newContent);
      } else if (args.section) {
        // Replace specific section
        const { content } = await vault.readNote(args.path);
        const { frontmatter, content: body } = parseFrontmatter(content);

        // Find the section to replace
        const headingRegex = new RegExp(`^#{1,6}\\s+${args.section}\\s*$`, 'gm');
        const match = headingRegex.exec(body);

        if (!match) {
          throw new Error(`Section "${args.section}" not found`);
        }

        // Find next heading or end of file
        const startIdx = match.index;
        const afterHeading = body.slice(startIdx + match[0].length);
        const nextHeadingMatch = /^#{1,6}\s+/gm.exec(afterHeading);
        const endIdx = nextHeadingMatch
          ? startIdx + match[0].length + nextHeadingMatch.index
          : body.length;

        const before = body.slice(0, startIdx);
        const after = body.slice(endIdx);
        const newBody = before + match[0] + '\n\n' + (args.content || '') + '\n\n' + after;

        const newContent = matter.stringify(newBody, frontmatter);
        await vault.editNote(args.path, newContent);
      } else {
        throw new Error('Must provide content, append, or section');
      }

      return { path: args.path, edited: true };
    },

    update_frontmatter: async (args: {
      path: string;
      frontmatter: Record<string, any>;
    }) => {
      const { content } = await vault.readNote(args.path);
      const newContent = updateFrontmatter(content, args.frontmatter);
      await vault.editNote(args.path, newContent);
      return { path: args.path, updated: true };
    },

    delete_note: async (args: { path: string }) => {
      await vault.deleteNote(args.path);
      return { path: args.path, deleted: true, location: '.trash' };
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/tools/write.ts
git commit -m "feat: implement write tools (create, edit, update_frontmatter, delete)"
```

---

## Task 10: Organize Tools

**Files:**
- Create: `src/tools/organize.ts`

**Step 1: Implement organize tools**

```typescript
import * as path from 'path';
import * as fs from 'fs/promises';
import { Vault } from '../vault.js';
import { Indexer } from '../indexer.js';
import { updateWikilinks } from '../utils/links.js';
import { validatePath, ensureMarkdownExtension } from '../utils/path-security.js';

export function createOrganizeTools(vault: Vault, indexer: Indexer, vaultPath: string) {
  return {
    move_note: async (args: { path: string; new_path: string }) => {
      const oldPath = args.path;
      const newPath = args.new_path;

      // Read content before moving
      const { content } = await vault.readNote(oldPath);

      // Create new note
      await vault.createNote(newPath, content);

      // Update all wikilinks in other notes
      const allNotes = indexer.getAllNotes();
      for (const metadata of allNotes) {
        if (metadata.path === oldPath) continue;

        const { content: noteContent } = await vault.readNote(metadata.path);
        const updatedContent = updateWikilinks(noteContent, oldPath, newPath);

        if (updatedContent !== noteContent) {
          await vault.editNote(metadata.path, updatedContent);
        }
      }

      // Delete old note
      await vault.deleteNote(oldPath);

      return { from: oldPath, to: newPath, moved: true };
    },

    add_links: async (args: {
      source_path: string;
      targets: string[];
      context?: string;
    }) => {
      const { content } = await vault.readNote(args.source_path);

      // Generate link text
      const linkLines = args.targets.map(target => {
        const linkText = target.replace(/\.md$/, '');
        return `- [[${linkText}]]`;
      });

      let linksSection = '\n\n## Links\n\n' + linkLines.join('\n');

      if (args.context) {
        linksSection = '\n\n' + args.context + '\n\n' + linkLines.join('\n');
      }

      const newContent = content + linksSection;
      await vault.editNote(args.source_path, newContent);

      return { path: args.source_path, links_added: args.targets.length };
    },

    suggest_structure: async () => {
      const structure = indexer.getStructure();
      const allNotes = indexer.getAllNotes();

      // Find orphaned notes (no backlinks, no outgoing links)
      const orphaned = allNotes.filter(n => {
        const backlinks = indexer.getBacklinks(n.path);
        return backlinks.length === 0 && n.outgoingLinks.length === 0;
      });

      // Suggest folder structure based on tags
      const tagFolders = new Map<string, string[]>();
      for (const note of allNotes) {
        for (const tag of note.tags) {
          if (!tagFolders.has(tag)) {
            tagFolders.set(tag, []);
          }
          tagFolders.get(tag)!.push(note.path);
        }
      }

      // Find notes without tags
      const untagged = allNotes.filter(n => n.tags.length === 0);

      return {
        current_structure: structure,
        orphaned_notes: orphaned.map(n => n.path),
        untagged_notes: untagged.map(n => n.path),
        suggested_folders: Array.from(tagFolders.entries()).map(([tag, notes]) => ({
          folder: tag,
          notes,
          count: notes.length,
        })),
        suggestions: [
          orphaned.length > 0 ? `Found ${orphaned.length} orphaned notes - consider linking or deleting them` : null,
          untagged.length > 0 ? `Found ${untagged.length} untagged notes - consider adding tags for organization` : null,
          structure.stats.totalFolders === 0 ? 'Consider organizing notes into folders by topic or project' : null,
        ].filter(Boolean),
      };
    },

    apply_template: async (args: { path: string; template_name: string }) => {
      // Read template from _templates folder
      const templatePath = `_templates/${args.template_name}.md`;
      const exists = await vault.fileExists(templatePath);

      if (!exists) {
        throw new Error(`Template not found: ${args.template_name}`);
      }

      const { content: templateContent } = await vault.readNote(templatePath);

      // Check if target note exists
      const targetExists = await vault.fileExists(args.path);

      if (targetExists) {
        // Append template to existing note
        const { content } = await vault.readNote(args.path);
        const newContent = content + '\n\n' + templateContent;
        await vault.editNote(args.path, newContent);
      } else {
        // Create new note with template
        await vault.createNote(args.path, templateContent);
      }

      return { path: args.path, template: args.template_name, applied: true };
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/tools/organize.ts
git commit -m "feat: implement organize tools (move, add_links, suggest_structure, apply_template)"
```

---

## Task 11: MCP Server Setup

**Files:**
- Create: `src/index.ts`

**Step 1: Create MCP server with all tools**

```typescript
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Vault } from './vault.js';
import { Indexer } from './indexer.js';
import { createReadTools } from './tools/read.js';
import { createWriteTools } from './tools/write.js';
import { createOrganizeTools } from './tools/organize.js';

const VAULT_PATH = process.env.VAULT_PATH;

if (!VAULT_PATH) {
  console.error('Error: VAULT_PATH environment variable is required');
  process.exit(1);
}

const vault = new Vault({ path: VAULT_PATH });
const indexer = new Indexer(vault, VAULT_PATH);

const server = new Server(
  {
    name: 'obsidian-connector',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Initialize indexer
await indexer.initialize();

// Create all tools
const readTools = createReadTools(vault, indexer);
const writeTools = createWriteTools(vault);
const organizeTools = createOrganizeTools(vault, indexer, VAULT_PATH);

const tools = {
  ...readTools,
  ...writeTools,
  ...organizeTools,
};

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Read tools
      {
        name: 'search_notes',
        description: 'Search notes by text query with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
            folder: { type: 'string', description: 'Filter by folder path' },
            limit: { type: 'number', description: 'Max results (default 10)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'read_note',
        description: 'Read a single note with all metadata',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to note (relative to vault)' },
          },
          required: ['path'],
        },
      },
      {
        name: 'list_notes',
        description: 'List and filter notes',
        inputSchema: {
          type: 'object',
          properties: {
            folder: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            has_links_to: { type: 'string' },
            modified_after: { type: 'string' },
            sort_by: { type: 'string', enum: ['modified', 'created', 'title'] },
          },
        },
      },
      {
        name: 'get_structure',
        description: 'Get vault structure overview',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_backlinks',
        description: 'Get all notes that link to a specific note',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
          },
          required: ['path'],
        },
      },
      // Write tools
      {
        name: 'create_note',
        description: 'Create a new note',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            frontmatter: { type: 'object' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'edit_note',
        description: 'Edit existing note (full content, append, or section)',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
            append: { type: 'string' },
            section: { type: 'string' },
          },
          required: ['path'],
        },
      },
      {
        name: 'update_frontmatter',
        description: 'Update note frontmatter/metadata',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            frontmatter: { type: 'object' },
          },
          required: ['path', 'frontmatter'],
        },
      },
      {
        name: 'delete_note',
        description: 'Delete note (moves to .trash folder)',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
          },
          required: ['path'],
        },
      },
      // Organize tools
      {
        name: 'move_note',
        description: 'Move/rename note and update all wikilinks',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            new_path: { type: 'string' },
          },
          required: ['path', 'new_path'],
        },
      },
      {
        name: 'add_links',
        description: 'Add wikilinks to a note',
        inputSchema: {
          type: 'object',
          properties: {
            source_path: { type: 'string' },
            targets: { type: 'array', items: { type: 'string' } },
            context: { type: 'string' },
          },
          required: ['source_path', 'targets'],
        },
      },
      {
        name: 'suggest_structure',
        description: 'Analyze vault and suggest organizational improvements',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'apply_template',
        description: 'Apply a template to a note',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            template_name: { type: 'string' },
          },
          required: ['path', 'template_name'],
        },
      },
    ],
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!(name in tools)) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await (tools as any)[name](args || {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// List resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const notes = indexer.getAllNotes();

  return {
    resources: [
      {
        uri: 'obsidian://structure',
        name: 'Vault Structure',
        mimeType: 'application/json',
        description: 'Overview of vault structure, tags, and statistics',
      },
      ...notes.map(note => ({
        uri: `obsidian://note/${note.path}`,
        name: note.title,
        mimeType: 'text/markdown',
        description: `Note: ${note.title}`,
      })),
    ],
  };
});

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri === 'obsidian://structure') {
    const structure = indexer.getStructure();
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(structure, null, 2),
        },
      ],
    };
  }

  if (uri.startsWith('obsidian://note/')) {
    const notePath = uri.replace('obsidian://note/', '');
    const { content } = await vault.readNote(notePath);
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: content,
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('Obsidian Connector MCP server running');

// Cleanup on exit
process.on('SIGINT', async () => {
  await indexer.shutdown();
  process.exit(0);
});
```

**Step 2: Make executable**

Run: `chmod +x dist/index.js` (after build)

**Step 3: Build**

Run: `npm run build`

**Step 4: Test locally**

Run: `VAULT_PATH=/tmp/test-vault node dist/index.js`

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: add MCP server with all tools and resources"
```

---

## Task 12: Documentation & Publishing

**Files:**
- Modify: `README.md`
- Create: `CHANGELOG.md`
- Create: `LICENSE`

**Step 1: Update README with full documentation**

```markdown
# Obsidian Connector

MCP server to connect Claude (Code + Desktop) bidirectionally with Obsidian vaults.

## Features

### Read (5 tools)
- **search_notes** - Full-text search with filtering
- **read_note** - Read single note with metadata
- **list_notes** - List and filter notes
- **get_structure** - Vault overview and statistics
- **get_backlinks** - Find notes linking to a note

### Write (4 tools)
- **create_note** - Create new notes
- **edit_note** - Edit notes (full/append/section)
- **update_frontmatter** - Update metadata
- **delete_note** - Soft delete to .trash

### Organize (4 tools)
- **move_note** - Move/rename with link updates
- **add_links** - Add wikilinks between notes
- **suggest_structure** - Get organizational suggestions
- **apply_template** - Apply templates from _templates/

### Resources
- `obsidian://structure` - Vault overview
- `obsidian://note/{path}` - Individual notes

## Installation

```bash
npm install -g obsidian-connector
```

Or use directly with npx:

```bash
npx obsidian-connector
```

## Configuration

Add to your Claude MCP settings (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["obsidian-connector"],
      "env": {
        "VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

For Claude Code, add to `~/.claude/config.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["obsidian-connector"],
      "env": {
        "VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

## Security

- Only accesses files within configured vault path
- Path traversal protection
- Soft delete (moves to .trash instead of permanent deletion)
- No network connections

## License

MIT
```

**Step 2: Create CHANGELOG**

```markdown
# Changelog

## [0.1.0] - 2026-02-01

### Added
- Initial release
- 5 read tools (search, read, list, structure, backlinks)
- 4 write tools (create, edit, update_frontmatter, delete)
- 4 organize tools (move, add_links, suggest_structure, apply_template)
- MCP resources for notes and vault structure
- In-memory indexing with file watcher
- Path security and soft delete
```

**Step 3: Create LICENSE**

```
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Step 4: Commit**

```bash
git add README.md CHANGELOG.md LICENSE
git commit -m "docs: add documentation, changelog, and license"
```

**Step 5: Publish to npm**

Run: `npm publish`

---

## Summary

**Total Tasks:** 12

**Deliverables:**
- TypeScript MCP server package
- 13 tools (5 read, 4 write, 4 organize)
- 2 resource types
- In-memory indexing with file watcher
- Path security and validation
- Full documentation

**Testing:** Manual testing with a test vault after each major component

**Next Steps:**
- Publish to npm
- Create example vault for testing
- Add integration tests
- Consider optional SQLite caching for large vaults
