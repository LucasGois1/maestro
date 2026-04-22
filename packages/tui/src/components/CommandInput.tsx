import { Box, Text, useInput } from 'ink';
import { useCallback, useMemo, useState } from 'react';

import {
  findCommandEntry,
  normalizeCommandInput,
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

  const input = draft.trimStart();
  const hasSlashPrefix = input.startsWith('/');
  const slashQuery = hasSlashPrefix ? input.slice(1) : '';
  const normalizedDraft = normalizeCommandInput(slashQuery);
  const suggestions = useMemo(() => {
    if (!hasSlashPrefix) {
      return [];
    }
    return suggestCommands(normalizedDraft);
  }, [hasSlashPrefix, normalizedDraft]);

  const selected = suggestions[selectedSuggestion] ?? suggestions[0] ?? null;

  const submitCommand = useCallback(
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
      const normalized = normalizeCommandInput(withoutSlash).trim();
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

  useInput(
    (input, key) => {
      if (input.includes('\u0015')) {
        const afterClear = input.split('\u0015').at(-1) ?? '';
        const line = afterClear.split(/\r|\n/u)[0] ?? '';
        setDraft(line);
        setSelectedSuggestion(0);
        setHistoryIndex(null);
        if (afterClear.includes('\r') || afterClear.includes('\n')) {
          void submitCommand(line);
        }
        return;
      }
      if (input.includes('\r') || input.includes('\n')) {
        const line = input.split(/\r|\n/u)[0] ?? '';
        const nextDraft = `${draft}${line}`;
        setDraft(nextDraft);
        setHistoryIndex(null);
        void submitCommand(nextDraft);
        return;
      }
      if (key.ctrl && input === 'u') {
        setDraft('');
        setSelectedSuggestion(0);
        setHistoryIndex(null);
        return;
      }
      if (key.escape || (key.ctrl && input === 'c')) {
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
      if (key.return) {
        void submitCommand(draft);
        return;
      }
      if (input.length > 0 && !key.ctrl && !key.meta) {
        setDraft((current) => current + input);
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

  /** Width inside `paddingX={1}` on this column (matches App shell width). */
  const ruleWidth = Math.max(8, columns - 2);
  const horizontalRule = '\u2500'.repeat(ruleWidth);

  return (
    <Box flexDirection="column" paddingX={1}>
      {!disabled && suggestions.length > 0 ? (
        <Box flexDirection="column">
          {suggestions.slice(0, 3).map((suggestion, idx) => (
            <Text
              key={suggestion.entry.command}
              {...(useColor && idx === selectedSuggestion
                ? { color: 'cyan' }
                : {})}
              dimColor={useColor && idx !== selectedSuggestion}
            >
              {idx === selectedSuggestion ? '› ' : '  '}
              {`/${suggestion.entry.usage}`} — {suggestion.entry.description}
            </Text>
          ))}
        </Box>
      ) : null}
      <Text dimColor={useColor}>{horizontalRule}</Text>
      <Box flexDirection="row" flexWrap="nowrap">
        <Text {...(useColor && !disabled ? { color: 'green' } : {})}>❯ </Text>
        <Text dimColor={disabled && useColor}>
          {disabled ? '(overlay open)' : draft}
        </Text>
        {!disabled ? (
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
