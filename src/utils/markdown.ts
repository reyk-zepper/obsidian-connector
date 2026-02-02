import matter from 'gray-matter';

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  content: string;
  tags: string[];
} {
  try {
    const { data, content: body } = matter(content);

    // Extract tags from frontmatter
    const tags = new Set<string>();
    if (data.tags) {
      if (Array.isArray(data.tags)) {
        data.tags.forEach(tag => {
          if (typeof tag === 'string') {
            tags.add(tag);
          }
        });
      } else if (typeof data.tags === 'string') {
        tags.add(data.tags);
      }
    }

    return {
      frontmatter: data,
      content: body,
      tags: Array.from(tags),
    };
  } catch (error) {
    // If frontmatter parsing fails, return empty frontmatter and original content
    return {
      frontmatter: {},
      content: content,
      tags: [],
    };
  }
}

export function extractHeadings(content: string): string[] {
  // Parse frontmatter first to work only on body content
  const { content: body } = parseFrontmatter(content);

  // Updated regex to handle trailing hashes like "## Heading ##"
  const headingRegex = /^#{1,6}\s+(.+?)(?:\s+#{1,6})?\s*$/gm;
  const headings: string[] = [];
  let match;

  while ((match = headingRegex.exec(body)) !== null) {
    headings.push(match[1].trim());
  }

  return headings;
}

export function updateFrontmatter(
  content: string,
  updates: Record<string, unknown>
): string {
  try {
    const { data, content: body } = matter(content);
    const newData = { ...data, ...updates };
    return matter.stringify(body, newData);
  } catch (error) {
    // If parsing fails, return original content
    return content;
  }
}
