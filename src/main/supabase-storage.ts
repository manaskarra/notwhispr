import { randomBytes } from 'node:crypto';

import { getSupabaseConfig } from './config';
import type { ImageStorageSettings } from '../shared/types';

const UPLOAD_TIMEOUT_MS = 30_000;

interface ResolvedStorage {
  url: string;
  secretKey: string;
  bucket: string;
}

function resolveStorage(settings?: ImageStorageSettings): ResolvedStorage {
  const env = getSupabaseConfig();
  return {
    url: (settings?.url || env.url || '').replace(/\/$/, ''),
    secretKey: settings?.secretKey || env.secretKey || '',
    bucket: settings?.bucket || env.bucket || 'openflow',
  };
}

function fileExtensionFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  return 'png';
}

function buildObjectPath(mimeType: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const slug = randomBytes(6).toString('hex');
  const ext = fileExtensionFor(mimeType);
  return `dictations/${yyyy}/${mm}/${now.getTime()}-${slug}.${ext}`;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function uploadImageToObjectStore(
  base64: string,
  mimeType: string,
  settings?: ImageStorageSettings,
): Promise<string> {
  const config = resolveStorage(settings);
  if (!config.url || !config.secretKey) {
    throw new Error(
      'Image storage is not configured. Set Supabase URL + secret key in Models › Image Storage (or in .env).',
    );
  }

  const objectPath = buildObjectPath(mimeType);
  const buffer = Buffer.from(base64, 'base64');
  const uploadUrl = `${config.url}/storage/v1/object/${encodeURIComponent(
    config.bucket,
  )}/${objectPath}`;

  const response = await fetchWithTimeout(
    uploadUrl,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        apikey: config.secretKey,
        'Content-Type': mimeType,
        'x-upsert': 'true',
        'Cache-Control': '3600',
      },
      body: buffer,
    },
    UPLOAD_TIMEOUT_MS,
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Supabase storage upload failed (${response.status}): ${text || response.statusText}`,
    );
  }

  return `${config.url}/storage/v1/object/public/${encodeURIComponent(
    config.bucket,
  )}/${objectPath}`;
}

export function isImageStorageReady(settings?: ImageStorageSettings): boolean {
  const resolved = resolveStorage(settings);
  return Boolean(resolved.url && resolved.secretKey);
}
