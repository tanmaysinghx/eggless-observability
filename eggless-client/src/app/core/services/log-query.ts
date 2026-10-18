import { LogEntry } from '../models/log.model';

/**
 * Client copy of the server's search syntax (see LogQuery.java), used to decide whether a
 * live-tail entry belongs in the current view: `level:ERROR AND service:api "timeout"`.
 */
export interface ParsedQuery {
  levels: string[];
  fields: { key: keyof LogEntry; value: string; exact: boolean }[];
  freeText: string[];
}

const TERM = /(\w+):(?:'([^']*)'|"([^"]*)"|(\S+))|'([^']*)'|"([^"]*)"|(\S+)/g;

const KEYS: Record<string, { key: keyof LogEntry; exact: boolean }> = {
  service: { key: 'service', exact: true },
  app: { key: 'service', exact: true },
  application: { key: 'service', exact: true },
  env: { key: 'environment', exact: true },
  environment: { key: 'environment', exact: true },
  host: { key: 'host', exact: true },
  trace: { key: 'traceId', exact: true },
  traceid: { key: 'traceId', exact: true },
  request: { key: 'requestId', exact: true },
  requestid: { key: 'requestId', exact: true },
  user: { key: 'userId', exact: false },
  userid: { key: 'userId', exact: false },
  message: { key: 'message', exact: false },
  msg: { key: 'message', exact: false }
};

export function parseQuery(search: string): ParsedQuery {
  const parsed: ParsedQuery = { levels: [], fields: [], freeText: [] };
  if (!search?.trim()) return parsed;
  for (const m of search.matchAll(TERM)) {
    if (m[1]) {
      const name = m[1].toLowerCase();
      const value = m[2] ?? m[3] ?? m[4] ?? '';
      if (!value) continue;
      if (name === 'level') parsed.levels.push(value.toUpperCase());
      else if (KEYS[name]) parsed.fields.push({ ...KEYS[name], value });
      else parsed.freeText.push(`${m[1]}:${value}`);
      continue;
    }
    const word = m[5] ?? m[6] ?? m[7] ?? '';
    if (word && word.toUpperCase() !== 'AND') parsed.freeText.push(word);
  }
  return parsed;
}

export function matchesQuery(log: LogEntry, q: ParsedQuery): boolean {
  if (q.levels.length > 0 && !q.levels.includes(log.level)) return false;
  for (const f of q.fields) {
    const actual = String(log[f.key] ?? '');
    if (f.exact ? actual !== f.value : !actual.toLowerCase().includes(f.value.toLowerCase())) return false;
  }
  for (const t of q.freeText) {
    const needle = t.toLowerCase();
    const haystack = [log.message, log.traceId, log.requestId, log.userId, log.service];
    if (!haystack.some(v => v?.toLowerCase().includes(needle))) return false;
  }
  return true;
}
