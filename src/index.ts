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
