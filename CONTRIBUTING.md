# Contribuindo com Maestro

Obrigado por se interessar em contribuir. Este documento cobre o fluxo básico de desenvolvimento durante o **v0.1**.

## Setup

```bash
pnpm install           # instala deps em todos os workspaces
pnpm build             # builda todos os packages via tsup
pnpm test              # Vitest em cada package
pnpm typecheck         # tsc --noEmit em cada package
pnpm lint              # ESLint + regras estritas
pnpm format:check      # verifica se o código está em conformidade com Prettier
```

Requisitos:

- Node.js >= 20 (LTS 24 recomendado; é o target default dos builds)
- pnpm >= 9 (o repo fixa via `packageManager` em `package.json`)

## Fluxo de um PR

1. Abra uma branch a partir de `main` seguindo o padrão `lucassampaiodegois1/<dsft-id>-<slug>` (o nome gerado pelo Linear funciona).
2. Faça commits pequenos e descritivos. Usamos [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:` etc.).
3. Garanta que `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` passam antes de abrir o PR. A CI vai rodar todos eles automaticamente.
4. **Adicione um changeset** se a mudança afeta qualquer pacote publicável (veja abaixo).
5. Abra o PR apontando para `main`. Link para a issue do Linear (ex.: `Refs DSFT-###`).

## Changesets

Usamos [Changesets](https://github.com/changesets/changesets) para versionamento e changelog automatizados.

### Quando adicionar um changeset

Sempre que a mudança afeta o comportamento observável ou a API pública de qualquer pacote `@maestro/*`. Para mudanças puramente internas (refactor de testes, docs que não afetam usuários, ajuste de CI), **não é necessário**.

Na dúvida, adicione.

### Como adicionar

```bash
pnpm changeset
```

O CLI interativo vai:

1. Perguntar quais packages foram afetados — marque com <kbd>space</kbd>.
2. Perguntar o tipo de bump para cada: `patch` (fix), `minor` (feature compatível), `major` (breaking change).
3. Pedir uma descrição curta em linguagem natural.

Ele gera um arquivo em `.changeset/<random-id>.md`. Commite esse arquivo junto com o restante do PR.

### Packages linkados

Durante o v0.1, **todos os packages `@maestro/*` são `linked`**: qualquer bump propaga a mesma versão para todos. Isso simplifica o primeiro release e evita versões desalinhadas enquanto o produto ainda está instável. Em v0.2+ podemos separar ciclos de release por package.

### Release

- `pnpm version-packages` consome os changesets pendentes, bumpa versões e gera `CHANGELOG.md` por package.
- `pnpm release` roda `pnpm build` e publica no npm com `changeset publish`.

O processo normalmente roda via [changesets/action](https://github.com/changesets/action) em CI (o workflow `release.yml` será adicionado em DSFT-98).

## Estilo de código

- **TypeScript estrito.** Evite `any`, `as unknown as ...` e non-null assertions (`!`) em código de produção.
- **ESM-only.** Imports devem usar extensões `.js` em paths relativos (o tsconfig usa `moduleResolution: bundler`, mas preferimos explícito para compatibilidade).
- **Sem comentários redundantes.** Comente _porquês_ e trade-offs, não o que o código está fazendo.
- **Sem `console.log` em código final.** Use o logger quando existir (pós DSFT-78).

Para detalhes do porquê de cada decisão, leia o documento [Maestro — Fundamento e Arquitetura](https://linear.app/dreamsoft/document/maestro-fundamento-e-arquitetura-e571aac5d90f) no Linear.

## Reportando problemas

Durante o v0.1 o issue tracker oficial é o **Linear** (time Dreamsoft, projeto Maestro). Abra issues com contexto suficiente para reprodução: comando executado, `maestro --version`, Node version, sistema operacional, logs relevantes.

No GitHub, os templates em `.github/ISSUE_TEMPLATE/` servem como pontos de entrada para reports vindos de fora do time. PRs usam o template em `.github/PULL_REQUEST_TEMPLATE.md`.

## Código de conduta

Este projeto adere ao [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Em resumo:

- Trate todos com respeito. Não toleramos discriminação, assédio ou hostilidade.
- Discussões técnicas são sobre código e decisões — não sobre pessoas.
- Reporte violações para `lucas.gois@dreamsoft.dev` (privado). Não vamos retaliar quem reportar de boa fé.

A íntegra do Contributor Covenant 2.1 se aplica mesmo que não esteja duplicada aqui. Em caso de conflito, a versão oficial em <https://www.contributor-covenant.org/version/2/1/code_of_conduct/> é a autoritativa.
