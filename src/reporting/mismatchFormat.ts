/**
 * Turn raw Pact verifier mismatch blobs into clear expected / actual text
 * for dashboards, Excel, and email.
 */

export type MismatchDetail = {
  path?: string;
  expected?: string;
  actual?: string;
  message?: string;
  type?: string;
};

export type ParsedMismatch = {
  /** Short human summary (1–2 lines) */
  summary: string;
  /** Compact expected column value */
  expected: string;
  /** Compact actual column value */
  actual: string;
  details: MismatchDetail[];
};

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function formatValue(value: unknown, maxLen = 280): string {
  if (value === undefined || value === null) return '—';
  const parsed = tryParseJson(value);
  let text: string;
  if (Array.isArray(parsed)) {
    text = parsed.map((v) => String(v)).join(', ');
  } else if (typeof parsed === 'object') {
    text = JSON.stringify(parsed, null, 0);
  } else {
    text = String(parsed);
  }
  if (text.length > maxLen) return `${text.slice(0, maxLen - 1)}…`;
  return text;
}

/** Parse a JSON string-array, including truncated `[\"a\",\"b\",\"par` blobs. */
function parseKeyList(raw: unknown): string[] | null {
  if (Array.isArray(raw) && raw.every((x) => typeof x === 'string')) {
    return raw as string[];
  }
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const parsed = tryParseJson(text);
  if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
    return parsed as string[];
  }
  // Truncated array: collect complete "key" tokens
  const keys: string[] = [];
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    try {
      keys.push(JSON.parse(`"${match[1]}"`));
    } catch {
      keys.push(match[1]);
    }
  }
  return keys.length ? keys : null;
}

function keyListDiff(expectedRaw: unknown, actualRaw: unknown): {
  expected: string;
  actual: string;
  summary: string;
} | null {
  const exp = parseKeyList(expectedRaw);
  const act = parseKeyList(actualRaw);
  if (!exp || !act) return null;
  const expSet = new Set(exp);
  const actSet = new Set(act);
  const missing = exp.filter((k) => !actSet.has(k));
  const extra = act.filter((k) => !expSet.has(k));
  const parts: string[] = [];
  if (missing.length) parts.push(`missing in response: ${missing.join(', ')}`);
  if (extra.length) parts.push(`extra in response: ${extra.join(', ')}`);
  return {
    expected: `keys: ${exp.join(', ')}`,
    actual: `keys: ${act.join(', ')}`,
    summary: parts.length ? parts.join(' · ') : 'key set differs',
  };
}

function normalizeMismatchEntry(entry: any): MismatchDetail {
  const path = entry?.path != null ? String(entry.path) : undefined;
  const type = entry?.type != null ? String(entry.type) : undefined;
  const message =
    entry?.mismatch != null
      ? String(entry.mismatch)
      : entry?.message != null
        ? String(entry.message)
        : undefined;

  const keyDiff = keyListDiff(entry?.expected, entry?.actual);
  if (keyDiff) {
    return {
      path: humanMismatchPath(path, type || 'BodyMismatch', true),
      expected: keyDiff.expected,
      actual: keyDiff.actual,
      message: message || keyDiff.summary,
      type,
    };
  }

  return {
    path: humanMismatchPath(
      path,
      type,
      false,
      entry?.expected !== undefined || entry?.actual !== undefined
    ),
    expected: entry?.expected !== undefined ? formatValue(entry.expected) : undefined,
    actual: entry?.actual !== undefined ? formatValue(entry.actual) : undefined,
    message,
    type,
  };
}

