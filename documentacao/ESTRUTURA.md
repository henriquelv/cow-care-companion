# Estrutura do projeto

## Código do aplicativo

```text
src/
  componentes/
    casco/                 seletores e ajuda clínica reutilizáveis
  configuracao/            dados iniciais e configuração de clientes
  dominio/                 regras do casco, persistência e PDFs
  servicos/                Supabase, IndexedDB, ativação e sincronização
  telas/
    administrador/         gestão, equipe, fazendas e relatórios
    preventivo/            fila de casqueamento preventivo
    principal/             navegação e demais fluxos operacionais
  spa-main.tsx              entrada do React
  styles.css                estilos globais
```

Os nomes originais dos arquivos foram mantidos para facilitar o histórico do Git. As pastas representam a responsabilidade de cada módulo.

## Pastas da raiz

- `documentacao`: especificação, atualizações e anotações de trabalho.
- `public`: manifesto, ícone e service worker necessários para o funcionamento offline.
- `scripts`: testes de interface e validações executáveis.
- `supabase`: migrations do banco de dados.
- `.qa-artifacts`: capturas e logs locais de QA; fica fora do Git e oculta no Explorer.

## Arquivos que permanecem na raiz

`package.json`, arquivos de lock, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `playwright.config.ts`, `vercel.json`, `index.html` e os `.env` precisam permanecer na raiz porque são descobertos automaticamente pelas ferramentas.

O `README.md` também fica na raiz para aparecer como apresentação do projeto no GitHub.

## Próximas separações

O arquivo `src/telas/principal/index.tsx` ainda reúne ativação, agenda, registro, calendário, histórico e configuração. Essas telas devem ser extraídas uma a uma, com teste a cada etapa, porque compartilham estado e navegação do aplicativo em produção.
