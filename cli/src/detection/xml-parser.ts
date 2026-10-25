export interface XmlElement {
  tag: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  text?: string;
}

const CDATA_PLACEHOLDER_PREFIX = "\x00CDATA_";
const CDATA_PLACEHOLDER_SUFFIX = "\x00";

function extractCdataSections(content: string): { processed: string; sections: Map<string, string> } {
  const sections = new Map<string, string>();
  let counter = 0;
  const processed = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_match, inner: string) => {
    const key = `${CDATA_PLACEHOLDER_PREFIX}${counter++}${CDATA_PLACEHOLDER_SUFFIX}`;
    sections.set(key, inner);
    return key;
  });
  return { processed, sections };
}

function restoreCdataSections(text: string, sections: Map<string, string>): string {
  let result = text;
  for (const [key, value] of sections) {
    result = result.replace(key, value);
  }
  return result;
}

function restoreCdataInTree(elem: XmlElement, sections: Map<string, string>): void {
  if (elem.text !== undefined) {
    elem.text = restoreCdataSections(elem.text, sections);
  }
  for (const child of elem.children) {
    restoreCdataInTree(child, sections);
  }
}

export function parseSimpleXml(content: string): XmlElement {
  const root: XmlElement = { tag: "root", attributes: {}, children: [] };
  const stack: XmlElement[] = [root];

  const { processed, sections } = extractCdataSections(content);

  const tagRegex = /<\/?([a-zA-Z_][\w.:-]*)(?:\s+[^>]*?)?\s*\/?>/g;
  let lastIndex = 0;
  let match;

  while ((match = tagRegex.exec(processed)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1];
    const matchStart = match.index;

    if (!tagName) continue;

    const textBetween = processed.substring(lastIndex, matchStart).trim();
    if (textBetween && stack.length > 1) {
      const parent = stack[stack.length - 1];
      if (parent) {
        parent.text = (parent.text ? parent.text + " " : "") + textBetween;
      }
    }
    lastIndex = matchStart + fullMatch.length;

    if (fullMatch.startsWith("</")) {
      if (stack.length > 1) {
        stack.pop();
      }
    } else if (fullMatch.endsWith("/>")) {
      const parent = stack[stack.length - 1];
      if (parent) {
        const elem = parseTag(fullMatch, tagName);
        parent.children.push(elem);
      }
    } else {
      const parent = stack[stack.length - 1];
      if (parent) {
        const elem = parseTag(fullMatch, tagName);
        parent.children.push(elem);
        stack.push(elem);
      }
    }
  }

  const remainingText = processed.substring(lastIndex).trim();
  if (remainingText && stack.length > 1) {
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.text = (parent.text ? parent.text + " " : "") + remainingText;
    }
  }

  if (sections.size > 0) {
    restoreCdataInTree(root, sections);
  }

  return root;
}

function parseTag(tagStr: string, tagName: string): XmlElement {
  const elem: XmlElement = { tag: tagName, attributes: {}, children: [] };

  const attrRegex = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let attrMatch;
  while ((attrMatch = attrRegex.exec(tagStr)) !== null) {
    const key = attrMatch[1];
    const value = attrMatch[2] ?? attrMatch[3];
    if (key !== undefined && value !== undefined) {
      elem.attributes[key] = value;
    }
  }

  return elem;
}

export function findElements(root: XmlElement, tagName: string): XmlElement[] {
  const results: XmlElement[] = [];

  function search(elem: XmlElement): void {
    if (elem.tag === tagName) {
      results.push(elem);
    }
    for (const child of elem.children) {
      search(child);
    }
  }

  search(root);
  return results;
}

export function getTextContent(elem: XmlElement): string {
  return elem.text ?? "";
}


