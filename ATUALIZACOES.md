# Atualizações e Plano de Melhorias

Este arquivo deve ser atualizado sempre que houver alteração no app. Cada atualização precisa registrar:

- Data da alteração.
- O que foi feito.
- Por que foi feito.
- Como validar.
- Próximos passos.

## 2026-07-01 - Publicação no GitHub

### O que foi feito

- Preparado o projeto atual para publicação no repositório `henriquelv/cow-care-companion`.
- Excluídos do versionamento ferramentas locais em `skills/` e o protótipo descartado `Casco.cod`.
- Mantidos no repositório apenas código, configuração, testes, migration e documentação do produto.

### Por que foi feito

- Atualizar o GitHub sem enviar arquivos locais ou código antigo sem uso.

### Como validar

- Conferir a branch `main` no GitHub.
- Rodar `npm run test`, `npm run lint` e `npm run build` após clonar.

### Próximos passos

- Configurar as variáveis reais do Supabase no ambiente de deploy.
- Ativar proteção da branch principal quando o produto entrar em produção.

## 2026-06-10 - Mockup StarMilk sem erro de Supabase

### O que foi feito

- Adicionado botão "Usar mockup StarMilk" na tela de adicionar fazenda.
- Adicionado aviso visual de modo demo quando o Supabase real não está configurado.
- O fluxo agora cai automaticamente no mockup local se a ativação retornar "Supabase não configurado".
- O mockup cria código `STARMILK`, fazenda `StarMilk` e funcionário `Teste`.

### Por que foi feito

- Evitar que uma configuração incompleta de Supabase bloqueie o teste do app.
- Facilitar a abertura do app e validação do fluxo sem backend real.

### Como validar

- Abrir a tela de adicionar fazenda.
- Clicar em "Usar mockup StarMilk" ou digitar `STARMILK`.
- Confirmar que não aparece mais o alerta "Supabase não configurado".
- Confirmar que aparece fazenda `StarMilk` e funcionário `Teste`.

### Próximos passos

- Configurar Supabase real quando for testar sincronização.
- Remover ou esconder o botão de mockup antes da versão final para cliente.

## 2026-06-10 - Ignorar `.env` de exemplo do Supabase

### O que foi feito

- Ajustada a detecção de Supabase configurado para ignorar valores placeholder.
- Valores como `https://seu-projeto.supabase.co` e `sua-chave-anon-publica` agora não ativam o modo Supabase.
- Com `.env` de exemplo, o app cai corretamente no modo local/demo.

### Por que foi feito

- O app mostrava "Supabase não configurado" ao buscar `STARMILK`, porque tentava usar credenciais de exemplo como se fossem reais.

### Como validar

- Manter `.env` com os valores de exemplo.
- Reiniciar o servidor Vite.
- Digitar `STARMILK` na tela inicial.
- Confirmar que aparece a fazenda `StarMilk` e o funcionário `Teste`.

### Próximos passos

- Trocar `.env` pelos dados reais do Supabase quando o backend estiver pronto.
- Manter `.env.example` apenas como documentação.

## 2026-06-10 - Seed inicial StarMilk

### O que foi feito

- Definido o código inicial `STARMILK`.
- Definida a fazenda inicial como `StarMilk`.
- Definido o funcionário temporário como `Teste`.
- Ajustado o modo local/demo para trazer `StarMilk` e `Teste` ao digitar `STARMILK`.
- Ajustada a migration do Supabase para criar/atualizar cliente e fazenda `StarMilk`.

### Por que foi feito

- Deixar o fluxo inicial igual ao cenário real de teste.
- Evitar nomes genéricos enquanto o cadastro definitivo de funcionários não está pronto.

### Como validar

- Desativar o aparelho/limpar o contexto local.
- Abrir o app e digitar `STARMILK`.
- Confirmar que aparece a fazenda `StarMilk`.
- Confirmar que o funcionário selecionável é `Teste`.

### Próximos passos

- Criar tela gerente para cadastrar funcionários reais por fazenda.
- Definir se cada fazenda terá um link próprio ou se o código do cliente sempre lista várias fazendas.

## 2026-06-10 - Correção de abertura local

### O que foi feito

- Corrigidas funções do store para não acessar `localStorage` durante renderização no servidor.
- Protegidas leituras e escritas locais usadas por visitas, fazenda, tutorial, backup e dados demo.

### Por que foi feito

