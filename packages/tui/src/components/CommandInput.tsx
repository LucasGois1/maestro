import { Box, Text, useInput } from 'ink';
import { useCallback, useMemo, useState } from 'react';

import {
  commandEntryNeedsTrailingArgs,
  findCommandEntry,
  normalizeCommandInput,
  prepareTuiCommandInput,
  subcommandPickMenuForPrepared,
  suggestCommands,
  type CommandCatalogEntry,
} from '../commands/catalog.js';
import { useTerminalSize } from '../layout/useTerminalSize.js';
import type { TuiColorMode } from '../state/store.js';

export type TuiCommandExecutionResult = {
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
};

export type TuiCommandExecutor = (options: {
  readonly input: string;
  readonly command: CommandCatalogEntry;
}) => Promise<TuiCommandExecutionResult> | TuiCommandExecutionResult;

export type CommandInputProps = {
  readonly executor?: TuiCommandExecutor;
  readonly disabled?: boolean;
  readonly colorMode?: TuiColorMode;
};

const INPUT_NAV_FOOTER =
  '↑↓ to navigate · Enter to confirm · Esc to cancel';

type SubmenuState = {
  readonly root: string;
  readonly entries: readonly CommandCatalogEntry[];
  selected: number;
};

const ROOT_SUBMENU_BLURB: Partial<Record<string, string>> = {
  runs: 'List, inspect, or clean recorded runs (.maestro/runs)',
  config: 'Read or change Maestro configuration',
  git: 'Repository and Maestro worktree helpers',
  kb: 'Knowledge base maintenance',
};

