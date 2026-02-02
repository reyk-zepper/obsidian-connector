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
