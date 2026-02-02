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