- O servidor local subia, mas a página podia quebrar com `ReferenceError: localStorage is not defined`.
- O armazenamento local só existe no navegador, não no SSR do Vite/TanStack.

### Como validar

- Rodar `npm run dev -- --host 127.0.0.1 --port 3000`.
- Abrir `http://127.0.0.1:3000/` e confirmar carregamento sem erro.
- Rodar `npm run test`, `npm run lint` e `npm run build`.

### Próximos passos

- Revisar outros serviços browser-only antes de publicar.
- Separar renderização inicial e hidratação de dados locais em hooks dedicados.

## 2026-06-10 - Entrada por link da fazenda e remoção do mapeamento

### O que foi feito

- Removida a tela/etapa de mapeamento por zonas do casco no registro.
- Removidos os componentes específicos `HoofZoneMap` e `ZonePicker`, que não são mais chamados.
- O fluxo de pé com problema agora vai direto para doença, gravidade, tratamento, revisão e foto.
- Atualizados tutorial e ajuda para não orientar o usuário a escolher zona.
- A tela antes da home agora aparece também em modo local/demo, não apenas com Supabase configurado.
- A tela de entrada foi reescrita como "Adicionar Fazenda", aceitando link ou código da fazenda.
- O app aceita link colado e tenta extrair `codigo`, `code`, `fazenda`, `farm` ou o último trecho da URL.

### Por que foi feito

- O mapeamento visual estava deixando o registro mais confuso e lento.
- O usuário precisa informar/adicionar a fazenda antes de entrar nas telas normais do app.
- O teste local precisa refletir o fluxo real de produção.

### Como validar

- Abrir o app sem fazenda ativada e confirmar que a primeira tela é "Adicionar Fazenda".
- Colar um código como `STARMILK` ou um link com esse código e avançar.
- Registrar uma visita com pé lesionado e confirmar que não aparece mapa do casco.
- Confirmar que o fluxo pede doença/gravidade e depois tratamento.
- Rodar `npm run test`, `npm run lint` e `npm run build`.

### Próximos passos

- Definir o formato oficial do link de fazenda para produção.
- Adicionar gerenciamento de funcionários por fazenda na área gerente.
- Revisar a home com teste em celular para reduzir mais ruído visual.

## 2026-05-22 - Auditoria UI/UX e plano completo

### O que foi feito

- Criado este arquivo de acompanhamento de atualizações.
- Registrado o plano completo de melhorias de UI/UX, produto e implementação.
- Consolidada a regra de manter próximos passos documentados a cada mudança.
- Usadas como referência as diretrizes atuais de interface web da Vercel Web Interface Guidelines: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

## 2026-05-22 - Rodada de UI/UX de alta prioridade

### O que foi feito

- Adicionado link "Pular para conteúdo" para navegação por teclado.
- Adicionado foco visível global para botões, links, inputs, selects, textareas e elementos com `tabindex`.
- Adicionado `touch-action: manipulation` para reduzir atraso de toque em dispositivos móveis.
- Adicionado suporte a `prefers-reduced-motion` para reduzir animações e transições quando o usuário pedir.
- Ajustado o rodapé fixo para respeitar `env(safe-area-inset-bottom)`.
- Ajustado o espaço inferior do app para não esconder conteúdo atrás da navegação fixa.
- Adicionado aviso visível "Dados salvos neste aparelho" na tela inicial.
- Melhorados nomes, `aria-label`, `autocomplete` e `spellCheck` em inputs críticos.
- Removido `autoFocus` dos campos principais para evitar abertura inesperada do teclado em mobile.
- Corrigida cópia operacional: "Revisão", "Marcar revisão futura", "Próximo pé" e reticências `…`.
- Adicionados labels acessíveis em campos clínicos avançados do detalhe do pé.
- Adicionado carregamento preguiçoso (`loading="lazy"`) e `decoding="async"` nas fotos exibidas.

### Por que foi feito

- Melhorar uso em celular/tablet no brete.
- Reduzir risco de toque errado e conteúdo escondido pela barra inferior.
- Tornar o app mais seguro para teclado/leitor de tela.
- Deixar claro que os dados ainda são locais do aparelho.

### Como validar

- Navegar usando `Tab` e confirmar que todo foco fica visível.
- Abrir em celular e verificar se a barra inferior não cobre conteúdo.
- Conferir a tela inicial e validar o aviso de dados locais.
- Registrar uma visita com revisão e confirmar que a cópia aparece com acentuação correta.
- Testar com redução de movimento ativada no sistema.

