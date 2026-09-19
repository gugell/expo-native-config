import { ERR } from '../core';
import type { SourceInjectionSpec } from './types';

/**
 * Inserts `lines` after the last line matching `afterLast`, wrapped in a tagged
 * comment block so a second prebuild replaces the block instead of appending a
 * second copy. Returns the original contents when the block is already current.
 */
export function injectBlock(
  contents: string,
  options: {
    tag: string;
    lines: string[];
    afterLast: RegExp;
    comment: string;
    indent?: string;
    label: string;
  },
): string {
  const { tag, lines, afterLast, comment, indent = '', label } = options;
  if (lines.length === 0) {
    return removeBlock(contents, tag, comment);
  }
  const begin = `${indent}${comment} @generated begin ${tag}`;
  const end = `${indent}${comment} @generated end ${tag}`;
  const block = [begin, ...lines.map((line) => `${indent}${line}`), end].join('\n');

  const existing = findBlock(contents, tag, comment);
  if (existing) {
    return contents.slice(0, existing.start) + block + contents.slice(existing.end);
  }

  const matches = [...contents.matchAll(new RegExp(afterLast.source, `${afterLast.flags}g`))];
  const anchor = matches[matches.length - 1];
  if (!anchor || anchor.index === undefined) {
    throw new Error(
      `${ERR} ${label}: no anchor matching /${afterLast.source}/ in the source file.`,
    );
  }
  const insertAt = anchor.index + anchor[0].length;
  return `${contents.slice(0, insertAt)}\n${block}${contents.slice(insertAt)}`;
}

export function removeBlock(contents: string, tag: string, comment: string): string {
  const existing = findBlock(contents, tag, comment);
  if (!existing) {
    return contents;
  }
  const before = contents.slice(0, existing.start).replace(/\n+$/, '\n');
  return before + contents.slice(existing.end).replace(/^\n/, '');
}

function findBlock(
  contents: string,
  tag: string,
  comment: string,
): { start: number; end: number } | undefined {
  const beginIndex = contents.indexOf(`${comment} @generated begin ${tag}`);
  if (beginIndex === -1) {
    return undefined;
  }
  const endMarker = `${comment} @generated end ${tag}`;
  const endIndex = contents.indexOf(endMarker, beginIndex);
  if (endIndex === -1) {
    return undefined;
  }
  const lineStart = contents.lastIndexOf('\n', beginIndex) + 1;
  return { start: lineStart, end: endIndex + endMarker.length };
}

export function hasLines(spec: SourceInjectionSpec | undefined): boolean {
  return Boolean(spec && ((spec.imports?.length ?? 0) > 0 || (spec.body?.length ?? 0) > 0));
}