/** Turn Pact JSONPath (`$`, `$.foo`) into a readable Field/path label. */
export function humanMismatchPath(
  path?: string,
  type?: string,
  isKeyList = false,
  hasValues = false
): string {
  const raw = String(path || '').trim();
  const typeLower = String(type || '').toLowerCase();

  if (isKeyList || /key/i.test(String(path || ''))) {
    return 'Response body keys';
  }
  if (!raw || raw === '$' || raw === '$.' || raw === 'body' || raw === 'mismatch') {
    if (typeLower.includes('status')) return 'HTTP status';
    if (typeLower.includes('header')) return 'Response header';
    if (typeLower.includes('body') || hasValues) return 'Response body';
    return 'Response body';
  }
  if (raw.startsWith('$.')) return `Response body → ${raw.slice(2)}`;
  if (raw.startsWith('$[')) return `Response body → ${raw.slice(1)}`;
  if (raw.startsWith('$')) return `Response body → ${raw.slice(1) || '(root)'}`;
  return raw;
}

/** Pull a JSON string field even from truncated Pact mismatch blobs. */
function extractJsonStringField(text: string, field: 'expected' | 'actual'): string | undefined {
  const marker = `"${field}":"`;
  const start = text.indexOf(marker);
  if (start < 0) return undefined;
  let i = start + marker.length;
  let out = '';
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length) {
      out += ch + text[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') {
      try {
        return JSON.parse(`"${out}"`);
      } catch {
        return out.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
    }
    out += ch;
    i += 1;
  }
  // Truncated before closing quote — return partial unescaped value
  return out
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\$/, '')
    .replace(/,?\s*"$/, '');
}

function salvageTruncatedMismatch(text: string): ParsedMismatch | null {
  if (!text.includes('"mismatches"') && !text.includes('"expected"')) return null;
  const expectedRaw = extractJsonStringField(text, 'expected');
  const actualRaw = extractJsonStringField(text, 'actual');
  if (expectedRaw == null && actualRaw == null) return null;

  const keyDiff = keyListDiff(expectedRaw, actualRaw);
  if (keyDiff) {
    return {
      summary: keyDiff.summary,
      expected: keyDiff.expected,
      actual: keyDiff.actual,
      details: [
        {
          path: humanMismatchPath('$', 'BodyMismatch', true),
          expected: keyDiff.expected,
          actual: keyDiff.actual,
          message: keyDiff.summary,
          type: 'BodyMismatch',
        },
      ],
    };
  }

  const expected = expectedRaw != null ? formatValue(expectedRaw, 500) : 'Contract match';
  const actual = actualRaw != null ? formatValue(actualRaw, 500) : formatValue(text, 400);
  return {
    summary: `Body mismatch — expected «${expected}» got «${actual}»`.slice(0, 320),
    expected,
    actual,
    details: [{
      path: humanMismatchPath('$', 'BodyMismatch', false, true),
      expected,
      actual,
      message: 'Body mismatch (salvaged from truncated verifier output)',
    }],
  };
}

function fromMismatchList(mismatches: any[]): ParsedMismatch {
  const details = mismatches.map(normalizeMismatchEntry);
  const first = details[0];
  const typeLabel = first.type ? `${first.type}: ` : '';
  const summary =
    first.message ||
    (first.path
      ? `${typeLabel}${first.path} expected «${first.expected || '—'}» got «${first.actual || '—'}»`
      : 'Body or status mismatch');

  const expectedParts = details
    .map((d) =>
      d.path && d.expected !== undefined
        ? `${d.path}: ${d.expected}`
        : d.expected || d.message || ''
    )
    .filter(Boolean);
  const actualParts = details
    .map((d) =>
      d.path && d.actual !== undefined
        ? `${d.path}: ${d.actual}`
        : d.actual || ''
    )
    .filter(Boolean);

  return {
    summary: summary.length > 320 ? `${summary.slice(0, 319)}…` : summary,
    expected: expectedParts.join(' · ') || 'Contract match',
    actual: actualParts.join(' · ') || summary,
    details,
  };
}

/**
 * Accepts verifier `errors[].mismatch`, a JSON string, or an errors array entry.
 */
