#!/usr/bin/env node
/**
 * Sync gateway.config.json → docs, agents, pipeline comment, reports.
 * Edit gateway.config.json, then: npm run sync:gateway
 *
 * Azure DevOps resolves at runtime from gateway.config.json
 * (parameter override only if non-empty). Sync keeps docs/comments aligned.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'gateway.config.json');

function normalize(raw) {
  let g = String(raw || '').trim().replace(/\/$/, '');
  const docs = g.indexOf('/api-docs');
  if (docs >= 0) g = g.slice(0, docs);
  const openapi = g.indexOf('/openapi');
  if (openapi >= 0) g = g.slice(0, openapi);
  return g.replace(/\/$/, '');
}

function mustReadConfig() {
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const url = normalize(cfg.gatewayBaseUrl);
  if (!url) throw new Error('gateway.config.json: gatewayBaseUrl is empty');
  return { cfg, url };
}

function replaceTrycloudflare(text, newUrl) {
  return text.replace(/https?:\/\/[a-z0-9-]+\.trycloudflare\.com/gi, newUrl);
}

function patchFile(relPath, transform) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) {
    console.warn(`skip missing: ${relPath}`);
    return;
  }
  const before = fs.readFileSync(full, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`unchanged ${relPath}`);
    return;
  }
  fs.writeFileSync(full, after, 'utf8');
  console.log(`updated  ${relPath}`);
}

function main() {
  const { url } = mustReadConfig();
  console.log(`gatewayBaseUrl → ${url}`);
  console.log(`(from ${configPath})`);

  // Keep pipeline comment in sync; leave parameter default blank so ADO uses the file.
  patchFile('azure-pipelines.yml', (text) => {
    let next = text.replace(
      /(^\s*# Swagger \(live\): ).*$/m,
      `$1${url}/api-docs`
    );
    next = next.replace(
      /(^\s*- name: gatewayBaseUrl\b[\s\S]*?^\s*default:\s*)'[^']*'/m,
      `$1''`
    );
    return next;
  });

  patchFile('docs/SWAGGER_GAP_COVERAGE.md', (text) =>
    text.replace(/^Source:\s*`[^`]+`/m, `Source: \`${url}/openapi.json\``)
  );

  patchFile('.github/agents/TestCaseGenratorViaSwagger.agent.md', (text) => {
    let next = replaceTrycloudflare(text, url);
    next = next.replace(
      /(\| Swagger UI \| `)[^`]+(` \|)/,
      `$1${url}/api-docs$2`
    );
    next = next.replace(
      /(\| OpenAPI JSON \| `)[^`]+(` \|)/,
      `$1${url}/openapi.json$2`
    );
    if (!next.includes('gateway.config.json')) {
      next = next.replace(
        '## Default Swagger targets',
        '## Default Swagger targets\n\n> Live host comes from [`gateway.config.json`](../../gateway.config.json) — run `npm run sync:gateway` after changing it.'
      );
    }
    return next;
  });

  patchFile('.github/agents/ContractCoverageAuditor.agent.md', (text) => {
    let next = replaceTrycloudflare(text, url);
    next = next.replace(
      /(\| OpenAPI JSON \| `)[^`]+(` \|)/,
      `$1${url}/openapi.json$2`
    );
    if (!next.includes('gateway.config.json')) {
      next = next.replace(
        '## Default Swagger targets',
        '## Default Swagger targets\n\n> Live host comes from [`gateway.config.json`](../../gateway.config.json) — run `npm run sync:gateway` after changing it.'
      );
    }
    return next;
  });

  patchFile('src/config.ts', (text) =>
    text.replace(
      /@see https?:\/\/[^\s*]+/g,
      `@see ${url}/api-docs#/Gateway/listContracts`
    )
  );

  patchFile('reports/swagger-coverage.json', (text) => {
    try {
      const j = JSON.parse(text);
      j.source = `${url}/openapi.json`;
      return `${JSON.stringify(j, null, 2)}\n`;
    } catch {
      return replaceTrycloudflare(text, url);
    }
  });

  patchFile('README.md', (text) => {
    let next = text;
    if (!next.includes('gateway.config.json')) {
      next = next.replace(
        /^(# TaxMesh Pact Framework[^\n]*\n\n)/m,
        `$1**Gateway URL (single source of truth):** edit [\`gateway.config.json\`](gateway.config.json), then run \`npm run sync:gateway\`.\n\n`
      );
    }
    next = next.replace(
      /`https:\/\/…trycloudflare\.com\/api-docs`/g,
      `\`${url}/api-docs\``
    );
    return next;
  });

  console.log('\nDone. Commit gateway.config.json + synced files when ready.');
}

main();
