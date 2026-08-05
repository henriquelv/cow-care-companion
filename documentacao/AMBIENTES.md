# Arquivos de ambiente

Os quatro arquivos têm finalidades diferentes e ficam na raiz porque o Vite carrega arquivos `.env.[modo]` automaticamente.

| Arquivo           | Finalidade                                                       | Vai para o Git? |
| ----------------- | ---------------------------------------------------------------- | --------------- |
| `.env.example`    | Modelo sem credenciais para configurar outro computador          | Sim             |
| `.env.local`      | Credenciais e tokens somente desta máquina                       | Não             |
| `.env.production` | Variáveis públicas usadas no build de produção                   | Sim             |
| `.env.qa`         | Ambiente isolado dos testes de interface, com modo local forçado | Sim             |

`VITE_SUPABASE_ANON_KEY` ou a chave publishable pode aparecer no frontend porque é uma chave pública protegida pelas políticas RLS. Chaves `service_role`, `sb_secret` e senhas do banco nunca devem usar o prefixo `VITE_`, nunca devem entrar no bundle e nunca devem ser versionadas.

## Quando é possível reduzir

O `.env.production` só poderá ser removido quando as mesmas variáveis estiverem confirmadas nos ambientes Production e Preview do projeto na Vercel. O `.env.qa` deve permanecer enquanto os testes Playwright precisarem operar sem acessar os dados reais.
