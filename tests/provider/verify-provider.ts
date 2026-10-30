import fs from 'fs';
import path from 'path';
import { Verifier, VerifierOptions } from '@pact-foundation/pact';
import { listPactFilesForProvider } from '../../src/pact/listPacts';

type VerifierPayload = {
  errors?: unknown[];
  interactionResults?: Array<{
    description?: string;
    duration?: string;
    result?: string;
  }>;
  result?: boolean;
  output?: string[];
};

function reportsDir(): string {
  const dir = path.resolve(process.cwd(), 'reports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function parseVerifierPayload(output: unknown): VerifierPayload | null {
  if (output == null) return null;
  if (typeof output === 'object') return output as VerifierPayload;
  if (typeof output !== 'string') return null;
  const text = output.trim();
  // Full JSON blob
  if (text.startsWith('{') && text.includes('"result"')) {
    try {
      return JSON.parse(text) as VerifierPayload;
    } catch {
      /* fall through */
    }
  }
  const m = text.match(/\{"errors":\[[\s\S]*"result":\s*(true|false)\s*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]) as VerifierPayload;
    } catch {
      return null;
    }
  }
  return null;
}

function payloadFromError(err: unknown): VerifierPayload | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { message?: string; errors?: unknown[]; interactionResults?: unknown[]; result?: boolean };
  if (Array.isArray(e.interactionResults) || typeof e.result === 'boolean') {
    return e as VerifierPayload;
  }
  if (typeof e.message === 'string') {
    return parseVerifierPayload(e.message);
  }
  return parseVerifierPayload(String(err));
}

function printConclusion(
  provider: string,
  payload: VerifierPayload | null,
  passed: boolean
): void {
  const results = payload?.interactionResults || [];
  const ok = results.filter((r) => String(r.result).toUpperCase() === 'OK').length;
  const bad = results.filter((r) => String(r.result).toUpperCase() !== 'OK');
  const total = results.length;

  console.log('');
  console.log('────────────────────────────────────────');
  if (passed) {
    console.log(`${provider}: PASSED${total ? ` (${ok}/${total})` : ''}`);
  } else {
    console.log(
      `${provider}: FAILED${total ? ` (${ok}/${total} passed, ${bad.length} failed)` : ''}`
    );
    for (const r of bad.slice(0, 12)) {
      console.log(`  ✗ ${r.description || '(interaction)'}`);
    }
    if (bad.length > 12) console.log(`  … +${bad.length - 12} more`);
    const errs = payload?.errors;
    if (Array.isArray(errs) && errs.length) {
      for (const err of errs.slice(0, 5)) {
        const e = err as { interaction?: string; mismatch?: { mismatches?: Array<{ mismatch?: string; type?: string }> } };
        const first = e.mismatch?.mismatches?.[0];
        if (first?.mismatch) {
          console.log(`  → ${first.type || 'Mismatch'}: ${first.mismatch}`);
        } else if (e.interaction) {
          console.log(`  → ${e.interaction}`);
        }
      }
    }
  }
  console.log('────────────────────────────────────────');
  console.log('');
}

/** Shared provider verification helper — quiet console, JSON saved under reports/. */
export async function verifyProvider(opts: {
  provider: string;
  baseUrl: string;
  stateHandlers?: VerifierOptions['stateHandlers'];
}): Promise<void> {
  const pactUrls = listPactFilesForProvider(opts.provider);
  const safeName = opts.provider.replace(/[^\w.-]+/g, '_');
  const resultPath = path.join(reportsDir(), `provider-verify-${safeName}.json`);

  console.log(`TaxMesh provider verification: ${opts.provider}`);
  console.log(`  baseUrl    : ${opts.baseUrl}`);
  console.log(
    `  pact files : ${pactUrls.map((p) => path.basename(p)).join(', ') || '(none)'}`
  );
  console.log('');

  const verbose = /^(1|true|yes)$/i.test(String(process.env.PACT_VERBOSE || ''));
  const restoreStdout = muteStdoutUnless(verbose);

  try {
    let output: unknown;
    try {
      output = await new Verifier({
        provider: opts.provider,
        providerBaseUrl: opts.baseUrl,
        pactUrls,
        // quieter than 'info'; set PACT_LOG_LEVEL=info + PACT_VERBOSE=1 for full detail
        logLevel:
          (process.env.PACT_LOG_LEVEL as 'info' | 'warn' | 'error' | 'debug') ||
          (verbose ? 'info' : 'error'),
        stateHandlers: opts.stateHandlers || {},
      }).verifyProvider();
    } finally {
      restoreStdout();
    }

    const payload = parseVerifierPayload(output) || {
      errors: [],
      interactionResults: [],
      result: true,
      raw: output,
    };

    fs.writeFileSync(resultPath, JSON.stringify(payload, null, 2), 'utf8');
    // One-line marker for CI scrapers (full JSON is in the file above)
    console.log(`PROVIDER_RESULT_FILE=${resultPath}`);
    printConclusion(opts.provider, payload, true);
  } catch (err) {
    restoreStdout();
    const payload =
      payloadFromError(err) ||
      ({
        errors: [{ interaction: opts.provider, mismatch: String(err) }],
        interactionResults: [],
        result: false,
      } as VerifierPayload);

    fs.writeFileSync(resultPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`PROVIDER_RESULT_FILE=${resultPath}`);
    printConclusion(opts.provider, payload, false);
    // Re-throw a short error so callers don't dump the huge blob
    const short = new Error(`${opts.provider} provider verification FAILED`);
    (short as Error & { cause?: unknown }).cause = err;
    throw short;
  }
}

/** Suppress Pact's per-interaction chatter unless PACT_VERBOSE=1. */
function muteStdoutUnless(verbose: boolean): () => void {
  if (verbose) return () => undefined;
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((_chunk: unknown, ..._args: unknown[]) => true) as typeof process.stdout.write;
  return () => {
    process.stdout.write = original;
  };
}
