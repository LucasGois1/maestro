# Changesets

Diretório gerenciado pelo [changesets](https://github.com/changesets/changesets). Cada arquivo `*.md` aqui é um changeset — uma descrição da mudança de uma ou mais packages do monorepo, com o tipo de bump (major/minor/patch) correspondente.

## Como adicionar um changeset em um PR

1. Rode `pnpm changeset` na raiz do repo.
2. Selecione os packages afetados (use <kbd>space</kbd> para marcar).
3. Escolha o tipo de bump para cada um (patch, minor, major).
4. Escreva uma descrição curta e voltada para o usuário — ela vai para o CHANGELOG.
5. Commite o arquivo `.changeset/<id>.md` junto com o resto do PR.

Durante o v0.1, **todos os packages do Maestro são `linked`**: qualquer bump afeta a versão de todos. Isso pode mudar em v0.2+ quando os packages passarem a ter ciclos de release independentes.

## Release

- `pnpm version-packages` consome os changesets pendentes, atualiza as versões e gera os `CHANGELOG.md` de cada package.
- `pnpm release` roda `pnpm build` e publica no npm (`changeset publish`).

Essas execuções normalmente acontecem via [changesets/action](https://github.com/changesets/action) em CI (ver `release.yml`, adicionado quando o pipeline de publish estiver pronto — DSFT-98).

## Configuração

Ver [`config.json`](./config.json). Documentação oficial: <https://github.com/changesets/changesets/blob/main/docs/config-file-options.md>.
