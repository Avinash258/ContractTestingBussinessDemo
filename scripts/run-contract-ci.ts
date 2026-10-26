/**
 * Orchestrates consumer → provider → HTML/JSON report (EY_Demo-style gate).
 *
 *   npx ts-node --transpile-only scripts/run-contract-ci.ts
 *   npx ts-node --transpile-only scripts/run-contract-ci.ts --consumer-only
 *   npx ts-node --transpile-only scripts/run-contract-ci.ts --provider-only
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

const root = process.cwd();
const reportsDir = ensureReportsDir();
const consumerOnly = process.argv.includes('--consumer-only');
const providerOnly = process.argv.includes('--provider-only');

function listPactFiles(): string[] {
  const dir = config.pactsDir;
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
}

function runConsumer(): { exitCode: number; results: any | null } {
  const outFile = path.join(reportsDir, 'consumer-results.json');
  console.log('\n=== Consumer contract tests ===\n');
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      'jest',
      '--runInBand',
      '--ci',
      '--testPathPatterns=tests/consumer',
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

  const providerName =
    service === 'Gateway' ? 'TaxMesh-Gateway' : SERVICES[service].pactProvider;

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
  const services: Array<ServiceId | 'Gateway'> = [
    'CLM',
    'MDM',
    'ACC',
    'TAX',
    'ALC',
    'DOC',
    'Gateway',
  ];
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
      consumer: 'TaxMesh Pact consumers',
      provider: 'TaxMesh APIs (Gateway + CLM…DOC)',
      BUILD_BUILDID: process.env.BUILD_BUILDID || '',
      BUILD_SOURCEBRANCH: process.env.BUILD_SOURCEBRANCH || '',
    },
  });

  const { jsonPath, htmlPath, interactivePath, dashboardZipPath } = writeReports(report);
  console.log('\n=== Pact report (ContractTestDemo / EY_Demo style) ===');
  console.log(`  Overall : ${report.overallStatus.toUpperCase()}`);
  console.log(`  Consumer: ${report.consumer.passed}/${report.consumer.total}`);
  console.log(`  Provider: ${report.provider.passed}/${report.provider.total}`);
  console.log(`  JSON    : ${jsonPath}`);
  console.log(`  HTML    : ${htmlPath}`);
  console.log(`  Map     : ${interactivePath}`);
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