### Próximos passos

- Criar o fluxo de "registro rápido preventivo OK".
- Migrar fotos de `localStorage` para IndexedDB.
- Adicionar PIN simples no modo gerente.
- Melhorar histórico com correção auditável explícita.
- Fazer teste visual em tablet/celular real e registrar os achados aqui.

## 2026-05-27 - Registro rápido preventivo OK

### O que foi feito

- Criada a regra de domínio `createPreventiveVisit` para gerar uma visita preventiva com todos os pés OK.
- Adicionado botão principal "OK" na lista de preventivo para registrar o casqueamento sem abrir o formulário completo.
- Mantido botão secundário "Detalhar" para casos em que o funcionário precisa registrar doença, foto, tratamento ou observação.
- O registro rápido usa brinco, sexo, lote e funcionário atual quando disponíveis.
- Corrigido texto operacional "Todos os pés OK" no resumo.
- Adicionado teste unitário garantindo que a visita preventiva rápida nasce com 4 pés OK e sem doenças.

### Por que foi feito

- Reduzir o tempo de registro para animais saudáveis.
- Transformar a aba de preventivo em uma lista de trabalho de campo, não apenas uma entrada para o formulário clínico.
- Evitar que o funcionário passe por telas desnecessárias quando o procedimento foi apenas preventivo e sem achados.

### Como validar

- Abrir a aba "Preventivo".
- Tocar em "OK" em um animal da lista.
- Confirmar o toast "Preventivo OK registrado".
- Abrir o histórico do animal e conferir a visita preventiva com todos os pés OK.
- Rodar `npm run test`, `npm run lint` e `npm run build`.

### Próximos passos

- Migrar fotos de `localStorage` para IndexedDB.
- Adicionar PIN simples no modo gerente.
- Melhorar histórico com correção auditável explícita.
- Criar resumo diário separado para preventivos registrados.
- Fazer teste visual em tablet/celular real e registrar os achados aqui.

## 2026-05-28 - Base multi-fazenda por código

### O que foi feito

- Adicionadas dependências `@supabase/supabase-js` e `dexie`.
- Criado schema Supabase inicial em `supabase/migrations/202605280001_multi_fazenda_cascos.sql`.
- Criados serviços de Supabase, contexto da fazenda, ativação por código, IndexedDB/Dexie, outbox, sync e mídia.
- Criada tela de ativação por código da fazenda e seleção de funcionário.
- Adicionado isolamento local por `farm_id` nas chaves principais do app.
- Novas visitas entram no outbox como `hoof_visits` para sincronização.
- Configurações da fazenda entram no outbox como `farm_settings`.
- Adicionado botão de sincronização e desativação do aparelho no cabeçalho quando Supabase está configurado.
- Criado `.env.example` com variáveis necessárias para conectar ao Supabase.

### Por que foi feito

- Transformar o app de caderno local em produto multi-fazenda.
- Manter o uso sem login, com ativação por código como `STARMILK`.
- Preparar o fluxo offline-first: salvar local, enfileirar no outbox e sincronizar depois.
- Evitar mistura de dados entre fazendas no mesmo aparelho.

### Como validar

- Criar projeto Supabase e executar a migration SQL.
- Configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Abrir o app e ativar com o código `STARMILK`.
- Escolher um funcionário.
- Registrar uma visita e tocar no botão de sincronização.
- Conferir registros em `hoof_visits` e itens processados no IndexedDB.
- Rodar `npm run test`, `npm run lint` e `npm run build`.

### Próximos passos

- Persistir leituras principais diretamente pelo IndexedDB, deixando `localStorage` apenas como migração/fallback.
- Sincronizar também `hoof_feet`, `animals`, `farm_lotes` e mídias com payloads normalizados.
- Migrar fotos base64 para `hoof_media_blobs` + Supabase Storage bucket `media`.
- Criar painel admin para fazendas, funcionários, dispositivos e licenças.
- Implementar PIN gerente usando `admin_pin` do funcionário.
- Finalizar correção auditável com tabela `hoof_corrections`.

## 2026-05-28 - Gravidade 0-3, revisões rápidas e limpeza

### O que foi feito

