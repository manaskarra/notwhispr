import { app } from 'electron';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
  secretKey: string;
  bucket: string;
}

let cachedConfig: SupabaseConfig | null = null;

function parseDotEnv(filePath: string): Record<string, string> {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const result: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex === -1) continue;
      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function loadDotEnv(): Record<string, string> {
  const candidates: string[] = [];
  const projectRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
  candidates.push(path.join(projectRoot, '.env'));

  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, '.env'));
  }

  for (const candidate of candidates) {
    const parsed = parseDotEnv(candidate);
    if (Object.keys(parsed).length > 0) return parsed;
  }
  return {};
}

export function getSupabaseConfig(): SupabaseConfig {
  if (cachedConfig) return cachedConfig;

  const fileEnv = loadDotEnv();
  const read = (key: string): string =>
    process.env[key] ?? fileEnv[key] ?? '';

  cachedConfig = {
    url: read('SUPABASE_URL').replace(/\/$/, ''),
    publishableKey: read('SUPABASE_PUBLISHABLE_KEY'),
    secretKey: read('SUPABASE_SECRET_KEY'),
    bucket: read('SUPABASE_BUCKET') || 'openflow',
  };

  return cachedConfig;
}

export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.secretKey);
}
