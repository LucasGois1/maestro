import { Box, Text, useInput } from 'ink';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useTerminalSize } from '../layout/useTerminalSize.js';
import type { TuiStore } from '../state/store.js';
import { useStoreSelector } from '../state/useStoreSelector.js';

export type PlanningInterviewSubmission =
  | {
      readonly kind: 'answers';
      readonly answers: readonly { questionId: string; answer: string }[];
    }
  | {
      readonly kind: 'continue_gate';
      readonly decision: 'continue' | 'proceed';
    }
  | {
      readonly kind: 'summary_review';
      readonly feedback: string | null;
    };

export type PersistPlanningInterviewResult = {
  readonly ok: boolean;
  readonly message: string;
};

export interface PlanningInterviewScreenProps {
  readonly store: TuiStore;
  readonly persistPlanningInterviewResponse?: (
    submission: PlanningInterviewSubmission,
  ) => Promise<PersistPlanningInterviewResult>;
}

export function PlanningInterviewScreen({
  store,
  persistPlanningInterviewResponse,
}: PlanningInterviewScreenProps) {
  const detail = useStoreSelector(store, (s) => s.pipeline.planningInterviewDetail);
  const colorMode = useStoreSelector(store, (s) => s.colorMode);
  const { columns } = useTerminalSize();
  const useColor = colorMode === 'color';
  const [draft, setDraft] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [roundAnswers, setRoundAnswers] = useState<
    Array<{ questionId: string; answer: string }>
  >([]);
  const [gateChoice, setGateChoice] = useState<'continue' | 'proceed'>(
    'continue',
  );
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const busyRef = useRef(false);

  const detailKey = useMemo(
    () =>
      detail === null
        ? 'empty'
        : `${detail.mode}:${detail.blockIndex.toString()}:${detail.totalRounds.toString()}:${detail.questions.map((q) => q.id).join(',')}:${detail.summaryMarkdown ?? ''}`,
    [detail],
  );

  useEffect(() => {
    setDraft('');
    setQuestionIndex(0);
    setRoundAnswers([]);
    setGateChoice('continue');
    setStatusLine(null);
    busyRef.current = false;
    setIsSubmitting(false);
  }, [detailKey]);

  const currentQuestion =
    detail?.mode === 'round' ? detail.questions[questionIndex] ?? null : null;

  async function submit(submission: PlanningInterviewSubmission) {
    if (busyRef.current) {
      return;
    }
    if (persistPlanningInterviewResponse === undefined) {
      setStatusLine(
        'Persistencia nao disponivel neste modo; configura o callback na CLI.',
      );
      return;
    }
    busyRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await persistPlanningInterviewResponse(submission);
      setStatusLine(result.message);
      if (result.ok) {
        setDraft('');
      }
    } finally {
      busyRef.current = false;
      setIsSubmitting(false);
    }
  }

  useInput(
    (input, key) => {
      if (detail === null || busyRef.current) {
        return;
      }

      if (detail.mode === 'continue_gate') {
        if (key.leftArrow || input.toLowerCase() === 'c') {
          setGateChoice('continue');
          return;
        }
        if (key.rightArrow || input.toLowerCase() === 'p') {
          setGateChoice('proceed');
          return;
        }
        if (key.return) {
          void submit({ kind: 'continue_gate', decision: gateChoice });
        }
        return;
      }

      if (key.return) {
        if (detail.mode === 'summary_review') {
          void submit({
            kind: 'summary_review',
            feedback: draft.trim().length > 0 ? draft.trim() : null,
          });
          return;
        }

        const text = draft.trim();
        if (text.length === 0 || currentQuestion === null) {
          setStatusLine('Escreve uma resposta antes de submeter.');
          return;
        }
        const nextAnswers = [
          ...roundAnswers,
          { questionId: currentQuestion.id, answer: text },
        ];
        setRoundAnswers(nextAnswers);
        setDraft('');
        if (questionIndex < detail.questions.length - 1) {
          setQuestionIndex((idx) => idx + 1);
          return;
        }
        void submit({ kind: 'answers', answers: nextAnswers });
        return;
      }

      if (key.backspace || key.delete) {
        setDraft((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setDraft((prev) => prev + input);
      }
    },
    { isActive: true },
  );

  if (detail === null) {
    return (
      <Box paddingX={1} width={columns}>
        <Text dimColor={useColor}>Sem entrevista pendente.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} width={columns}>
      <Text bold {...(useColor ? { color: 'yellow' } : {})}>
        Interview do Planner
      </Text>
      <Text dimColor={useColor}>
        Bloco {detail.blockIndex.toString()} · rodada{' '}
        {detail.roundInBlock.toString()} · total{' '}
        {detail.totalRounds.toString()}
      </Text>

      {detail.contextTrail.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Contexto consolidado</Text>
          {detail.contextTrail.slice(0, 6).map((line) => (
            <Text key={line} dimColor={useColor} wrap="wrap">
              {line}
            </Text>
          ))}
        </Box>
      ) : null}

      {detail.mode !== 'round' && detail.answers.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Respostas registradas</Text>
          {detail.answers.slice(0, 10).map((answer) => (
            <Text key={answer.questionId} dimColor={useColor} wrap="wrap">
              {answer.questionId}: {answer.answer}
            </Text>
          ))}
        </Box>
      ) : null}

      {detail.mode === 'round' && currentQuestion !== null ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>
            Pergunta {(questionIndex + 1).toString()}/{detail.questions.length.toString()}
          </Text>
          <Text wrap="wrap">{currentQuestion.prompt}</Text>
          <Text dimColor={useColor}>Topico: {currentQuestion.topic}</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Resposta</Text>
            <Text dimColor={useColor}>{draft.length > 0 ? draft : '…'}</Text>
          </Box>
        </Box>
      ) : null}

      {detail.mode === 'continue_gate' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Limite de rodadas atingido</Text>
          <Text wrap="wrap">
            {detail.summaryMarkdown ?? 'Continuar definindo a task ou prosseguir com o contexto atual?'}
          </Text>
          <Text {...(gateChoice === 'continue' && useColor ? { color: 'cyan' } : {})}>
            {gateChoice === 'continue' ? '>' : ' '} Continuar refinando
          </Text>
          <Text {...(gateChoice === 'proceed' && useColor ? { color: 'cyan' } : {})}>
            {gateChoice === 'proceed' ? '>' : ' '} Prosseguir para o resumo/plano
          </Text>
          <Text dimColor={useColor}>
            Usa seta esquerda/direita ou c/p. Enter confirma.
          </Text>
        </Box>
      ) : null}

      {detail.mode === 'summary_review' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Resumo consolidado</Text>
          <Text wrap="wrap">{detail.summaryMarkdown ?? '(sem resumo)'}</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Correcao opcional</Text>
            <Text dimColor={useColor}>
              {draft.length > 0 ? draft : 'Enter vazio aprova e segue para o plano.'}
            </Text>
          </Box>
        </Box>
      ) : null}

      {isSubmitting ? <Text dimColor={useColor}>A submeter…</Text> : null}
      {statusLine !== null && statusLine.length > 0 ? (
        <Text {...(useColor ? { color: 'cyan' } : {})}>{statusLine}</Text>
      ) : null}
    </Box>
  );
}
