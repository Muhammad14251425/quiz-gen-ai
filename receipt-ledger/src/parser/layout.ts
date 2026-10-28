import type { OcrBlock, OcrFrame, OcrLine } from './types';

interface PositionedLine {
  text: string;
  frame: OcrFrame;
}

/**
 * ML Kit returns two-column receipts ("Amount ........ Rs 500") as separate
 * blocks for the label column and the value column. Rebuild visual rows by
 * clustering lines whose vertical centers overlap, then join each row left to
 * right so "Label Value" ends up on one line like a human would read it.
 * Returns null when the blocks carry no geometry.
 */
export function textFromBlocks(blocks: OcrBlock[] | undefined): string | null {
  if (!blocks || blocks.length === 0) return null;
  const lines: PositionedLine[] = [];
  for (const block of blocks) {
    const blockLines: OcrLine[] = block.lines?.length ? block.lines : [{ text: block.text, frame: block.frame }];
    for (const line of blockLines) {
      if (!line.frame || !line.text.trim()) return null;
      lines.push({ text: line.text.trim(), frame: line.frame });
    }
  }
  if (lines.length === 0) return null;

  lines.sort((a, b) => a.frame.y + a.frame.height / 2 - (b.frame.y + b.frame.height / 2));
  const rows: PositionedLine[][] = [];
  for (const line of lines) {
    const center = line.frame.y + line.frame.height / 2;
    const row = rows[rows.length - 1];
    if (row) {
      const ref = row[0].frame;
      const refCenter = ref.y + ref.height / 2;
      const tolerance = Math.min(ref.height, line.frame.height) * 0.55;
      if (Math.abs(center - refCenter) <= tolerance) {
        row.push(line);
        continue;
      }
    }
    rows.push([line]);
  }
  return rows
    .map((row) =>
      row
        .sort((a, b) => a.frame.x - b.frame.x)
        .map((l) => l.text)
        .join(' '),
    )
    .join('\n');
}
