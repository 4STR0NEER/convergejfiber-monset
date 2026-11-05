// Offline outbox for the crew app. Submissions are stored in IndexedDB the moment the crew confirms,
// then sent one by one whenever the phone is online. The "server" is mocked (repo.submit after a delay).
import { get, set } from 'idb-keyval'
import type { Submission } from '../domain/field'

export type OutboxStatus = 'queued' | 'sending' | 'sent' | 'failed'
export interface OutboxItem { id: string; createdAt: string; status: OutboxStatus; sentAt?: string; error?: string; sub: Submission }

const KEY = 'cjf.outbox.v1'
const listeners = new Set<(items: OutboxItem[]) => void>()
let cache: OutboxItem[] | null = null

async function load() {
  cache ??= (await get<OutboxItem[]>(KEY).catch(() => undefined)) ?? []
  return cache
}
async function save(items: OutboxItem[]) {
  cache = items
  await set(KEY, items).catch(() => { /* storage blocked: stays in memory for this session */ })
  listeners.forEach(l => l(items))
}

export const outbox = {
  list: load,
  subscribe(fn: (items: OutboxItem[]) => void) { listeners.add(fn); load().then(fn); return () => { listeners.delete(fn) } },
  async add(sub: Submission) {
    const item: OutboxItem = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'queued', sub }
    await save([...(await load()), item])
    return item
  },
  async patch(id: string, p: Partial<OutboxItem>) {
    await save((await load()).map(i => (i.id === id ? { ...i, ...p } : i)))
  },
  /** Drop sent items older than the newest 30 so the history stays short. */
  async prune() {
    const items = await load()
    const sent = items.filter(i => i.status === 'sent')
    if (sent.length > 30) await save(items.filter(i => i.status !== 'sent' || sent.slice(-30).includes(i)))
  },
}
