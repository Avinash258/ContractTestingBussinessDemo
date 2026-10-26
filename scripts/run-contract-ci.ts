/**
 * Orchestrates consumer → provider → HTML/JSON report (EY_Demo-style gate).
 *
 *   npx ts-node --transpile-only scripts/run-contract-ci.ts
 *   npx ts-node --transpile-only scripts/run-contract-ci.ts --consumer-only
 *   npx ts-node --transpile-only scripts/run-contract-ci.ts --provider-only
 *   npx ts-node --transpile-only scripts/run-contract-ci.ts --services=CLM,MDM
 *   npx ts-node --transpile-only scripts/run-contract-ci.ts --services=CLM,MDM --consumer-only
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  buildReport,
  ensureReportsDir,
  summarizeConsumerFromJest,
  summarizeProviderFromResults,
  writeReports,
} from '../src/reporting/generateReport';
import { config } from '../src/config';
import { SERVICES, type ServiceId } from '../src/catalog/contracts';
import { hasPactFilesForProvider } from '../src/pact/listPacts';

const root = process.cwd();
const reportsDir = ensureReportsDir();
const consumerOnly = process.argv.includes('--consumer-only');
const providerOnly = process.argv.includes('--provider-only');

const ALL_PROVIDERS: Array<ServiceId | 'Gateway'> = [
  'CLM',
  'MDM',
  'ACC',
  'TAX',
  'ALC',
  'DOC',
  'Gateway',
];

/** Consumer Jest path fragments that exercise a given service pair / producer. */
const CONSUMER_SPEC_FRAGMENTS: Record<string, string[]> = {
  CLM: ['clm-mdm.ct00'],
  MDM: ['clm-mdm.ct00'],
  ACC: ['mdm-acc.ct01', 'all-contracts.ct05-17'],
  TAX: ['mdm-tax.ct02', 'all-contracts.ct05-17'],
  ALC: ['mdm-alc.ct03', 'all-contracts.ct05-17'],
  DOC: ['mdm-doc.ct04', 'all-contracts.ct05-17'],
  Gateway: [
    'gateway.flow',
    'gateway.contracts-by-id',
    'gateway.filing-mutations',
    'service-discovery',
    'consume-by-id',
  ],
};

