export interface VaultConfig {
  path: string;
}

export interface NoteMetadata {
  path: string;
  title: string;
  tags: string[];
  frontmatter: Record<string, unknown>;
  outgoingLinks: string[];
  headings: string[];
  modifiedAt: string;
  createdAt: string;
}

export interface SearchResult {
  path: string;
  title: string;
  score: number;
  preview: string;
}

export interface VaultStructure {
  folders: string[];
  tags: Record<string, number>;
  topLinks: Array<{ target: string; count: number }>;
  stats: {
    totalNotes: number;
    totalFolders: number;
    totalTags: number;
  };
}
