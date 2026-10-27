/**
 * Swagger gap AI agent (GitHub Actions only).
 *
 * Uses Azure OpenAI or OpenAI with the TestCaseGenratorViaSwagger agent prompt
 * to close OpenAPI ↔ Pact gaps, then exits with a JSON summary.
 *
 * Env:
 *   AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY + AZURE_OPENAI_DEPLOYMENT
 *   — or OPENAI_API_KEY (+ optional OPENAI_MODEL, default gpt-4o)
 *   SWAGGER_GAP_AGENT_MAX_TURNS (default 12)
 *   SWAGGER_GAP_AGENT_DRY_RUN=1 — print plan only, no LLM / no writes
 *
 *   npm run agent:swagger-gaps
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const AGENT_MD = path.join(ROOT, '.github/agents/TestCaseGenratorViaSwagger.agent.md');
const COVERAGE_PATH = path.join(ROOT, 'reports/swagger-coverage.json');
const SUMMARY_PATH = path.join(ROOT, 'reports/swagger-gap-agent-summary.json');
const REPORT_PATH = path.join(ROOT, 'reports/SWAGGER_GAP_AGENT_REPORT.md');

const MAX_TURNS = Number(process.env.SWAGGER_GAP_AGENT_MAX_TURNS || 12);
const DRY_RUN =
  process.env.SWAGGER_GAP_AGENT_DRY_RUN === '1' || process.argv.includes('--dry-run');

const ALLOWED_WRITE_PREFIXES = ['tests/', 'src/', 'docs/', 'reports/', 'pacts/'];
const ALLOWED_COMMANDS = [
  /^npm run test:consumer\b/,
  /^npm run test:swagger-coverage\b/,
  /^npm run test:swagger-coverage:ci\b/,
  /^npx tsc --noEmit\b/,
  /^npm run build\b/,
];

type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; name?: string };

type ToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

type AgentSummary = {
  implemented: string[];
  stillMissing: string[];
  filesChanged: string[];
  turns: number;
  dryRun: boolean;
  model?: string;
};

function stripFrontmatter(md: string): string {
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  if (end < 0) return md;
  return md.slice(end + 4).trim();
}

function loadSystemPrompt(): string {
  const raw = fs.readFileSync(AGENT_MD, 'utf8');
  return (
    stripFrontmatter(raw) +
    `

## Runtime constraints (CI agent)
- You may ONLY edit paths under: tests/, src/, docs/, reports/, pacts/
- You may ONLY run: npm run test:consumer, npm run test:swagger-coverage[:ci], npx tsc --noEmit, npm run build
- Do NOT implement multipart upload 200 success (defer — document only)
- Prefer extending existing consumer suites over inventing new frameworks
- Reply with a single JSON object each turn (no markdown fences) of the form:
  {"thought":"...","tool":{"name":"read_file|write_file|list_dir|run_command|finish","arguments":{...}}}
- finish arguments: {"implemented":["GET /path",...],"notes":"..."}
`
  );
}

function loadMissingOps(): Array<{ method: string; path: string; note?: string }> {
  if (!fs.existsSync(COVERAGE_PATH)) {
    throw new Error(`Missing ${COVERAGE_PATH}. Run npm run test:swagger-coverage first.`);
  }
  const cov = JSON.parse(fs.readFileSync(COVERAGE_PATH, 'utf8'));
  return (cov.missing || cov.rows || [])
    .filter((r: any) => String(r.status || '').toLowerCase() === 'missing' || !r.status)
    .filter((r: any) => r.method && r.path)
    .map((r: any) => ({
      method: String(r.method).toUpperCase(),
      path: String(r.path),
      note: r.note || r.notes,
    }));
}

function isAllowedWrite(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (norm.includes('..')) return false;
  return ALLOWED_WRITE_PREFIXES.some((p) => norm === p.slice(0, -1) || norm.startsWith(p));
}

function isAllowedCommand(cmd: string): boolean {
  const c = cmd.trim();
  return ALLOWED_COMMANDS.some((re) => re.test(c));
}

function toolReadFile(rel: string): string {
  if (!isAllowedWrite(rel) && !rel.startsWith('.github/')) {
    // allow reading more for context under tests/src/docs, and package.json / catalog
    const ok =
      isAllowedWrite(rel) ||
      ['package.json', 'gateway.config.json', 'README.md'].includes(rel.replace(/^\.\//, ''));
    if (!ok && !rel.startsWith('tests/') && !rel.startsWith('src/') && !rel.startsWith('docs/')) {
      return JSON.stringify({ error: `read_file denied: ${rel}` });
    }
  }
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return JSON.stringify({ error: `not found: ${rel}` });
  const text = fs.readFileSync(full, 'utf8');
  if (text.length > 80_000) return text.slice(0, 80_000) + '\n…[truncated]';
  return text;
}

function toolWriteFile(rel: string, content: string, filesChanged: Set<string>): string {
  if (!isAllowedWrite(rel)) {
    return JSON.stringify({ error: `write_file denied (path not allowed): ${rel}` });
  }
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  filesChanged.add(rel.replace(/\\/g, '/'));
  return JSON.stringify({ ok: true, path: rel, bytes: content.length });
}

function toolListDir(rel: string): string {
  const full = path.join(ROOT, rel || '.');
  if (!fs.existsSync(full)) return JSON.stringify({ error: `not found: ${rel}` });
  const entries = fs.readdirSync(full, { withFileTypes: true }).map((d) => ({
    name: d.name,
    type: d.isDirectory() ? 'dir' : 'file',
  }));
  return JSON.stringify(entries.slice(0, 200));
}

function toolRunCommand(cmd: string): string {
  if (!isAllowedCommand(cmd)) {
    return JSON.stringify({ error: `run_command denied: ${cmd}` });
  }
  try {
    const out = execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10 * 60 * 1000,
      env: process.env,
    });
    return out.slice(-20_000);
  } catch (e: any) {
    const stdout = e.stdout ? String(e.stdout) : '';
    const stderr = e.stderr ? String(e.stderr) : '';
    return `EXIT ${e.status ?? 1}\n${stdout.slice(-10000)}\n${stderr.slice(-10000)}`;
  }
}

function parseAssistantJson(raw: string): { thought?: string; tool?: ToolCall } {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  return JSON.parse(text);
}

type LlmConfig =
  | { kind: 'azure'; endpoint: string; key: string; deployment: string }
  | { kind: 'openai'; key: string; model: string };

function resolveLlm(): LlmConfig {
  const azureEndpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, '');
  const azureKey = process.env.AZURE_OPENAI_API_KEY || '';
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || '';
  if (azureEndpoint && azureKey && deployment) {
    return { kind: 'azure', endpoint: azureEndpoint, key: azureKey, deployment };
  }
  const openaiKey = process.env.OPENAI_API_KEY || '';
  if (openaiKey) {
    return {
      kind: 'openai',
      key: openaiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    };
  }
  throw new Error(
    'No LLM configured. Set AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY + AZURE_OPENAI_DEPLOYMENT, or OPENAI_API_KEY.'
  );
}

async function chatCompletion(llm: LlmConfig, messages: ChatMessage[]): Promise<string> {
  let url: string;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let body: Record<string, unknown>;

  if (llm.kind === 'azure') {
    url = `${llm.endpoint}/openai/deployments/${llm.deployment}/chat/completions?api-version=2024-08-01-preview`;
    headers['api-key'] = llm.key;
    body = {
      messages: messages.map((m) => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content })),
      temperature: 0.2,
      max_tokens: 4096,
    };
  } else {
    url = 'https://api.openai.com/v1/chat/completions';
    headers.Authorization = `Bearer ${llm.key}`;
    body = {
      model: llm.model,
      messages: messages.map((m) => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content })),
      temperature: 0.2,
      max_tokens: 4096,
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }
  const data = (await res.json()) as any;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty content');
  return String(content);
}

function writeSummary(summary: AgentSummary) {
  fs.mkdirSync(path.dirname(SUMMARY_PATH), { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2), 'utf8');
}

function appendReportStub(summary: AgentSummary, missingBefore: string[]) {
  const lines = [
    `# Swagger gap agent report`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `Dry run: ${summary.dryRun}`,
    `Turns: ${summary.turns}`,
    ``,
    `## Summary`,
    ``,
    `- Missing before: ${missingBefore.length}`,
    `- Implemented (claimed): ${summary.implemented.length}`,
    `- Still missing (claimed): ${summary.stillMissing.length}`,
    `- Files changed: ${summary.filesChanged.length}`,
    ``,
    `## Implemented`,
    ``,
    ...(summary.implemented.length
      ? summary.implemented.map((x) => `- \`${x}\``)
      : ['- _(none)_']),
    ``,
    `## Still missing`,
    ``,
    ...(summary.stillMissing.length
      ? summary.stillMissing.map((x) => `- \`${x}\``)
      : ['- _(none claimed)_']),
    ``,
    `## Files changed`,
    ``,
    ...(summary.filesChanged.length
      ? summary.filesChanged.map((x) => `- \`${x}\``)
      : ['- _(none)_']),
    ``,
  ];
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
}

async function main() {
  const missing = loadMissingOps();
  // Prefer coverage.missing array from verify script
  let missingList = missing;
  try {
    const cov = JSON.parse(fs.readFileSync(COVERAGE_PATH, 'utf8'));
    if (Array.isArray(cov.missing) && cov.missing.length) {
      missingList = cov.missing.map((r: any) => ({
        method: String(r.method).toUpperCase(),
        path: String(r.path),
        note: r.note,
      }));
    } else if (Array.isArray(cov.rows)) {
      missingList = cov.rows
        .filter((r: any) => String(r.status).toLowerCase() === 'missing')
        .map((r: any) => ({
          method: String(r.method).toUpperCase(),
          path: String(r.path),
          note: r.note,
        }));
    }
  } catch {
    // keep missingList
  }

  const missingBefore = missingList.map((m) => `${m.method} ${m.path}`);
  console.log(`Swagger gaps (missing): ${missingBefore.length}`);

  if (missingBefore.length === 0) {
    const summary: AgentSummary = {
      implemented: [],
      stillMissing: [],
      filesChanged: [],
      turns: 0,
      dryRun: DRY_RUN,
    };
    writeSummary(summary);
    appendReportStub(summary, missingBefore);
    console.log('No missing ops — nothing to implement.');
    return;
  }

  if (DRY_RUN) {
    const summary: AgentSummary = {
      implemented: [],
      stillMissing: missingBefore,
      filesChanged: [],
      turns: 0,
      dryRun: true,
    };
    writeSummary(summary);
    appendReportStub(summary, missingBefore);
    console.log('DRY_RUN=1 — wrote stub report only.');
    console.log(missingBefore.slice(0, 20).join('\n'));
    return;
  }

  const llm = resolveLlm();
  const filesChanged = new Set<string>();
  const system = loadSystemPrompt();
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: JSON.stringify(
        {
          task: 'Close Swagger ↔ Pact gaps for the missing operations below. Use tools until finish.',
          missing: missingList.slice(0, 40),
          hints: {
            consumerDir: 'tests/consumer',
            catalog: 'src/catalog/contracts.ts',
            pactFactory: 'src/pact/pactFactory.ts',
            gatewayConfig: 'gateway.config.json',
          },
        },
        null,
        2
      ),
    },
  ];

  let implemented: string[] = [];
  let stillMissing = [...missingBefore];
  let turns = 0;

  for (let i = 0; i < MAX_TURNS; i += 1) {
    turns = i + 1;
    console.log(`\n=== Agent turn ${turns}/${MAX_TURNS} ===`);
    const reply = await chatCompletion(llm, messages);
    messages.push({ role: 'assistant', content: reply });

    let parsed: { thought?: string; tool?: ToolCall };
    try {
      parsed = parseAssistantJson(reply);
    } catch {
      messages.push({
        role: 'user',
        content:
          'Your last reply was not valid JSON. Reply with only {"thought":"...","tool":{"name":"...","arguments":{...}}}',
      });
      continue;
    }

    const tool = parsed.tool;
    if (!tool?.name) {
      messages.push({
        role: 'user',
        content: 'Missing tool. Call read_file, write_file, list_dir, run_command, or finish.',
      });
      continue;
    }

    console.log(`tool: ${tool.name}`, JSON.stringify(tool.arguments || {}).slice(0, 200));

    if (tool.name === 'finish') {
      const args = tool.arguments || {};
      if (Array.isArray(args.implemented)) {
        implemented = args.implemented.map(String);
      }
      // Re-read coverage if present after agent work
      try {
        const cov = JSON.parse(fs.readFileSync(COVERAGE_PATH, 'utf8'));
        const left = (cov.missing || [])
          .map((r: any) => `${String(r.method).toUpperCase()} ${r.path}`);
        if (left.length) stillMissing = left;
        else stillMissing = missingBefore.filter((m) => !implemented.includes(m));
      } catch {
        stillMissing = missingBefore.filter((m) => !implemented.includes(m));
      }
      break;
    }

    let result = '';
    if (tool.name === 'read_file') {
      result = toolReadFile(String(tool.arguments?.path || ''));
    } else if (tool.name === 'write_file') {
      result = toolWriteFile(
        String(tool.arguments?.path || ''),
        String(tool.arguments?.content ?? ''),
        filesChanged
      );
    } else if (tool.name === 'list_dir') {
      result = toolListDir(String(tool.arguments?.path || '.'));
    } else if (tool.name === 'run_command') {
      result = toolRunCommand(String(tool.arguments?.command || ''));
    } else {
      result = JSON.stringify({ error: `unknown tool: ${tool.name}` });
    }

    messages.push({
      role: 'user',
      content: `TOOL_RESULT ${tool.name}:\n${result.slice(0, 24000)}`,
    });
  }

  const summary: AgentSummary = {
    implemented,
    stillMissing,
    filesChanged: [...filesChanged],
    turns,
    dryRun: false,
    model: llm.kind === 'azure' ? llm.deployment : llm.model,
  };
  writeSummary(summary);
  appendReportStub(summary, missingBefore);
  console.log('\nAgent summary:', JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
