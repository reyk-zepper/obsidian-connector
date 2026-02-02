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
