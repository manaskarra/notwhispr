import { mkdir, access, readdir } from 'node:fs/promises';
import path from 'node:path';

import type { AppSettings } from '../shared/types';

export interface StoragePaths {
  root: string;
  models: string;
  cache: string;
  logs: string;
}

export function getStoragePaths(settings: AppSettings): StoragePaths {
  return {
    root: settings.storageDirectory,
    models: path.join(settings.storageDirectory, 'models'),
    cache: path.join(settings.storageDirectory, 'cache'),
    logs: path.join(settings.storageDirectory, 'logs'),
  };
}

export async function ensureStorage(settings: AppSettings): Promise<StoragePaths> {
  const paths = getStoragePaths(settings);
  await Promise.all(
    [paths.root, paths.models, paths.cache, paths.logs].map((entry) =>
      mkdir(entry, { recursive: true }),
    ),
  );
  return paths;
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function directoryHasEntries(targetPath: string): Promise<boolean> {
  try {
    const entries = await readdir(targetPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}