export function parsePactMismatch(raw: unknown): ParsedMismatch {
  if (raw == null || raw === '') {
    return {
      summary: 'Provider verification failed',
      expected: '—',
      actual: 'Failed',
      details: [],
    };
  }

  let data: any = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      const salvaged = salvageTruncatedMismatch(raw);
      if (salvaged) return salvaged;
      const text = raw.length > 400 ? `${raw.slice(0, 399)}…` : raw;
      return {
        summary: text,
        expected: 'Contract match',
        actual: text,
        details: [{ message: text }],
      };
    }
  }

  const mismatches: any[] = Array.isArray(data?.mismatches)
    ? data.mismatches
    : Array.isArray(data)
      ? data
      : data?.mismatch?.mismatches
        ? data.mismatch.mismatches
        : [];

  if (!mismatches.length) {
    if (typeof raw === 'string') {
      const salvaged = salvageTruncatedMismatch(raw);
      if (salvaged) return salvaged;
    }
    const text = formatValue(data, 400);
    return {
      summary: text,
      expected: 'Contract match',
      actual: text,
      details: [{ message: text }],
    };
  }

  return fromMismatchList(mismatches);
}

function isWeakExpected(value: unknown): boolean {
  const text = String(value ?? '').trim();
  if (!text || text === '—' || text === '-') return true;
  return /^(see mismatch|contract match|matched|pass|failed)$/i.test(text);
}

function looksLikeMismatchBlob(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Array.isArray(obj.mismatches) || Array.isArray(value) || 'mismatch' in obj;
  }
  const text = String(value);
  return text.includes('"mismatches"') || text.includes('"expected"');
}

/**
 * Backfill readable expected/actual/details on failed interactions & failures
 * when the report still carries raw Pact verifier JSON (or "See mismatch").
 */
export function normalizeReportMismatches<T extends {
  provider?: {
    interactions?: Array<{
      status?: string;
      expected?: string;
      actual?: string;
      reason?: string;
      details?: MismatchDetail[];
    }>;
    failures?: Array<{
      expected?: string;
      actual?: string;
      reason?: string;
      details?: MismatchDetail[];
    }>;
  };
}>(report: T): T {
  const provider = report.provider;
  if (!provider) return report;

  const pickMismatchSource = (...candidates: unknown[]): unknown => {
    const blobs = candidates
      .filter((c) => looksLikeMismatchBlob(c))
      .map((c) => ({ value: c, len: String(c ?? '').length }))
      .sort((a, b) => b.len - a.len);
    return blobs[0]?.value ?? null;
  };

  const interactions = (provider.interactions || []).map((ix) => {
    if (ix.status !== 'failed') return ix;
    const source = pickMismatchSource(ix.reason, ix.actual);
    if (!source && !isWeakExpected(ix.expected)) return ix;
    if (!source) return ix;
    const parsed = parsePactMismatch(source);
    return {
      ...ix,
      reason: parsed.summary || ix.reason,
      expected: isWeakExpected(ix.expected) ? parsed.expected : ix.expected,
      actual:
        looksLikeMismatchBlob(ix.actual) || isWeakExpected(ix.actual)
          ? parsed.actual
          : ix.actual,
      details: ix.details?.length ? ix.details : parsed.details,
    };
  });

  const failures = (provider.failures || []).map((failure) => {
    const source = pickMismatchSource(failure.reason, failure.actual);
    if (!source && !isWeakExpected(failure.expected)) return failure;
    if (!source) return failure;
    const parsed = parsePactMismatch(source);
    return {
      ...failure,
      reason: parsed.summary || failure.reason,
      expected: isWeakExpected(failure.expected) ? parsed.expected : failure.expected,
      actual:
        looksLikeMismatchBlob(failure.actual) || isWeakExpected(failure.actual)
          ? parsed.actual
          : failure.actual || parsed.actual,
      details: failure.details?.length ? failure.details : parsed.details,
    };
  });

  return {
    ...report,
    provider: {
      ...provider,
      interactions,
      failures,
    },
  };
}