- Alterada a escala clínica para `0-3`: ausente, leve, médio e grave.
- Removido o grau 4 da UI de doenças, filtros, tutorial e dados de exemplo.
- Adicionada normalização de dados antigos para converter grau 4 em grau 3 ao carregar/calcular.
- Adicionadas opções rápidas de revisão: 2 dias, 3 dias, 5 dias e 1 semana.
- Mantida a opção de escolher data manualmente para revisão.
- Reorganizada a tela de animais com abas operacionais: Revisão, Problema, OK e Cadastrados.
- Revisões atrasadas agora recebem destaque no topo e na lista.
- Animais apenas cadastrados aparecem como "Sem visita".
- Removido código morto `DeadAnimalsScreen`.
- Removidos componentes de casco não chamados `FootDetail` e `SeverityPicker`.
- Removida função `deleteVisit`, que não era usada no fluxo atual.
- Adicionados testes para normalização de gravidade e datas rápidas de revisão.

### Por que foi feito

- Simplificar o raciocínio clínico no campo.
- Evitar que revisões fiquem misturadas com animais OK ou problemas comuns.
- Reduzir peso e confusão do app removendo código comprovadamente não chamado.
- Tornar a marcação de revisita mais rápida para o funcionário.

### Como validar

- Confirmar que nenhuma tela mostra grau 4.
- Registrar uma doença grau 3 e salvar a visita.
- Marcar revisão em 2, 3, 5 e 7 dias.
- Escolher uma data manual de revisão.
- Confirmar que o animal aparece na aba "Revisão" e no calendário.
- Cadastrar um animal sem visita e confirmar que aparece em "Cadastrados" como "Sem visita".
- Rodar `npm run test`, `npm run lint` e `npm run build`.

### Próximos passos

- Fazer teste visual em celular/tablet para ajustar densidade da nova tela de animais.
- Migrar fotos para IndexedDB + Supabase Storage.
- Persistir leituras principais diretamente pelo IndexedDB.
- Criar painel admin para fazendas, funcionários, dispositivos e licenças.
- Implementar PIN gerente usando `admin_pin` do funcionário.

## 2026-05-28 - Fotos em IndexedDB e sync completo inicial

### O que foi feito

- Fotos novas passaram a ser salvas como blob no IndexedDB (`hoof_media_blobs`).
- O pé passa a guardar uma referência leve `media:<id>` em vez de base64 direto.
- Criado componente de exibição que resolve a foto local via blob URL.
- `addVisit` agora gera payload separado para `hoof_visits`, `hoof_feet` e `hoof_media`.
- Novas visitas gravam também registros locais no Dexie para visita, pés e mídia.
- Configurações, lotes e animais passam a entrar no outbox como `farm_settings`, `farm_lotes` e `animals`.
- Sync passou a processar `hoof_feet` e `hoof_media`, além das tabelas já existentes.
- Upload de mídia usa Supabase Storage bucket `media` no caminho `farms/{farm_id}/hoof/{visit_id}/{media_id}.jpg`.
- Schema Supabase foi ajustado para IDs textuais nas tabelas operacionais, compatível com IDs offline do app.
- Adicionados testes para payload de visita/pés e referência de mídia.

### Por que foi feito

- Reduzir risco de estourar limite do navegador com fotos em base64.
- Aproximar o app do modelo offline-first real: salvar local, enfileirar e sincronizar depois.
- Permitir que fotos feitas offline continuem aparecendo antes de subir para a nuvem.
- Preparar o app para múltiplos aparelhos na mesma fazenda.

### Como validar

- Registrar uma visita com foto.
- Confirmar que o pé guarda referência `media:<id>` e que a foto aparece no app.
- Com Supabase configurado e bucket `media` criado, tocar em sincronizar.
- Conferir upload da foto no Storage e registro em `hoof_media`.
- Conferir `hoof_visits` e `hoof_feet` no Supabase.
- Rodar `npm run test`, `npm run lint` e `npm run build`.

### Próximos passos

- Ler visitas/pés/mídias prioritariamente do IndexedDB, deixando `localStorage` só para migração.
- Exibir foto remota via `storage_path` quando o blob local não existir.
- Criar painel admin para fazendas, funcionários, dispositivos e licenças.
- Implementar PIN gerente usando `admin_pin`.
- Finalizar correção auditável com `hoof_corrections`.

## 2026-05-28 - Hidratação IndexedDB e foto remota

### O que foi feito

