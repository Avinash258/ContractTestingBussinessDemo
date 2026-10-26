import fs from 'fs';
import path from 'path';
import { config } from '../config';

/** Find pact JSON files whose provider.name matches `providerName` (empty if none). */
export function findPactFilesForProvider(providerName: string): string[] {
  const dir = config.pactsDir;
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(dir, f))
    .filter((file) => {
      try {
        const pact = JSON.parse(fs.readFileSync(file, 'utf8')) as {
          provider?: { name?: string };
        };
        return pact.provider?.name === providerName;
      } catch {
        return false;
      }
    });
}

export function hasPactFilesForProvider(providerName: string): boolean {
  return findPactFilesForProvider(providerName).length > 0;
}

/** List pact JSON files whose provider.name matches `providerName`. */
export function listPactFilesForProvider(providerName: string): string[] {
  const dir = config.pactsDir;
  if (!fs.existsSync(dir)) {
    throw new Error(
      `No pacts directory at ${dir}. Run consumer tests first: npm run test:consumer`
    );
  }

  const files = findPactFilesForProvider(providerName);

  if (files.length === 0) {
    throw new Error(
      `No pact files for provider "${providerName}" in ${dir}. Run: npm run test:consumer`
    );
  }

  return files;
}
