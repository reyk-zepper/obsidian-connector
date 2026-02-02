export function extractWikilinks(content: string): string[] {
  // Input validation
  if (!content) {
    return [];
  }

  const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;

  while ((match = wikilinkRegex.exec(content)) !== null) {
    // Handle [[link|alias]] and [[link#heading]] and [[link#^block]] formats
    const linkText = match[1].split('|')[0].split('#')[0].trim();

    // Skip empty links
    if (!linkText) continue;

    // Normalize to .md extension
    links.push(linkText.endsWith('.md') ? linkText : linkText + '.md');
  }

  return links;
}

export function updateWikilinks(
  content: string,
  oldPath: string,
  newPath: string
): string {
  // Input validation
  if (!content || !oldPath || !newPath) {
    return content || '';
  }

  // Convert paths to link format (without .md extension)
  const oldLink = oldPath.replace(/\.md$/, '');
  const newLink = newPath.replace(/\.md$/, '');

  // Update [[oldPath]], [[oldPath|alias]], [[oldPath#heading]], and [[oldPath#^block]] formats
  const regex = new RegExp(`\\[\\[${escapeRegex(oldLink)}(#[^\\]|]+)?(\\|[^\\]]+)?\\]\\]`, 'g');
  return content.replace(regex, (match, headingOrBlock, alias) => {
    return `[[${newLink}${headingOrBlock || ''}${alias || ''}]]`;
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
