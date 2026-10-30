/**
 * Provider console helpers.
 * Default: keep Pact "Verifying a pact…" detail + conclusion.
 * Optional: PACT_QUIET=1 strips interaction chatter (header + conclusion only).
 * Always drops giant verifier JSON blobs if they leak into stdout.
 */

const JSON_BLOB = /^\s*\{"errors":\[/;

/** Strip only huge JSON result blobs — keep verification detail. */
export function stripVerifierJsonBlob(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let skippingJson = false;
  let depth = 0;

  for (const line of lines) {
    const t = line.trim();
    if (!skippingJson && JSON_BLOB.test(t)) {
      skippingJson = true;
      depth = 0;
      for (const ch of t) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      if (depth <= 0) skippingJson = false;
      continue;
    }
    if (skippingJson) {
      for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      if (depth <= 0) skippingJson = false;
      continue;
    }
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Quiet mode: header + conclusion + failures only.
 * Used when PACT_QUIET=1.
 */
export function filterProviderConsoleQuiet(text: string): string {
  const keep: string[] = [];
  let inConclusion = false;

  for (const line of stripVerifierJsonBlob(text).split(/\r?\n/)) {
    const t = line.trimEnd();
    if (
      /^TaxMesh provider verification:/.test(t) ||
      /^\s+baseUrl\s*:/.test(t) ||
      /^\s+pact files\s*:/.test(t) ||
      /^PROVIDER_RESULT_FILE=/.test(t) ||
      /^[─═]{8,}/.test(t) ||
      /: (PASSED|FAILED)/.test(t) ||
      /^\s+[✓✗]/.test(t) ||
      /^\s+→ /.test(t) ||
      /provider verification FAILED/i.test(t)
    ) {
      keep.push(line);
      if (/^[─═]{8,}/.test(t)) inConclusion = !inConclusion;
      continue;
    }
    if (/^Error:/.test(t) && t.length < 200) {
      keep.push(line);
      continue;
    }
    if (inConclusion) keep.push(line);
  }

  return keep
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .concat(keep.length ? '\n' : '');
}

/** Default console shape: full Pact verify detail, no JSON dump. */
export function filterProviderConsole(text: string): string {
  const quiet = /^(1|true|yes)$/i.test(String(process.env.PACT_QUIET || ''));
  if (quiet) return filterProviderConsoleQuiet(text);
  return stripVerifierJsonBlob(text);
}
