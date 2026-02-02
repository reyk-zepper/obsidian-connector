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
