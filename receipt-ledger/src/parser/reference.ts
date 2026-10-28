/** Reference labels in priority order (a Transaction ID beats an RRN beats a STAN). */
const BASE_LABELS = [
  'transaction id',
  'transaction no',
  'trans id',
  'trx id',
  'trxid',
  'txn id',
  'txnid',
  'tid',
  'transaction reference',
  'transaction ref',
  'reference no',
  'reference number',
  'reference',
  'ref no',
  'ref',
  'tracking id',
  'receipt no',
  'rrn',
  'stan',
];

const VALUE_RE = /^[#:\-–\s]*([A-Za-z0-9][A-Za-z0-9\-/]{3,40})/;

function escapeLabel(label: string): string {
  return label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/ /g, '\\s*');
}

function validValue(v: string): boolean {
  return /\d/.test(v) && v.replace(/[^A-Za-z0-9]/g, '').length >= 5;
}

export interface ReferenceExtraction {
  reference?: string;
  confidence: number;
}

export function extractReference(lines: string[], extraLabels: string[] = []): ReferenceExtraction {
  const labels = [...extraLabels, ...BASE_LABELS];
  let best: { value: string; priority: number; confidence: number } | undefined;

  lines.forEach((line, i) => {
    labels.forEach((label, priority) => {
      if (best && best.priority <= priority) return;
      const re = new RegExp(`(?:^|[^A-Za-z])${escapeLabel(label)}(?![A-Za-z])(.*)$`, 'i');
      const m = re.exec(line);
      if (!m) return;
      let rest = m[1];
      let confidence = 0.9;
      if (!/[A-Za-z0-9]/.test(rest) && lines[i + 1]) {
        rest = lines[i + 1];
        confidence = 0.8;
      }
      const v = VALUE_RE.exec(rest);
      if (!v) return;
      const value = v[1].replace(/[-/]+$/, '');
      if (!validValue(value)) return;
      best = { value, priority, confidence };
    });
  });

  return best ? { reference: best.value, confidence: best.confidence } : { confidence: 0 };
}
