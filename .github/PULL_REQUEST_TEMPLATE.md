<!--
Obrigado pela contribuição! Antes de submeter, confira o checklist abaixo.
Para PRs grandes, considere abrir um draft cedo e pedir review incremental.
-->

## Contexto

<!-- O que motivou essa mudança? Se há issue do Linear, linke: Refs DSFT-### -->

## O que muda

<!-- Resuma em 1–3 bullets o que foi alterado na prática. -->

-
-

## Como testar

<!-- Passo-a-passo pra revisor reproduzir. Se aplicável, inclua prints do TUI ou logs. -->

```bash
pnpm install
pnpm test
```

## Checklist

- [ ] `pnpm lint` passa
- [ ] `pnpm typecheck` passa
- [ ] `pnpm test` passa
- [ ] `pnpm build` passa
- [ ] Adicionei um changeset (`pnpm changeset`) se a mudança afeta um pacote publicável
- [ ] Documentação atualizada (README, CONTRIBUTING, docs internas) se o comportamento mudou
- [ ] Commits seguem Conventional Commits

## Notas para o revisor

<!-- Pontos de atenção, decisões de design, alternativas consideradas. Opcional. -->