export function CommandInput({
  executor,
  disabled = false,
  colorMode = 'color',
}: CommandInputProps) {
  const useColor = colorMode === 'color';
  const { columns } = useTerminalSize();
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<TuiCommandExecutionResult | null>(
    null,
  );
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [commandHistory, setCommandHistory] = useState<readonly string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [submenu, setSubmenu] = useState<SubmenuState | null>(null);

  const input = draft.trimStart();
  const hasSlashPrefix = input.startsWith('/');
  const slashQuery = hasSlashPrefix ? input.slice(1).trimStart() : '';
  const catalogQuery = useMemo(
    () => prepareTuiCommandInput(normalizeCommandInput(slashQuery).trim()),
    [slashQuery],
  );
  const suggestions = useMemo(() => {
    if (!hasSlashPrefix || submenu !== null) {
      return [];
    }
    return suggestCommands(catalogQuery);
  }, [hasSlashPrefix, catalogQuery, submenu]);

  const selected = suggestions[selectedSuggestion] ?? suggestions[0] ?? null;

  const executeLine = useCallback(
    async (rawInput: string): Promise<void> => {
      const trimmed = rawInput.trimStart();
      if (!trimmed.startsWith('/')) {
        setMessage({
          level: 'error',
          message: 'Commands must start with "/". Example: /run <prompt>',
        });
        return;
      }
      const withoutSlash = trimmed.slice(1);
      const normalized = prepareTuiCommandInput(
        normalizeCommandInput(withoutSlash).trim(),
      );
      const command = findCommandEntry(normalized);
      if (!command) {
        const suggestion = suggestCommands(normalized)[0];
        setMessage({
          level: 'error',
          message: suggestion
            ? `Unknown command. Did you mean "${suggestion.entry.usage}"?`
            : 'Unknown command. Type "/run <prompt>" to start a task.',
        });
        return;
      }
      if (!executor) {
        setMessage({
          level: 'warn',
          message: 'Command execution is not wired in this shell.',
        });
        return;
      }
      const result = await executor({ input: normalized, command });
      setMessage(result);
      if (result.level !== 'error') {
        setCommandHistory((history) =>
          history.at(-1) === `/${normalized}`
            ? history
            : [...history, `/${normalized}`],
        );
        setDraft('');
        setSelectedSuggestion(0);
        setHistoryIndex(null);
      }
    },
    [executor],
  );

  const confirmSubmenu = useCallback(async () => {
    if (submenu === null) {
      return;
    }
    const entry = submenu.entries[submenu.selected];
    if (entry === undefined) {
      setSubmenu(null);
      return;
    }
    setSubmenu(null);
    if (commandEntryNeedsTrailingArgs(entry)) {
      setDraft(`/${entry.command} `);
      setSelectedSuggestion(0);
      setHistoryIndex(null);
      return;
    }
    await executeLine(`/${entry.command}`);
  }, [submenu, executeLine]);

  const trySubmitDraft = useCallback(
    (fullDraft: string): void => {
      const trimmed = fullDraft.trimStart();
      if (!trimmed.startsWith('/')) {
        setMessage({
          level: 'error',
          message: 'Commands must start with "/". Example: /run <prompt>',
        });
        return;
      }
      const withoutSlash = trimmed.slice(1);
      const normalized = prepareTuiCommandInput(
        normalizeCommandInput(withoutSlash).trim(),
      );
      const pick = subcommandPickMenuForPrepared(normalized);
      if (pick !== null) {
        setSubmenu({
          root: pick.root,
          entries: pick.entries,
          selected: 0,
        });
        setMessage(null);
        return;
      }
      void executeLine(trimmed);
    },
    [executeLine],
  );

  useInput(
    (ch, key) => {
      if (submenu !== null) {
        if (key.escape || (key.ctrl && ch === 'c')) {
          setSubmenu(null);
          return;
        }
        if (key.ctrl && ch === 'u') {
          setSubmenu(null);
          setDraft('');
          setSelectedSuggestion(0);
          setHistoryIndex(null);
          return;
        }
        if (key.upArrow) {
          setSubmenu((s) =>
            s === null
              ? s
              : {
                  ...s,
                  selected:
                    s.entries.length === 0
                      ? 0
                      : (s.selected - 1 + s.entries.length) % s.entries.length,
                },
          );
          return;
        }
        if (key.downArrow) {
          setSubmenu((s) =>
            s === null
              ? s
              : {
                  ...s,
                  selected:
                    s.entries.length === 0
                      ? 0
                      : (s.selected + 1) % s.entries.length,
                },
          );
          return;
        }
        if (key.return || ch.includes('\r') || ch.includes('\n')) {
          void confirmSubmenu();
          return;
        }
        return;
      }

      if (ch.includes('\u0015')) {
        const afterClear = ch.split('\u0015').at(-1) ?? '';
        const line = afterClear.split(/\r|\n/u)[0] ?? '';
        setDraft(line);
        setSelectedSuggestion(0);
        setHistoryIndex(null);
        if (afterClear.includes('\r') || afterClear.includes('\n')) {
          trySubmitDraft(line);
        }
        return;
      }
      if (key.ctrl && ch === 'u') {
        setDraft('');
        setSelectedSuggestion(0);
        setHistoryIndex(null);
        return;
      }
      if (key.escape || (key.ctrl && ch === 'c')) {
        setDraft('');
        setMessage(null);
        setSelectedSuggestion(0);
        setHistoryIndex(null);
        return;
      }
      if (key.upArrow) {
        if (draft.trim().length === 0 && commandHistory.length > 0) {
          const nextIndex =
            historyIndex === null
              ? commandHistory.length - 1
              : Math.max(0, historyIndex - 1);
          setHistoryIndex(nextIndex);
          setDraft(commandHistory[nextIndex] ?? '');
          setSelectedSuggestion(0);
          return;
        }
        setSelectedSuggestion((current) =>
          suggestions.length === 0
            ? 0
            : (current - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (key.downArrow) {
        if (historyIndex !== null) {
          const nextIndex = historyIndex + 1;
          if (nextIndex >= commandHistory.length) {
            setHistoryIndex(null);
            setDraft('');
          } else {
            setHistoryIndex(nextIndex);
            setDraft(commandHistory[nextIndex] ?? '');
          }
          setSelectedSuggestion(0);
          return;
        }
        setSelectedSuggestion((current) =>
          suggestions.length === 0 ? 0 : (current + 1) % suggestions.length,
        );
        return;
      }
      if (key.tab) {
        if (selected) {
          setDraft(`/${selected.completion}`);
          setSelectedSuggestion(0);
          setHistoryIndex(null);
        }
        return;
      }
      if (key.backspace || key.delete) {
        setDraft((current) => current.slice(0, -1));
        setSelectedSuggestion(0);
        setHistoryIndex(null);
        return;
      }
      if (key.return || ch.includes('\r') || ch.includes('\n')) {
        const line = ch.split(/\r|\n/u)[0] ?? '';
        const nextDraft =
          ch.includes('\r') || ch.includes('\n') ? `${draft}${line}` : draft;
        setDraft(nextDraft);
        setHistoryIndex(null);
        trySubmitDraft(nextDraft);
        return;
      }
      if (ch.length > 0 && !key.ctrl && !key.meta) {
        setDraft((current) => current + ch);
        setMessage(null);
        setSelectedSuggestion(0);
        setHistoryIndex(null);
      }
    },
    { isActive: !disabled },
  );

  const messageColor =
    message?.level === 'error'
      ? 'red'
      : message?.level === 'warn'
        ? 'yellow'
        : 'green';

  const ruleWidth = Math.max(8, columns - 2);
  const horizontalRule = '\u2500'.repeat(ruleWidth);

  return (
    <Box flexDirection="column" paddingX={1}>
      {!disabled && submenu !== null ? (
        <Box flexDirection="column" marginBottom={0}>
          <Box flexDirection="column" marginBottom={1}>
            <Text {...(useColor ? { color: 'green' } : {})}>❯ /{submenu.root}</Text>
            <Text dimColor={useColor}>
              {ROOT_SUBMENU_BLURB[submenu.root] ?? 'Pick a subcommand'}
            </Text>
          </Box>
          {submenu.entries.map((entry, idx) => (
            <Text
              key={entry.command}
              {...(useColor && idx === submenu.selected
                ? { color: 'cyan' }
                : {})}
              dimColor={useColor && idx !== submenu.selected}
            >
              {idx === submenu.selected ? '❯ ' : '  '}
              {entry.command} — {entry.description}
            </Text>
          ))}
          <Box marginTop={1}>
            <Text dimColor={useColor}>{INPUT_NAV_FOOTER}</Text>
          </Box>
        </Box>
      ) : !disabled && suggestions.length > 0 ? (
        <Box flexDirection="column">
          {suggestions.slice(0, 6).map((suggestion, idx) => (
            <Text
              key={`${suggestion.entry.command}-${String(idx)}`}
              {...(useColor && idx === selectedSuggestion
                ? { color: 'cyan' }
                : {})}
              dimColor={useColor && idx !== selectedSuggestion}
            >
              {idx === selectedSuggestion ? '› ' : '  '}
              {`/${suggestion.entry.usage}`} — {suggestion.entry.description}
            </Text>
          ))}
          <Box marginTop={1}>
            <Text dimColor={useColor}>{INPUT_NAV_FOOTER}</Text>
          </Box>
        </Box>
      ) : null}
      <Text dimColor={useColor}>{horizontalRule}</Text>
      <Box flexDirection="row" flexWrap="nowrap">
        <Text {...(useColor && !disabled ? { color: 'green' } : {})}>❯ </Text>
        <Text dimColor={(disabled || submenu !== null) && useColor}>
          {disabled ? '(overlay open)' : draft}
        </Text>
        {!disabled && submenu === null ? (
          <Text {...(useColor ? { color: 'cyan' } : {})}>▏</Text>
        ) : null}
      </Box>
      <Text dimColor={useColor}>{horizontalRule}</Text>
      {message ? (
        <Text {...(useColor ? { color: messageColor } : {})}>
          {message.message}
        </Text>
      ) : null}
    </Box>
  );
}