- Criada hidratação de visitas a partir do IndexedDB após sincronização.
- O app agora remonta visitas usando `hoof_visits`, `hoof_feet` e `hoof_media` baixados do Supabase.
- Fotos com `media:<id>` agora tentam blob local primeiro e, se não existir, usam `storage_path` salvo em `hoof_media`.
- Adicionado fallback para URL assinada do Supabase Storage.
- Adicionado teste garantindo que uma visita remota com pé e mídia vira visita local exibível.

### Por que foi feito

- Permitir que outro aparelho da mesma fazenda receba histórico, pés e fotos após sincronizar.
- Reduzir dependência do `localStorage` como fonte primária de dados novos.
- Completar o ciclo básico: Supabase -> IndexedDB -> tela atual do app.

### Como validar

- Sincronizar uma visita com foto em um aparelho.
- Abrir outro aparelho/navegador na mesma fazenda.
- Tocar em sincronizar.
- Confirmar que a visita aparece no histórico com pé e referência de foto.
- Confirmar que a foto aparece mesmo sem blob local, usando Storage.
- Rodar `npm run test`, `npm run lint` e `npm run build`.

### Próximos passos

- Migrar as telas para lerem diretamente do IndexedDB sem ponte pelo `localStorage`.
- Criar painel admin para fazendas, funcionários, dispositivos e licenças.
- Implementar PIN gerente usando `admin_pin`.
- Finalizar correção auditável com `hoof_corrections`.

## 2026-05-28 - Ajustes finais de consistência

### O que foi feito

- Atualizados textos do tutorial para o fluxo novo: gravidade 0-3, abas Revisão/Problema/OK/Cadastrados e ação "Nova".
- Removidas referências antigas a "Todos os animais", lixeira e grau 4 na ajuda.
- Ajustado sync em modo local para não tratar Supabase ausente como erro visual.
- Corrigidos comentários internos antigos deixados pela limpeza de código morto.
- Adicionado funcionário no card do histórico da visita, junto da data/hora fixa do atendimento.

### Por que foi feito

- Evitar instruções contraditórias para o usuário.
- Deixar o app coerente tanto em modo local quanto em modo Supabase.
- Reduzir confusão depois das mudanças de UX e dados.

### Como validar

- Abrir ajuda/tutorial e conferir que não há menção a grau 4 ou lixeira.
- Abrir o app sem `.env` de Supabase e confirmar que o modo local não exibe erro de sincronização.
- Registrar uma visita com funcionário e confirmar que ele aparece no resumo e no histórico.
- Rodar `npm run test`, `npm run lint` e `npm run build`.

### Próximos passos

- Fazer teste visual em celular/tablet da nova tela de animais e revisões.
- Criar painel admin para fazendas, funcionários, dispositivos e licenças.
- Adicionar PIN gerente baseado no funcionário ativado.
- Melhorar a tela de histórico com correção auditável explícita.

## 2026-05-29 - Código de cliente com múltiplas fazendas

### O que foi feito

- Alterado o modelo de ativação para tratar o código como conta/cliente.
- Adicionada etapa de seleção da fazenda depois do código do cliente.
- Adicionado botão para criar nova fazenda dentro do cliente durante a ativação.
- Mantido isolamento operacional por `farm_id`, então uma fazenda não mistura visitas, animais, mídias, lotes e configurações com outra.
- Atualizado o contexto local para guardar cliente, fazenda, funcionário e aparelho.
- Atualizada a migration do Supabase com tabela `clients`, relação `farms.client_id` e exemplo `STARMILK`.
- Mantida compatibilidade com bancos antigos que ainda usam `farms.activation_code`.
- Melhorada a tela de ativação em 3 passos: Código, Fazenda e Funcionário.

### Por que foi feito

- Um cliente pode ter mais de uma fazenda usando o mesmo código.
- A seleção explícita da fazenda reduz risco de lançar atendimento no lugar errado.
- O app continua sem login tradicional, mas fica pronto para vender por cliente/conta.

### Como validar

- Criar/aplicar a migration no Supabase.
- Abrir o app sem contexto salvo e digitar `STARMILK`.
- Confirmar que o app mostra o cliente, lista as fazendas e permite adicionar nova fazenda.
- Escolher uma fazenda, selecionar funcionário e ativar o aparelho.
- Registrar visitas em duas fazendas diferentes e confirmar que o histórico não se mistura.
- Rodar `npm run test`, `npm run lint` e `npm run build`.

### Próximos passos

