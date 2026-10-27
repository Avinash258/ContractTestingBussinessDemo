#!/usr/bin/env node
/**
 * Resolve TaxMesh gateway origin for Azure DevOps / shell.
 * Priority: GATEWAY_BASE_URL_OVERRIDE | GATEWAY_BASE_URL | TAXMESH_BASE_URL |
 *           PACT_PROVIDER_URL | gateway.config.json
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

function resolve() {
  const override = normalize(
    process.env.GATEWAY_BASE_URL_OVERRIDE ||
      process.env.GATEWAY_BASE_URL ||
      process.env.TAXMESH_BASE_URL ||
      process.env.PACT_PROVIDER_URL ||
      ''
  );
  if (override) return { url: override, source: 'env/override' };

  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const url = normalize(cfg.gatewayBaseUrl);
  if (!url) {
    throw new Error('gateway.config.json gatewayBaseUrl is empty');
  }
  return { url, source: 'gateway.config.json' };
}

const ado = process.argv.includes('--ado');
const { url, source } = resolve();

if (ado) {
  console.log(`Resolved TaxMesh gateway from ${source}: ${url}`);
  console.log(`##vso[task.setvariable variable=GATEWAY_BASE_URL]${url}`);
  console.log(`##vso[task.setvariable variable=TAXMESH_BASE_URL]${url}`);
  console.log(`##vso[task.setvariable variable=PACT_PROVIDER_URL]${url}`);
} else {
  process.stdout.write(url);
}
