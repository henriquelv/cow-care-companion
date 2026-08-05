# Gestão de Cascos

Aplicativo offline-first para registro de casqueamentos, tratamentos, revisões e gestão de fazendas.

Produção: <https://gestao-de-cascos.vercel.app>

## Comandos principais

```bash
npm run dev
npm run test
npm run test:e2e
npm run lint
npm run typecheck
npm run build:vercel
```

## Organização

- `src/telas`: telas completas do aplicativo, separadas por área.
- `src/componentes`: componentes reutilizáveis da interface.
- `src/dominio`: regras de negócio, armazenamento e relatórios.
- `src/servicos`: Supabase, sincronização, ativação e banco local.
- `src/configuracao`: configuração e dados iniciais dos clientes.
- `documentacao`: projeto, histórico de atualizações e anotações.
- `supabase/migrations`: estrutura e evoluções do banco de dados.
- `public`: arquivos públicos do PWA e cache offline.
- `scripts`: QA automatizado e verificação de produção.

Os arquivos técnicos exigidos por Vite, TypeScript, ESLint, Playwright, npm e Vercel permanecem na raiz. A explicação completa está em [documentacao/ESTRUTURA.md](documentacao/ESTRUTURA.md), e os ambientes estão descritos em [documentacao/AMBIENTES.md](documentacao/AMBIENTES.md).
