# Obsidian Connector – MCP Server Design

## Überblick

Ein MCP-Server als npm-Paket (`npx obsidian-connector`), der Claude (Code + Desktop) bidirektional mit jedem Obsidian-Vault verbindet. Ziel ist ein öffentliches Produkt, das jeder nutzen kann – unabhängig von der bestehenden Vault-Struktur.

## Architektur

- TypeScript MCP-Server mit direktem Dateisystem-Zugriff
- Vault-Pfad wird über Umgebungsvariable konfiguriert
- In-Memory-Index mit File-Watcher für Echtzeit-Aktualisierung
- Keine Netzwerkverbindungen – alles lokal

### Konfiguration

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["obsidian-connector"],
      "env": {
        "VAULT_PATH": "/pfad/zum/vault"
      }
    }
  }
}
```

## MCP Tools

### Lesen (5 Tools)

**`search_notes`** – Volltextsuche über alle Notizen
- Parameter: `query`, optional `tags`, `folder`, `limit`
- Durchsucht Titel, Inhalt und Frontmatter
- Gibt Treffer mit Pfad, Titel, Relevanz-Score und Vorschau zurück

**`read_note`** – Einzelne Notiz lesen
- Parameter: `path`
- Gibt vollständigen Inhalt inkl. Frontmatter und Metadaten zurück (Tags, Links, Backlinks)

**`list_notes`** – Notizen auflisten/filtern
- Parameter: optional `folder`, `tags`, `has_links_to`, `modified_after`, `sort_by`

**`get_structure`** – Vault-Überblick
- Keine Parameter
- Gibt Ordnerstruktur, Tag-Übersicht, häufigste Links und Statistiken zurück

**`get_backlinks`** – Backlinks einer Notiz
- Parameter: `path`

### Schreiben (4 Tools)

**`create_note`** – Neue Notiz erstellen
- Parameter: `path`, `content`, optional `tags`, `frontmatter`
- Erstellt Unterordner automatisch
- Fehler wenn Datei bereits existiert (kein stilles Überschreiben)

**`edit_note`** – Bestehende Notiz bearbeiten
- Parameter: `path`, `content` (Vollinhalt) oder `append` (Text anhängen)
- Optional: `section` – nur einen Abschnitt (nach Heading) ersetzen

**`update_frontmatter`** – Metadaten ändern
- Parameter: `path`, `frontmatter` (Key-Value-Paare)

**`delete_note`** – Notiz löschen
- Parameter: `path`
- Verschiebt in `.trash`-Ordner statt endgültig zu löschen

### Organisieren (4 Tools)

**`move_note`** – Notiz verschieben/umbenennen
- Parameter: `path`, `new_path`
- Aktualisiert automatisch alle internen Links in anderen Notizen

**`add_links`** – Links zwischen Notizen setzen
- Parameter: `source_path`, `targets`
- Optional: `context` – Begründung für den Link

**`suggest_structure`** – Strukturvorschläge generieren
- Analysiert den Vault und schlägt vor: Ordnerstruktur, Tags, Verlinkungen, verwaiste Notizen
- Gibt nur Vorschläge zurück, ändert nichts automatisch

**`apply_template`** – Template anwenden
- Parameter: `path`, `template_name`
- Templates aus `_templates/`-Ordner im Vault

## MCP Resources

- `obsidian://note/{path}` – Einzelne Notizen als Ressource
- `obsidian://structure` – Vault-Überblick als statische Ressource

## Indexierung & Performance

### Beim Start
- Vault wird gescannt, In-Memory-Index aufgebaut
- Indexiert: Dateipfade, Titel, Tags, Frontmatter, Wikilinks, Headings
- Volltext wird nicht indexiert – Volltextsuche läuft on-demand

### Laufend
- File-Watcher (`chokidar`) überwacht Änderungen
- Nur geänderte Dateien werden neu indexiert

### Index-Struktur
```
Map<pfad, {
  title, tags, frontmatter,
  outgoing_links, headings,
  modified_at, created_at
}>
```
- Backlinks als umgekehrter Index abgeleitet
- Separate Maps für Tags und Links

### Skalierung
- Bis ~10.000 Notizen im Speicher
- Für größere Vaults: optional SQLite als persistenter Cache

## Sicherheit

- Zugriff ausschließlich innerhalb des konfigurierten Vault-Pfads
- Path-Traversal-Schutz: `../`-Pfade werden abgelehnt
- Symlinks außerhalb des Vaults werden nicht gefolgt
- Soft-Delete statt endgültigem Löschen
- Keine Netzwerkverbindungen

## Paketstruktur

```
obsidian-connector/
├── src/
│   ├── index.ts          # MCP-Server Setup & Startup
│   ├── vault.ts          # Dateisystem-Zugriff & Vault-Abstraktion
│   ├── indexer.ts         # Index-Aufbau & File-Watcher
│   ├── tools/
│   │   ├── read.ts        # search, read, list, structure, backlinks
│   │   ├── write.ts       # create, edit, update_frontmatter, delete
│   │   └── organize.ts    # move, add_links, suggest, apply_template
│   └── utils/
│       ├── markdown.ts    # Frontmatter-Parsing, Heading-Extraktion
│       └── links.ts       # Wikilink-Parsing & -Aktualisierung
├── package.json
├── tsconfig.json
└── README.md
```

## Dependencies

- `@modelcontextprotocol/sdk` – MCP-Protokoll
- `chokidar` – File-Watcher
- `gray-matter` – Frontmatter-Parsing

Minimal gehalten, so wenig externe Abhängigkeiten wie möglich.
