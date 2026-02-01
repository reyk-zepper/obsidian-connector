# Obsidian Connector

MCP server to connect Claude (Code + Desktop) with Obsidian vaults.

## Installation

```bash
npx obsidian-connector
```

## Configuration

Add to your Claude MCP settings:

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

## Features

- **Read**: Search, read, list notes, get vault structure, get backlinks
- **Write**: Create, edit, update frontmatter, delete notes
- **Organize**: Move notes, add links, suggest structure, apply templates
