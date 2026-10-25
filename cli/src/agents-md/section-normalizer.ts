export const SECTION_SEPARATOR = "\n\n";

/** Escapes special regex characters in a string for safe use in a RegExp constructor. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface NormalizeSectionResult {
  result: string;
  action: "updated" | "unchanged" | "deduplicated";
}

function recoverOrphanedEnd(
  content: string,
  managedSection: string,
  endMarker: string,
  firstEndIndex: number,
  firstStart: number,
): NormalizeSectionResult {
  const orphanedEnd = firstEndIndex + endMarker.length;
  const sectionEnd = content.indexOf(endMarker, firstStart);
  if (sectionEnd === -1) {
    return appendSection(content, managedSection);
  }
  const afterOldSection = content.substring(sectionEnd + endMarker.length);
  const result = content.substring(0, firstEndIndex) + content.substring(orphanedEnd, firstStart) + managedSection + afterOldSection;
  return { result, action: "deduplicated" };
}

export function normalizeManagedSection(
  content: string,
  managedSection: string,
  startMarker: string,
  endMarker: string,
): NormalizeSectionResult {
  const startMarkerCount = (content.match(new RegExp(escapeRegExp(startMarker), "g")) || []).length;

  if (startMarkerCount > 1) {
    return deduplicateSections(content, managedSection, startMarker, endMarker);
  }

  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1) {
    if (endIndex < startIndex) {
      return recoverOrphanedEnd(content, managedSection, endMarker, endIndex, startIndex);
    }
    return replaceSection(content, managedSection, startIndex, endIndex, endMarker);
  }

  return appendSection(content, managedSection);
}

function deduplicateSections(
  content: string,
  managedSection: string,
  startMarker: string,
  endMarker: string,
): NormalizeSectionResult {
  const firstStart = content.indexOf(startMarker);
  const firstEndIndex = content.indexOf(endMarker);

  if (firstStart === -1 || firstEndIndex === -1) {
    return appendSection(content, managedSection);
  }

  let result: string;
  let searchFrom: number;

  if (firstEndIndex < firstStart) {
    const orphanedEnd = firstEndIndex + endMarker.length;
    const sectionEnd = content.indexOf(endMarker, firstStart);
    if (sectionEnd === -1) {
      return appendSection(content, managedSection);
    }
    result = content.substring(0, firstEndIndex) + content.substring(orphanedEnd, firstStart) + managedSection;
    searchFrom = sectionEnd + endMarker.length;
  } else {
    result = content.substring(0, firstStart) + managedSection;
    searchFrom = firstEndIndex + endMarker.length;
  }

  let pos = searchFrom;
  while (pos < content.length) {
    const nextStart = content.indexOf(startMarker, pos);
    if (nextStart === -1) {
      result += content.substring(pos);
      break;
    }

    const nextEnd = content.indexOf(endMarker, nextStart);
    if (nextEnd === -1) {
      result += content.substring(pos);
      break;
    }

    result += content.substring(pos, nextStart);
    pos = nextEnd + endMarker.length;
  }

  return { result, action: "deduplicated" };
}

function replaceSection(
  content: string,
  managedSection: string,
  startIndex: number,
  endIndex: number,
  endMarker: string,
): NormalizeSectionResult {
  const sectionEnd = endIndex + endMarker.length;
  const existingSection = content.substring(startIndex, sectionEnd);

  if (existingSection === managedSection) {
    return { result: content, action: "unchanged" };
  }

  const before = content.substring(0, startIndex);
  const after = content.substring(sectionEnd);
  return { result: before + managedSection + after, action: "updated" };
}

function appendSection(content: string, managedSection: string): NormalizeSectionResult {
  return { result: managedSection + SECTION_SEPARATOR + content.trimStart(), action: "updated" };
}
