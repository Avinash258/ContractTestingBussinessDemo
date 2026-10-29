#!/usr/bin/env node
/**
 * Resolve TaxMesh gateway origin for Azure DevOps / shell.
 *
 * Local (default):
 *   GATEWAY_BASE_URL_OVERRIDE | GATEWAY_BASE_URL | TAXMESH_BASE_URL |
 *   PACT_PROVIDER_URL | gateway.config.json
 *
 * Azure DevOps (--ado):
 *   ONLY a non-empty GATEWAY_BASE_URL_OVERRIDE (Run pipeline UI) wins.
 *   Otherwise always gateway.config.json.
 *   Ambient ADO library/pipeline vars named GATEWAY_BASE_URL are IGNORED
 *   so a stale tunnel cannot override the repo config.
 *
 * Prints the URL to stdout. With --ado, also emits ##vso setvariable lines.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'gateway.config.json');

function normalize(raw) {
  let g = String(raw || '').trim();
  if (!g) return '';
  g = g.replace(/\/$/, '');
  const docs = g.indexOf('/api-docs');
  if (docs >= 0) g = g.slice(0, docs);
  const openapi = g.indexOf('/openapi');
  if (openapi >= 0) g = g.slice(0, openapi);
  return g.replace(/\/$/, '');
}

function fromConfig() {
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const url = normalize(cfg.gatewayBaseUrl);
  if (!url) {
    throw new Error('gateway.config.json gatewayBaseUrl is empty');
  }
  return { url, source: 'gateway.config.json' };
}

function resolve(adoMode) {
  const override = normalize(process.env.GATEWAY_BASE_URL_OVERRIDE || '');
  if (override) {
    return { url: override, source: 'GATEWAY_BASE_URL_OVERRIDE (pipeline UI)' };
  }

  // gateway.config.json is the source of truth (local + ADO).
  // Ambient GATEWAY_BASE_URL is ignored unless GATEWAY_ALLOW_ENV=1.
  const allowEnv = /^(1|true|yes)$/i.test(
    String(process.env.GATEWAY_ALLOW_ENV || '')
  );
  if (allowEnv && !adoMode) {
    const fromEnv = normalize(
      process.env.GATEWAY_BASE_URL ||
        process.env.TAXMESH_BASE_URL ||
        process.env.PACT_PROVIDER_URL ||
        ''
    );
    if (fromEnv) return { url: fromEnv, source: 'env (GATEWAY_ALLOW_ENV)' };
  }

  return fromConfig();
}

const ado = process.argv.includes('--ado');
const { url, source } = resolve(ado);

if (ado) {
  console.log(`Resolved TaxMesh gateway from ${source}: ${url}`);
  if (
    process.env.GATEWAY_BASE_URL &&
    normalize(process.env.GATEWAY_BASE_URL) &&
    normalize(process.env.GATEWAY_BASE_URL) !== url
  ) {
    console.log(
      `##vso[task.logissue type=warning]Ignoring ADO variable GATEWAY_BASE_URL=${process.env.GATEWAY_BASE_URL} — using ${source} instead. Remove the pipeline/library variable or leave Override blank and edit gateway.config.json.`
    );
  }
  // isOutput not required; job-scoped is enough for later steps in this job
  console.log(`##vso[task.setvariable variable=GATEWAY_BASE_URL]${url}`);
  console.log(`##vso[task.setvariable variable=TAXMESH_BASE_URL]${url}`);
  console.log(`##vso[task.setvariable variable=PACT_PROVIDER_URL]${url}`);
} else {
  process.stdout.write(url);
}
