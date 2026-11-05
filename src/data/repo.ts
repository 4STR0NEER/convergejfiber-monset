// Data access seam. UI only talks to `Repository`; swap LocalRepo for a SupabaseRepo later.
import { DEFAULT_SETTINGS } from '../domain/config'
import { todayManila } from '../domain/dates'
import type { Settings, Snapshot } from '../domain/types'
import { generateSeed } from './seed'

export interface Repository {
  getSnapshot(): Promise<Snapshot>
  getSettings(): Promise<Settings>
  saveSettings(s: Settings): Promise<void>
}

const SETTINGS_KEY = 'cjf.settings.v1'

export class LocalRepo implements Repository {
  private snap?: Snapshot

  async getSnapshot() {
    this.snap ??= generateSeed({ asOf: todayManila(), nowMs: Date.now() })
    return this.snap
  }

  async getSettings(): Promise<Settings> {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    } catch { /* private mode or corrupt value: fall back to defaults */ }
    return DEFAULT_SETTINGS
  }

  async saveSettings(s: Settings) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* not persisted */ }
  }
}

export const repo: Repository = new LocalRepo()
