// Cloud-projects is a Genspark-cloud feature. The Genspark backend (@genspark/cli
// via packages/ai-search) was removed in the AI-SDK migration, so the live sync
// is stubbed out here: the store functions return "unavailable" / empty, and
// the pure helpers are kept so preload + home-api callers still compile. The
// feature is effectively disabled until a non-Genspark projects source exists.
import { unlinkSync } from 'node:fs'
import type { CloudProjectKind, CloudProjectsSnapshot } from '../shared/home-api'

const KINDS: readonly CloudProjectKind[] = ['docs', 'sheets', 'slides']

export function kindFromType(type: string): CloudProjectKind | 'other' {
  return KINDS.find((k) => type.startsWith(k)) ?? 'other'
}

export const GENSPARK_ORIGIN = 'https://www.genspark.ai'

const UNAVAILABLE: CloudProjectsSnapshot = { available: false, projects: [], syncedAt: 0 }

/** No Genspark key in the AI-SDK build, so there is no account owner. */
export function cloudStoreOwner(): string {
  return ''
}

export function clearCloudProjectsStore(_storePath: string): void {
  try {
    unlinkSync(_storePath)
  } catch {
    /* nothing cached; fine */
  }
}

export function readCloudProjectsStore(_storePath: string): CloudProjectsSnapshot | null {
  return null
}

export function syncCloudProjects(_storePath: string): Promise<CloudProjectsSnapshot> {
  return Promise.resolve(UNAVAILABLE)
}

/** Only relative genspark paths may be opened externally (renderer input is untrusted). */
export function cloudProjectExternalUrl(projectUrl: unknown): string | null {
  if (typeof projectUrl !== 'string') return null
  if (!projectUrl.startsWith('/') || projectUrl.startsWith('//')) return null
  return `${GENSPARK_ORIGIN}${projectUrl}`
}