- Criar painel gerente para editar fazendas do cliente depois da ativação.
- Adicionar cadastro de funcionários por fazenda na própria área gerente.
- Revisar regras de RLS no Supabase antes de produção pública.
- Fazer teste visual em celular/tablet no fluxo completo código -> fazenda -> funcionário.

## Estado atual do app

O app já tem uma base boa para uso real em fazenda:

- Registro offline-first de visitas por animal.
- Fluxo de brinco, pés, diagnóstico, tratamento e resumo.
- Histórico por animal.
- Calendário de revisão.
- Lista de casqueamento preventivo.
- Modo gerente para configurações, cadastros e backup.
- Exportação/importação de backup local.
- Testes básicos para regras de domínio.

O maior risco de UX ainda é o app ficar complexo demais para o funcionário no brete. A direção principal continua sendo: poucos toques, botões grandes, pouco texto e caminhos claros.

## Plano completo de melhorias

### 1. Fluxo de campo

Prioridade: alta.

- Reduzir o registro diário para um caminho principal: brinco -> pés -> zona/doença -> tratamento -> salvar.
- Manter campos extras sempre recolhidos por padrão.
- Criar uma versão "registro rápido" para animal sem problema: brinco -> todos OK -> salvar.
- Criar uma ação clara para "corrigir registro" sem editar ou apagar histórico antigo.
- Mostrar no resumo final apenas o necessário para conferência: brinco, pés afetados, doença, grau, revisão e foto.

Critério de sucesso:

- Funcionário registra uma vaca sem problema em menos de 20 segundos.
- Funcionário registra uma vaca com 1 pé lesionado em menos de 60 segundos.
- O fluxo funciona sem precisar ler textos longos.

### 2. UI mobile e toque

Prioridade: alta.

- Aumentar consistência dos botões de ação principais.
- Garantir alvos de toque de pelo menos 56 px em todo o fluxo.
- Evitar muitos botões empilhados com o mesmo peso visual.
- Diferenciar melhor ações primárias, secundárias e perigosas.
- Adicionar estados `focus-visible` consistentes para teclado/acessibilidade.
- Adicionar `touch-action: manipulation` global para reduzir atraso de toque.
- Ajustar áreas de segurança no rodapé usando `env(safe-area-inset-bottom)`.

Critério de sucesso:

- Botões principais são fáceis de acertar em celular/tablet.
- Nada importante fica escondido atrás da barra inferior ou área segura do aparelho.

### 3. Acessibilidade

Prioridade: alta.

- Revisar botões com ícone para garantir `aria-label`.
- Associar inputs a labels reais ou `aria-label`.
- Remover `outline-none` onde não houver substituição por `focus-visible`.
- Usar `aria-live` para mensagens de sucesso, erro e importação de backup.
- Melhorar ordem de headings por tela.
- Adicionar link de pular para conteúdo principal.
- Marcar ícones decorativos como `aria-hidden`.

Critério de sucesso:

- Navegação por teclado identifica foco em todos os controles.
- Leitor de tela entende as ações principais sem depender de emoji.

### 4. Linguagem e clareza

Prioridade: alta.

- Padronizar acentos e termos: "Revisão", "Próximo pé", "Pés OK", "Abscesso de Sola".
- Evitar frases longas no fluxo do funcionário.
- Usar verbos diretos nos botões: "Salvar Visita", "Registrar Correção", "Exportar Backup".
- Separar linguagem operacional da linguagem clínica detalhada.
- Validar nomes das doenças com veterinário/casqueador antes de travar a lista.

Critério de sucesso:

- Funcionário entende cada tela pela primeira ação visível.
- Gerente encontra detalhes clínicos sem poluir o fluxo de campo.

### 5. Modo gerente

Prioridade: média/alta.

- Adicionar PIN simples ou bloqueio local para o modo gerente.
- Separar melhor abas: Fazenda, Cadastros, Backup, Avançado.
- Mover dados de teste para uma área menos acessível.
- Criar tela de auditoria com registros recentes e correções.
- Permitir configurar lista de doenças visíveis para funcionário.
- Permitir configurar tratamentos e comentários padrão.

Critério de sucesso:

- Funcionário não altera cadastros/backups por acidente.
- Gerente consegue adaptar o app à fazenda sem mexer em código.

### 6. Histórico e auditoria

Prioridade: alta.

- Trocar exclusão física por arquivamento/cancelamento auditável.
- Criar modelo de "correção de visita" apontando para o registro original.
- Mostrar linha do tempo clara: diagnóstico inicial, revisões, cura/liberação.
- Destacar casos reincidentes antes de começar nova visita.
- Mostrar "última visita" e "pior gravidade ativa" no topo do histórico.

