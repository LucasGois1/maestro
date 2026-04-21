/** ANSI-free diff line styling for Ink (`no-color` falls back to plain text). */
export function diffLineInkProps(
  line: string,
  useColor: boolean,
): { readonly color?: string; readonly dimColor?: boolean } {
  if (!useColor) {
    return {};
  }
  const t = line.trimStart();
  if (t.startsWith('+') && !t.startsWith('+++')) {
    return { color: 'green' };
  }
  if (t.startsWith('-') && !t.startsWith('---')) {
    return { color: 'red' };
  }
  if (t.startsWith('@@')) {
    return { color: 'cyan' };
  }
  return { dimColor: true };
}

export function sliceDiffWindow(
  unifiedDiff: string,
  scrollTop: number,
  viewportLines: number,
): { readonly lines: readonly string[]; readonly totalLines: number } {
  const lines = unifiedDiff.split('\n');
  const totalLines = lines.length;
  const start = Math.max(0, Math.min(scrollTop, Math.max(0, totalLines - 1)));
  const end = Math.min(totalLines, start + viewportLines);
  return { lines: lines.slice(start, end), totalLines };
}
