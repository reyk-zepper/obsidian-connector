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
