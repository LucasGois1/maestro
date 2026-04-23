import { Box, Text, useInput } from 'ink';
import { useCallback, useRef, useState } from 'react';

import { useTerminalSize } from '../layout/useTerminalSize.js';
import type { TuiStore } from '../state/store.js';
import { useStoreSelector } from '../state/useStoreSelector.js';

export type PersistEscalationFeedbackResult = {
  readonly ok: boolean;
  readonly message: string;
};

export interface EscalationScreenProps {
  readonly store: TuiStore;
  readonly persistEscalationHumanFeedback?: (
    text: string,
  ) => Promise<PersistEscalationFeedbackResult>;
}

export function EscalationScreen({
  store,
  persistEscalationHumanFeedback,
}: EscalationScreenProps) {
  const escalation = useStoreSelector(
    store,
    (s) => s.pipeline.escalationDetail,
  );
  const colorMode = useStoreSelector(store, (s) => s.colorMode);
  const { columns } = useTerminalSize();
  const useColor = colorMode === 'color';
  const [draft, setDraft] = useState('');
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const busyRef = useRef(false);

  const submit = useCallback(async () => {
    if (busyRef.current) {
      return;
    }
    const text = draft.trim();
    if (text.length === 0) {
      setStatusLine('Escreve feedback antes de submeter.');
      return;
    }
    if (persistEscalationHumanFeedback === undefined) {
      setStatusLine(
        'Persistência não disponível neste modo; configura o StateStore na CLI.',
      );
      return;
    }
    busyRef.current = true;
    setIsSubmitting(true);
    try {
      const r = await persistEscalationHumanFeedback(text);
      setStatusLine(r.message);
      if (r.ok) {
        setDraft('');
      }
    } finally {
      busyRef.current = false;
      setIsSubmitting(false);
    }
  }, [draft, persistEscalationHumanFeedback]);

  useInput(
    (input, key) => {
      if (key.return) {
        if (busyRef.current) {
          return;
        }
        void submit();
        return;
      }
      if (key.backspace || key.delete) {
        setDraft((d) => d.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setDraft((d) => d + input);
      }
    },
    { isActive: true },
  );

  if (escalation === null) {
    return (
      <Box paddingX={1} width={columns}>
        <Text dimColor={useColor}>Sem dados de escalação.</Text>
      </Box>
    );
  }

  const reasonPreview =
    escalation.reason.length > 600
      ? `${escalation.reason.slice(0, 600)}…`
      : escalation.reason;

  return (
    <Box flexDirection="column" paddingX={1} width={columns}>
      <Text bold {...(useColor ? { color: 'yellow' } : {})}>
        Escalação · sprint {escalation.sprintIdx + 1}
      </Text>
      <Text dimColor={useColor}>
        Origem: {escalation.source} · fase: {escalation.phaseAtEscalation} ·
        alvo de retomada: {escalation.resumeTarget}
      </Text>
      <Text dimColor={useColor}>
        O pipeline continuará com o alvo indicado acima após submeteres o
        feedback.
      </Text>
      {escalation.artifactHints !== undefined &&
      escalation.artifactHints.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Artefactos</Text>
          {escalation.artifactHints.map((p) => (
            <Text key={p} dimColor={useColor}>
              {p}
            </Text>
          ))}
        </Box>
      ) : null}
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Motivo</Text>
        <Text wrap="wrap">{reasonPreview}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text bold>
          O teu feedback (Enter para submeter e continuar o pipeline)
        </Text>
        <Text dimColor={useColor}>{draft.length > 0 ? draft : '…'}</Text>
      </Box>
      {isSubmitting ? (
        <Text dimColor={useColor}>A submeter…</Text>
      ) : null}
      {statusLine !== null && statusLine.length > 0 ? (
        <Text {...(useColor ? { color: 'cyan' } : {})}>{statusLine}</Text>
      ) : null}
    </Box>
  );
}
