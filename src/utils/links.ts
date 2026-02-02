export function extractWikilinks(content: string): string[] {
  const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;

  while ((match = wikilinkRegex.exec(content)) !== null) {
    // Handle [[link|alias]] format
    const linkText = match[1].split('|')[0].trim();
    links.push(linkText);
  }

  return links;
}

export function updateWikilinks(
  content: string,
  oldPath: string,
  newPath: string
): string {
  // Convert paths to link format (without .md extension)
  const oldLink = oldPath.replace(/\.md$/, '');
  const newLink = newPath.replace(/\.md$/, '');

  // Update [[oldPath]] and [[oldPath|alias]] formats
  const regex = new RegExp(`\\[\\[${escapeRegex(oldLink)}(\\|[^\\]]+)?\\]\\]`, 'g');
  return content.replace(regex, (match, alias) => {
    return `[[${newLink}${alias || ''}]]`;
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