function parseServicesArg(): Array<ServiceId | 'Gateway'> | null {
  const fromEnv = String(process.env.PACT_SERVICES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const arg = process.argv.find((a) => a.startsWith('--services='));
  const fromArg = arg
    ? arg
        .slice('--services='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const raw = fromArg.length ? fromArg : fromEnv;
  if (!raw.length || raw.some((s) => /^all$/i.test(s))) return null;

  const selected: Array<ServiceId | 'Gateway'> = [];
  for (const token of raw) {
    const upper = token.toUpperCase();
    if (upper === 'GATEWAY') {
      selected.push('Gateway');
      continue;
    }
    if ((Object.keys(SERVICES) as string[]).includes(upper)) {
      selected.push(upper as ServiceId);
      continue;
    }
    throw new Error(
      `Unknown service "${token}". Use: ${ALL_PROVIDERS.join(', ')} or all`
    );
  }
  return selected;
}

const selectedServices = parseServicesArg();
const scopedRun = !!selectedServices?.length;

function consumerTestPathPattern(): string {
  if (!selectedServices?.length) return 'tests/consumer';
  const fragments = new Set<string>();
  for (const service of selectedServices) {
    for (const frag of CONSUMER_SPEC_FRAGMENTS[service] || []) {
      fragments.add(frag);
    }
  }
  // CLM+MDM scoped pair → CT-00 only (no gateway / other CT suite noise)
  if (
    selectedServices.length === 2 &&
    selectedServices.includes('CLM') &&
    selectedServices.includes('MDM')
  ) {
    return 'clm-mdm.ct00';
  }
  return Array.from(fragments).join('|') || 'tests/consumer';
}

function providerNameFor(service: ServiceId | 'Gateway'): string {
  return service === 'Gateway' ? 'TaxMesh-Gateway' : SERVICES[service].pactProvider;
}

/**
 * Providers to verify for this run.
 * CLM+MDM scope only generates CT-00 (MDM ← CLM), so MDM is a consumer — not a provider.
 * For other scoped runs, skip services that have no matching pact files after consumer gen.
 */
function providersToRun(): Array<ServiceId | 'Gateway'> {
  let candidates: Array<ServiceId | 'Gateway'>;
  if (!selectedServices?.length) {
    candidates = ALL_PROVIDERS;
  } else if (
    selectedServices.length === 2 &&
    selectedServices.includes('CLM') &&
    selectedServices.includes('MDM')
  ) {
    candidates = ['CLM'];
  } else {
    candidates = selectedServices.filter((s) => ALL_PROVIDERS.includes(s));
  }

  if (!scopedRun) return candidates;

  const withPacts = candidates.filter((service) =>
    hasPactFilesForProvider(providerNameFor(service))
  );
  const skipped = candidates.filter((s) => !withPacts.includes(s));
  if (skipped.length) {
    console.log(
      `Skipping provider verify (no pact files): ${skipped
        .map(providerNameFor)
        .join(', ')}`
    );
  }
  return withPacts;
}

function listPactFiles(): string[] {
  const dir = config.pactsDir;
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (!selectedServices?.length) return files;

  const allowedProviders = new Set(
    selectedServices.map((s) =>
      s === 'Gateway' ? 'TaxMesh-Gateway' : SERVICES[s].pactProvider
    )
  );
  const allowedConsumers = new Set(
    selectedServices.map((s) =>
      s === 'Gateway' ? 'TaxMesh-Client' : `TaxMesh-${s}`
    )
  );
  // Also keep classic MDM←CLM consumer naming
  allowedConsumers.add('TaxMesh-MDM');
  allowedConsumers.add('TaxMesh-CLM');

  return files.filter((file) => {
    try {
      const pact = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as {
        provider?: { name?: string };
        consumer?: { name?: string };
      };
      const provider = pact.provider?.name || '';
      const consumer = pact.consumer?.name || '';
      return allowedProviders.has(provider) || allowedConsumers.has(consumer);
    } catch {
      return false;
    }
  });
}

function clearPactsDirForScopedRun() {
  if (!scopedRun) return;
  const dir = config.pactsDir;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    fs.unlinkSync(path.join(dir, file));
  }
  console.log(`Cleared previous pact files in ${dir} (scoped run)`);
}

function runConsumer(): { exitCode: number; results: any | null } {
  const outFile = path.join(reportsDir, 'consumer-results.json');
  const pattern = consumerTestPathPattern();
  console.log('\n=== Consumer contract tests ===');
  if (scopedRun) {
    console.log(`Scoped services: ${selectedServices!.join(', ')}`);
    console.log(`Jest testPathPatterns: ${pattern}\n`);
    clearPactsDirForScopedRun();
  } else {
    console.log('');
  }
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      'jest',
      '--runInBand',
      '--ci',
      `--testPathPatterns=${pattern}`,
      '--json',
      `--outputFile=${outFile}`,
    ],
    {
      cwd: root,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        PACT_DO_NOT_TRACK: process.env.PACT_DO_NOT_TRACK || 'true',
      },
    }
  );

  let results = null;
  if (fs.existsSync(outFile)) {
    results = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  }

  if ((result.status ?? 1) !== 0 && results?.testResults) {
    console.error('\n=== Failed consumer tests ===');
    for (const suite of results.testResults) {
      for (const assertion of suite.assertionResults || []) {
        if (assertion.status === 'failed') {
          console.error(`FAIL ${suite.name}`);
          console.error(`  ${assertion.fullName}`);
          for (const msg of assertion.failureMessages || []) {
            console.error(String(msg).slice(0, 2000));
          }
        }
      }
    }
  }

  return { exitCode: result.status ?? 1, results };
}

function runOneProvider(service: ServiceId | 'Gateway'): {
  provider: string;
  success: boolean;
  interactionResults: any[];
  errors: any[];
  durationMs: number;
} {
  const started = Date.now();
  const script =
    service === 'Gateway'
      ? 'tests/provider/gateway.provider.verify.ts'
      : `tests/provider/${service.toLowerCase()}.provider.verify.ts`;

  const providerName = providerNameFor(service);

  console.log(`\n--- Provider: ${providerName} ---\n`);
  const result = spawnSync(
    process.execPath,
    [require.resolve('ts-node/dist/bin.js'), '--transpile-only', script],
    {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
    }
  );

  const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');

  let parsed: any = null;
  // Verifier prints JSON blob on success/failure in some paths; also look for PASSED line
  const jsonMatch = combined.match(/\{"errors":\[[\s\S]*"result":\s*(true|false)\s*\}/);
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = null;
    }
  }

  const success =
    (result.status === 0 && /verification PASSED/i.test(combined)) ||
    parsed?.result === true;

  return {
    provider: providerName,
    success,
    interactionResults: parsed?.interactionResults || [],
    errors: parsed?.errors || (success ? [] : [{ interaction: providerName, mismatch: combined.slice(-2000) }]),
    durationMs: Date.now() - started,
  };
}

