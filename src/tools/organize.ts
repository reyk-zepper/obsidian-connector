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
