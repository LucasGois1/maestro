import { Box, Text, useInput } from 'ink';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useKeybinding } from '../keybindings/useKeybinding.js';
import { useTerminalSize } from '../layout/useTerminalSize.js';
import type {
  TuiAgentLogEntry,
  TuiAgentLogKind,
  TuiAgentState,
  TuiColorMode,
} from '../state/store.js';

export const AGENT_LOG_OVERLAY_ID = 'agentLog';

export interface AgentLogOverlayProps {
  readonly agent: TuiAgentState;
  readonly colorMode?: TuiColorMode;
  readonly maxEntries?: number;
}

const DEFAULT_MAX_ENTRIES = 2000;

const KIND_CYCLE: readonly ('all' | TuiAgentLogKind)[] = [
  'all',
  'delta',
  'tool_call',
  'decision',
];

function entryPrefix(kind: TuiAgentLogEntry['kind']): string {
  switch (kind) {
    case 'delta':
      return '>';
    case 'tool_call':
      return '►';
    case 'decision':
      return '★';
  }
}

function uniqueAgentIds(entries: readonly TuiAgentLogEntry[]): string[] {
  const seen = new Set<string>();
  for (const e of entries) {
    seen.add(e.agentId);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function AgentLogOverlay({
  agent,
  colorMode = 'color',
  maxEntries = DEFAULT_MAX_ENTRIES,
}: AgentLogOverlayProps) {
  const useColor = colorMode === 'color';
  const size = useTerminalSize();
  const viewportLines = Math.max(6, Math.min(40, size.rows - 14));

  const [scrollOffset, setScrollOffset] = useState(0);
  const [kindFilter, setKindFilter] = useState<'all' | TuiAgentLogKind>('all');
  const [agentFilter, setAgentFilter] = useState<'all' | string>('all');
  const [searchSubstr, setSearchSubstr] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');

  const buffer = useMemo(
    () => agent.messageLog.slice(-maxEntries),
    [agent.messageLog, maxEntries],
  );

  const filtered = useMemo(() => {
    let rows = buffer;
    if (kindFilter !== 'all') {
      rows = rows.filter((e) => e.kind === kindFilter);
    }
    if (agentFilter !== 'all') {
      rows = rows.filter((e) => e.agentId === agentFilter);
    }
    if (searchSubstr.trim().length > 0) {
      const q = searchSubstr.trim().toLowerCase();
      rows = rows.filter((e) => e.text.toLowerCase().includes(q));
    }
    return rows;
  }, [buffer, kindFilter, agentFilter, searchSubstr]);

  const agentsInBuffer = useMemo(() => uniqueAgentIds(buffer), [buffer]);

  useEffect(() => {
    setScrollOffset((prev) =>
      Math.min(prev, Math.max(0, filtered.length - viewportLines)),
    );
  }, [filtered.length, viewportLines]);

  const cycleKind = useCallback(() => {
    const i = KIND_CYCLE.indexOf(
      kindFilter === 'all' ? 'all' : kindFilter,
    );
    const next = KIND_CYCLE[(i + 1) % KIND_CYCLE.length];
    if (next === undefined) {
      return;
    }
    setKindFilter(next === 'all' ? 'all' : next);
    setScrollOffset(0);
  }, [kindFilter]);

  const cycleAgent = useCallback(() => {
    if (agentsInBuffer.length === 0) {
      return;
    }
    const ids = ['all', ...agentsInBuffer] as const;
    const idx = ids.indexOf(agentFilter as 'all' | string);
    const next = ids[(idx + 1) % ids.length];
    setAgentFilter(next ?? 'all');
    setScrollOffset(0);
  }, [agentFilter, agentsInBuffer]);

  const scrollUp = useCallback(() => {
    setScrollOffset((o) => Math.max(0, o - 1));
  }, []);

  const scrollDown = useCallback(() => {
    setScrollOffset((o) =>
      Math.max(0, Math.min(o + 1, Math.max(0, filtered.length - viewportLines))),
    );
  }, [filtered.length, viewportLines]);

  useKeybinding(
    { kind: 'overlay' },
    { key: 'k' },
    cycleKind,
    { enabled: !searchMode },
  );
  useKeybinding(
    { kind: 'overlay' },
    { key: 'a' },
    cycleAgent,
    { enabled: !searchMode },
  );
  useKeybinding(
    { kind: 'overlay' },
    { key: 'up' },
    scrollUp,
    { enabled: !searchMode },
  );
  useKeybinding(
    { kind: 'overlay' },
    { key: 'down' },
    scrollDown,
    { enabled: !searchMode },
  );
  useKeybinding(
    { kind: 'overlay' },
    { key: '/' },
    () => {
      setSearchMode(true);
      setSearchDraft(searchSubstr);
    },
    { enabled: !searchMode },
  );

  useInput(
    (input, key) => {
      if (!searchMode) {
        return;
      }
      if (key.escape) {
        setSearchMode(false);
        setSearchDraft('');
        return;
      }
      if (key.return) {
        setSearchSubstr(searchDraft);
        setSearchMode(false);
        setScrollOffset(0);
        return;
      }
      if (key.backspace || key.delete) {
        setSearchDraft((d) => d.slice(0, -1));
        return;
      }
      if (input.length === 1 && !key.ctrl && !key.meta) {
        setSearchDraft((d) => d + input);
      }
    },
    { isActive: searchMode },
  );

  const windowed = useMemo(() => {
    const end = Math.min(
      filtered.length,
      scrollOffset + viewportLines,
    );
    return filtered.slice(scrollOffset, end);
  }, [filtered, scrollOffset, viewportLines]);

  if (buffer.length === 0) {
    return <Text dimColor={useColor}>(log vazio)</Text>;
  }

  if (filtered.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor={useColor}>
          (nenhum resultado com os filtros atuais — [k] [a] [/])
        </Text>
      </Box>
    );
  }

  const statusLine = searchMode
    ? `search: ${searchDraft}_  [enter] apply  [esc] cancel`
    : `shown ${filtered.length.toString()}/${buffer.length.toString()} · kind: ${kindFilter} · agent: ${agentFilter} · find: ${searchSubstr.length > 0 ? `"${searchSubstr}"` : '—'}  [k] kind  [a] agent  [/] search  [↑↓] scroll`;

  return (
    <Box flexDirection="column">
      <Text dimColor={useColor} wrap="wrap">
        {`active: ${agent.activeAgentId ?? '—'} · ${statusLine}`}
      </Text>
      {windowed.map((entry, index) => {
        const key = `${entry.at.toString()}-${scrollOffset.toString()}-${index.toString()}-${entry.kind}`;
        const prefix = entryPrefix(entry.kind);
        const text = entry.text.replace(/\s+/g, ' ').trim();
        const colorProps =
          useColor && entry.kind === 'decision'
            ? { color: 'yellow' as const }
            : useColor && entry.kind === 'tool_call'
              ? { color: 'cyan' as const }
              : {};
        return (
          <Text key={key} {...colorProps} dimColor={entry.kind === 'delta' && useColor}>
            {`${prefix} [${entry.agentId}] ${text}`}
          </Text>
        );
      })}
      {filtered.length > viewportLines ? (
        <Text dimColor={useColor}>
          {`scroll ${scrollOffset.toString()}–${Math.min(scrollOffset + viewportLines, filtered.length).toString()} of ${filtered.length.toString()}`}
        </Text>
      ) : null}
    </Box>
  );
}

export function createAgentLogOverlay(
  agent: TuiAgentState,
  colorMode: TuiColorMode,
) {
  return {
    id: AGENT_LOG_OVERLAY_ID,
    title: 'Logs completos',
    render: () => <AgentLogOverlay agent={agent} colorMode={colorMode} />,
  };
}