function runProviders() {
  const services = providersToRun();
  console.log(
    `\n=== Provider verification (${services.join(', ')}) ===\n`
  );
  return services.map(runOneProvider);
}

async function main() {
  ensureReportsDir();

  let consumerExit = 0;
  let consumerResults: any = null;

  if (!providerOnly) {
    const consumer = runConsumer();
    consumerExit = consumer.exitCode;
    consumerResults = consumer.results;
  } else if (fs.existsSync(path.join(reportsDir, 'consumer-results.json'))) {
    consumerResults = JSON.parse(
      fs.readFileSync(path.join(reportsDir, 'consumer-results.json'), 'utf8')
    );
  }

  let providerBlocks: ReturnType<typeof runProviders> = [];
  let providerExit = 0;

  if (!consumerOnly) {
    if (consumerExit !== 0 && !providerOnly) {
      console.error('\nSkipping provider verification because consumer failed.\n');
      providerExit = 1;
    } else {
      providerBlocks = runProviders();
      providerExit = providerBlocks.every((b) => b.success) ? 0 : 1;
      fs.writeFileSync(
        path.join(reportsDir, 'provider-results.json'),
        JSON.stringify(providerBlocks, null, 2),
        'utf8'
      );
    }
  }

  const consumerSummary = summarizeConsumerFromJest(consumerResults);
  const providerSummary = summarizeProviderFromResults(providerBlocks);

  // If provider skipped due to consumer failure, mark skipped
  if (consumerOnly) {
    providerSummary.status = 'skipped';
    providerSummary.ran = false;
  }

  const report = buildReport({
    consumer: consumerSummary,
    provider: providerSummary,
    pactFiles: listPactFiles(),
    environment: {
      // FinVault-style friendly keys + TaxMesh service bases
      providerUrl: process.env.GATEWAY_BASE_URL || config.gatewayBaseUrl,
      GATEWAY_BASE_URL: process.env.GATEWAY_BASE_URL || config.gatewayBaseUrl,
      URL_CLM: process.env.URL_CLM || config.serviceBaseUrl('CLM'),
      URL_MDM: process.env.URL_MDM || config.serviceBaseUrl('MDM'),
      URL_ACC: process.env.URL_ACC || config.serviceBaseUrl('ACC'),
      URL_TAX: process.env.URL_TAX || config.serviceBaseUrl('TAX'),
      URL_ALC: process.env.URL_ALC || config.serviceBaseUrl('ALC'),
      URL_DOC: process.env.URL_DOC || config.serviceBaseUrl('DOC'),
      consumer: scopedRun
        ? `TaxMesh Pact consumers (${selectedServices!.join('+')})`
        : 'TaxMesh Pact consumers',
      provider: scopedRun
        ? `TaxMesh APIs (${selectedServices!.join(', ')})`
        : 'TaxMesh APIs (Gateway + CLM…DOC)',
      BUILD_BUILDID: process.env.BUILD_BUILDID || '',
      BUILD_SOURCEBRANCH: process.env.BUILD_SOURCEBRANCH || '',
      BUILD_SOURCEVERSION: process.env.BUILD_SOURCEVERSION || '',
      RUN_MODE: [
        consumerOnly ? 'consumer-only' : providerOnly ? 'provider-only' : 'full',
        scopedRun ? `services=${selectedServices!.join(',')}` : 'services=all',
      ].join('+'),
      PACT_SERVICES: scopedRun ? selectedServices!.join(',') : 'all',
    },
  });

  const { jsonPath, htmlPath, interactivePath, dashboardZipPath, excelPath } =
    await writeReports(report);
  console.log('\n=== Pact report (ContractTestDemo / EY_Demo style) ===');
  console.log(
    `  Scope   : ${scopedRun ? selectedServices!.join(', ') : 'all services'}`
  );
  console.log(`  Overall : ${report.overallStatus.toUpperCase()}`);
  console.log(`  Consumer: ${report.consumer.passed}/${report.consumer.total}`);
  console.log(`  Provider: ${report.provider.passed}/${report.provider.total}`);
  console.log(`  JSON    : ${jsonPath}`);
  console.log(`  HTML    : ${htmlPath}`);
  console.log(`  Map     : ${interactivePath}`);
  if (excelPath) console.log(`  Excel   : ${excelPath}`);
  if (dashboardZipPath) console.log(`  Zip     : ${dashboardZipPath}`);
  console.log(`  Dashboard data: dashboard/data/latest.json`);

  const exitCode = consumerOnly
    ? consumerExit
    : providerOnly
      ? providerExit
      : consumerExit || providerExit;

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
