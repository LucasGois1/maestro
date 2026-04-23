import type { StateStore } from '@maestro/state';
import type { TuiStore } from '@maestro/tui';

export type PersistEscalationFeedbackResult = {
  readonly ok: boolean;
  readonly message: string;
};

export function createPersistEscalationHumanFeedback(options: {
  readonly stateStore: StateStore;
  readonly tuiStore: TuiStore;
}): (text: string) => Promise<PersistEscalationFeedbackResult> {
  return async (text: string) => {
    const runId = options.tuiStore.getState().runId;
    if (runId === null) {
      return { ok: false, message: 'Sem runId ativo na TUI.' };
    }
    const st = await options.stateStore.load(runId);
    if (st?.escalation === undefined) {
      return {
        ok: false,
        message: 'Sem escalação persistida nesta run (estado pode ter sido limpo).',
      };
    }
    await options.stateStore.update(runId, {
      escalation: {
        ...st.escalation,
        humanFeedback: {
          text,
          submittedAt: new Date().toISOString(),
        },
      },
    });
    return {
      ok: true,
      message: 'Feedback gravado. Usa /resume para continuar.',
    };
  };
}