Critério de sucesso:

- Nenhum dado clínico importante some sem rastro.
- O histórico responde rapidamente se o animal é recorrente, curado ou pendente.

### 7. Preventivo

Prioridade: média/alta.

- Transformar preventivo em lista de trabalho diária.
- Adicionar filtros por lote, dias vencidos e nunca casqueado.
- Mostrar prioridade visual: nunca casqueado, vencido, em dia.
- Criar ação rápida "registrar preventivo OK".
- Criar resumo do dia de preventivo separado de casos clínicos.

Critério de sucesso:

- Gerente consegue montar a fila do dia.
- Funcionário consegue registrar preventivo sem passar por todo o fluxo clínico.

### 8. Dados, backup e offline

Prioridade: alta.

- Migrar fotos de base64/localStorage para IndexedDB.
- Manter metadados leves no `localStorage` ou mover tudo para IndexedDB.
- Adicionar aviso persistente: "Dados salvos neste aparelho".
- Criar rotina visual de backup recomendado.
- Adicionar validação ao importar backup: fazenda, quantidade de visitas, data do arquivo.
- Adicionar restauração com confirmação clara antes de sobrescrever dados.
- Futuramente, adicionar sincronização com backend quando houver internet.

Critério de sucesso:

- Fotos não quebram o armazenamento do navegador.
- Gerente consegue recuperar dados em outro aparelho com segurança.

### 9. Performance e listas grandes

Prioridade: média.

- Virtualizar lista de animais quando passar de 50 itens.
- Evitar recalcular estatísticas grandes durante digitação.
- Considerar índices locais por brinco/data/doença.
- Adicionar `content-visibility: auto` em listas longas.
- Revisar imagens com `loading="lazy"` e dimensões explícitas.

Critério de sucesso:

- Busca e histórico continuam rápidos com centenas ou milhares de visitas.

### 10. Responsividade e layout

Prioridade: média.

- Testar visualmente em celular estreito, tablet Android e desktop.
- Ajustar grid de botões para não quebrar texto.
- Garantir `min-w-0`, `truncate` ou `break-words` onde há nomes longos.
- Evitar `transition-all`; especificar propriedades animadas.
- Respeitar `prefers-reduced-motion`.

Critério de sucesso:

- Nenhum texto estoura botão/card.
- A tela permanece usável em celular pequeno e tablet.

### 11. Visual design

Prioridade: média.

- Manter estética "caderno de campo", mas reduzir ruído visual nas telas de trabalho.
- Usar cor forte apenas para estado/ação importante.
- Criar hierarquia mais rígida: ação primária, seleção ativa, alerta, informação.
- Evitar excesso de emojis quando houver ícones claros.
- Criar legenda fixa e simples para cores dos pés e gravidade.

Critério de sucesso:

- A interface parece ferramenta de trabalho, não painel decorativo.
- O olhar vai naturalmente para a próxima ação.

### 12. Testes e validação em campo

Prioridade: alta.

- Testar com pelo menos 2 funcionários reais.
- Medir tempo de registro sem problema e com 1 lesão.
- Observar erros comuns: pé errado, doença errada, esqueceu revisão, salvou cedo.
- Testar offline real, fechar app, abrir de novo e validar dados.
- Testar exportar/importar backup em outro navegador/aparelho.

Critério de sucesso:

- Funcionário consegue operar sem ajuda constante.
- Gerente confia que os dados não se perdem.

## Próximos passos recomendados

1. Migrar as telas para lerem diretamente do IndexedDB sem ponte pelo `localStorage`.
2. Fazer teste visual em celular/tablet da nova tela de animais e revisões.
3. Criar painel admin para fazendas, funcionários, dispositivos e licenças.
4. Adicionar PIN gerente baseado no funcionário ativado.
5. Melhorar a tela de histórico com correção auditável explícita.

## Como validar a versão atual

- `npm run test`
- `npm run lint`
- `npm run build`
- Abrir `http://127.0.0.1:8080/` com o servidor dev ativo.
- Abrir a aba "Preventivo" e registrar um animal pelo botão "OK".
- Registrar uma vaca sem problema.
- Registrar uma vaca com 1 pé lesionado.
- Exportar backup e importar novamente.
- Abrir histórico e usar "Registrar correção".
