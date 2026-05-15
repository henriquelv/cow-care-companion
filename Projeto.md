# App de Registro de Casco Bovino

## 1. Visão geral

App mobile (Android, tablet) usado **dentro da fazenda** para registrar problemas de casco em vacas de forma simples, rápida e padronizada.

- Foco em funcionários com **baixa escolaridade**: telas com poucos botões, ícones grandes, quase sem texto.
- **Um app por fazenda**: a fazenda é configurada uma vez e não é escolhida pelo funcionário.
- Funciona **offline** durante o dia. Sincronização / exportação é opcional e feita depois, por um usuário mais avançado (gerente/vet).
- Conceito igual aos sistemas profissionais de casco: registrar **qual pé, qual parte do pé, qual doença e quão severa** com poucos toques. [web:7][web:102]

---

## 2. Públicos e contexto de uso

### 2.1 Funcionário (casqueador interno da fazenda)

- Pessoa que está no brete / tronco fazendo o casqueamento.
- Pode ter baixa escolaridade, pouca familiaridade com texto longo e menus complexos.
- Precisa registrar “o básico bem feito” sem perder tempo.

### 2.2 Gerente / Veterinário

- Usa o app (ou módulo web) para:
  - Ver histórico por vaca.
  - Ver gráficos simples de severidade x tempo.
  - Configurar lista de doenças, comentários padrão, prazos de recheck.

Implicações de design:

- O que é **complexo** (gráficos, listas grandes, textos longos) fica escondido em **modo gerente**.
- O funcionário vê apenas **ícones, números simples e confirmação visual**.

---

## 3. Objetivos do app

- Para **cada vaca atendida** registrar:
  - Qual pé foi tratado (FL, FR, BL, BR).
  - Em **qual zona** do casco está o problema (mapa numerado 0–12).
  - Qual **doença** principal (lista curta de códigos + ícones).
  - Qual a **gravidade (0–4)**.
  - Qual **tratamento** foi aplicado (linha de ícones).
  - Se há **recheck** e quando.
  - **Data e hora exatas** do registro (imutáveis).
- Gerar **histórico por animal**, mostrando datas, pés, zonas, doenças, gravidades e tratamentos.
- Criar **listas do dia** (quantas vacas vistas, quantos pés, quantos casos graves).
- Oferecer para o gerente uma visão gráfica simples de evolução das lesões (inspirado no gráfico de “Treatment / Severity x Time” do All4feet). [web:102]

---

## 4. Fluxo geral de uso (funcionário)

1. Abrir o app → **Tela Inicial do Dia**.
2. Tocar em **“Nova vaca”** → **Tela de Brinco**.
3. Digitar brinco e tipo (vaca/touro) → **Tela dos 4 Pés**.
4. Marcar quais pés estão bons e quais têm problema.
5. Para cada pé com problema → abrir **Tela do Pezinho (zona)**.
6. Na Tela do Pezinho:
   - Escolher **zona (0–12)**.
   - Escolher **doença**.
   - Escolher **gravidade 0–4**.
   - Escolher **tratamento** (ícones).
   - Marcar **recheck** (se necessário).
   - Opcionalmente tirar **foto**.
7. Voltar à **Tela dos 4 Pés** até terminar.
8. Ir para **Tela de Resumo do Animal** e concluir registro.
9. Voltar à **Tela Inicial** ou ver **Lista do Dia**.

---

## 5. Telas do funcionário

### 5.1 Tela Inicial do Dia

**Propósito**

Ponto de partida do funcionário.

**Elementos**

- Nome da fazenda no topo (somente leitura).
- Três botões gigantes no centro:
  - **Nova vaca** – ícone de vaca com “+”.
  - **Lista do dia** – ícone de lista.
  - **Histórico** – ícone de lupa sobre vaca.

**Ações**

- “Nova vaca” → Tela de Brinco.
- “Lista do dia” → Tela Lista do Dia.
- “Histórico” → Tela Histórico do Animal.

---

### 5.2 Tela de Brinco do Animal

**Propósito**

Identificar a vaca/touro.

**Elementos**

- Campo grande para **número do brinco** (teclado numérico).
- Botões de tipo:
  - Vaca (🐄).
  - Touro (🐂).
- Botão verde grande de **continuar** (✔ / seta →).
- Botão vermelho de **voltar** (✖ / seta ←).

**Comportamentos**

- Se o brinco já existe com lesões recentes, aparece um **ícone de alerta** (semáforo) indicando vaca reincidente.
- No backend, é criado (ou recuperado) o registro de “animal”.

**Ações**

- Digitar brinco → escolher tipo → continuar → Tela dos 4 Pés.

---

### 5.3 Tela dos 4 Pés

**Propósito**

Marcar quais pés estão bons ou com problema.

**Elementos**

- Ícones dos 4 pés:
  - FL (Front Left / Dianteiro Esquerdo).
  - FR (Front Right / Dianteiro Direito).
  - BL (Back Left / Traseiro Esquerdo).
  - BR (Back Right / Traseiro Direito).
- Cada pé é um “pezinho” estilizado, com cor de estado:
  - Cinza: não marcado.
  - Verde: sem problema.
  - Vermelho: com problema.
- Botão verde **“Próximo”** (para ir ao resumo).
- Botão vermelho **“Voltar”** (volta para Brinco).

**Interação**

- Primeiro toque em um pé:
  - Marca como **verde** (sem problema).
- Segundo toque no mesmo pé:
  - Marca como **vermelho** (tem problema).
  - Abre a **Tela do Pezinho (zona)** para esse pé.
- O botão “Próximo” só habilita depois que TODOS os quatro pés têm estado definido (verde ou vermelho).

---

### 5.4 Tela do Pezinho (zona, doença, gravidade, tratamento, recheck)

**Propósito**

Registrar em detalhe o problema de um pé.

#### 5.4.1 Mapa de casco (zonas 0–12)

**Elementos**

- Desenho grande da sola do casco daquele pé, baseado em mapas profissionais com **12 zonas numeradas (0–12)**, como visto no All4feet. [file:92][file:100][web:63][web:66]
- As zonas são áreas clicáveis:
  - 0 – região central / almofada.
  - 1–2 – parede / linha branca frontal.
  - 3–4 – sola lateral.
  - 5–6 – sola posterior.
  - 7–9 – zonas da garra lateral.
  - 10–12 – zonas adicionais (talão / bordas), conforme desenho.

**Interação**

- Tocar em uma zona → a área fica destacada (cor forte, ex. amarelo).
- O número da zona aparece em destaque (por ex., “Zona 4”).

#### 5.4.2 Doenças (lista curta com códigos)

Baseado nos vídeos, o All4feet tem uma lista extensa de doenças com siglas (SU, BU, DD, etc.), cada uma com severidade 0–4. [file:93][file:95][web:102]

No nosso app, para o funcionário, mostramos **uma lista reduzida** com as mais comuns, cada uma com:

- **Sigla grande** (2–3 letras).
- **Ícone simples**.
- Cor padronizada (para relatórios).

Sugestão inicial:

- **SU** – Sole Ulcer / Úlcera de sola.
- **SB** – Sole Bruising / Hemorragia de sola.
- **WL** – White Line / Doença da linha branca.
- **DD** – Digital Dermatitis.
- **SH** – Sole Haemorrhage / Laminite.
- **TS** – Thin Sole / Sola fina.
- **P** – Puncture / Perfuração.
- **ID** – Lesão interdigital / Fenda.
- **OUT** – Outros.

(Doenças podem ser configuradas no **modo gerente**, semelhante ao que o All4feet permite com listas extensas e códigos. [web:102])

#### 5.4.3 Gravidade (0–4 como no All4feet)

Os vídeos mostram uma **escala de 0 a 4** para cada doença, onde 0 = ausência e 1–4 = gravidades crescentes. [file:96][file:97][web:102]

- 0 – Sem lesão (não marcado / branco).
- 1 – Lesão leve (preocupação do trimmer).
- 2 – Lameira clara, problema relevante.
- 3 – Lesão séria, necessidade de tratamento forte.
- 4 – Caso muito grave / bem-estar animal / possível indicação de eutanásia ou remoção de garra.

**UI**

- Para o funcionário, aparece uma pequena linha de **5 quadrados**: 0, 1, 2, 3, 4.
- Ele toca no número da gravidade desejada:
  - 0 fica roxo (como no vídeo deles) se for ausência.
  - 1–4 ficam coloridos com gradiente (verde → amarelo → laranja → vermelho). [file:96][file:97]

#### 5.4.4 Tratamento (linha de ícones)

Inspirado no conjunto de ícones do All4feet (tirar excesso de parede, rodar pé, bandagem, bandagem removida, etc.). [file:94][file:98]

Linha de ícones:

1. **Trim** – aparar casco (ícone de casco com faca).
2. **Alívio / rebaixar** – reduzir pressão em área específica (setas em volta do casco).
3. **Bandagem ON** – casco enfaixado.
4. **Bandagem OFF** – remover bandagem (ícone igual, mas com seta saindo).
5. **Bloco** – aplicação de bloco.
6. **Outros** – tratamento especial (ex.: spray, produto específico).

Fluxo simples:

- O funcionário toca nos ícones que representam o que foi feito naquele pé (pode marcar mais de um).
- No backend, cada ícone vira um flag na lesão.

#### 5.4.5 Comentários padrão (D1, D2, D3…)

O All4feet usa uma lista de comentários predefinidos D1, D2, D3 (Already trimmed, Recommend claw removed, Animal Welfare Concerns, etc.). [file:93][web:102]

No nosso app:

- Mostramos **códigos D1, D2, D3…** em uma lista simples.
- Cada código tem um texto completo configurado no modo gerente (ex.: “D3 – Animal com preocupação de bem-estar”).
- Para o funcionário, basta tocar no código (D1, D2…); ele não precisa ler a frase toda.

#### 5.4.6 Recheck

- Um **botão de recheck** (ícone de relógio) permite marcar que o animal deve ser revisto.
- O gerente define a regra (ex.: 4 semanas; 6 semanas).
- Para o funcionário, é só ligar/desligar esse botão.
- Internamente, o sistema grava a **data de recheck**.

#### 5.4.7 Foto

- Botão de câmera para tirar foto do casco.
- Foto é linkada à lesão (zona + doença + gravidade).

#### 5.4.8 Ações da tela do pezinho

- **Salvar pé** – botão verde grande (✔) cria um registro `LesaoCasco` com:
  - pé, zona, doença, gravidade, tratamentos, comentários D1.., recheck, foto, `created_at`, `created_by`.
- **Voltar** – botão vermelho (✖) retorna à Tela dos 4 Pés sem salvar.

---

### 5.5 Tela de Resumo do Animal

**Propósito**

Mostrar tudo que foi registrado para o animal antes de concluir.

**Elementos**

- Brinco em destaque.
- Tabela simples com 4 linhas (FL, FR, BL, BR):
  - Ícone do pé (verde / vermelho).
  - Se vermelho, ícone pequeno com a **zona principal** e **doença principal + gravidade** (ex.: “Zona 4 – SU 3”).
- Ícone de alerta se houver rechecks marcados.

**Ações**

- Tocar em um pé → volta à Tela do Pezinho (cria novo registro de correção, sem editar o antigo).
- “Concluir vaca” (✔ grande) → salva e volta à Tela Inicial.

---

### 5.6 Tela de Lista do Dia

**Propósito**

Resumo rápido do que foi feito no dia.

**Elementos**

- Data atual.
- Indicadores:
  - Animais vistos.
  - Pés com problema.
  - Casos graves (gravidade 3–4).
- Lista:
  - Uma linha por animal: brinco + 4 ícones de pés com cores.

**Ações**

- Tocar em um animal → abre Resumo do Animal (somente leitura para funcionário).
- Voltar → Tela Inicial.

---

### 5.7 Tela de Histórico do Animal

**Propósito**

Ver se o animal é reincidente.

**Elementos**

- Campo de brinco (teclado numérico).
- Lista de visitas:
  - Data / hora.
  - Pequeno blocos FL/FR/BL/BR coloridos (como no gráfico do All4feet). [file:91]
  - Gravidade máxima de cada visita.

**Ações**

- Digitar brinco → ver histórico completo.
- Voltar → Tela Inicial.

---

## 6. Módulo Gerente (app ou web)

Inspirado na tela de gráfico de “Treatment” e na lista de doenças coloridas que o All4feet mostra. [file:91][web:102]

### 6.1 Dashboard do animal

- Gráfico **Severity x Time** para cada pé:
  - Eixo X: datas das visitas.
  - Eixo Y: gravidade 0–4.
  - Linhas coloridas por pé (FL, FR, BL, BR), como no vídeo. [file:91]
- Lista lateral de visitas (data/hora + pés) para selecionar qual visita destacar.

### 6.2 Lista de doenças e cores

- Tabela com todas as doenças, siglas e cores (como o “All diseases” no rodapé do gráfico). [file:91]
- Permite ativar/desativar doenças disponíveis para o funcionário (foco na simplificação da interface).

### 6.3 Comentários padrão

- Tela para editar textos: D1, D2, D3…
- Funcionário continua vendo só os códigos, mas os relatórios e o gerente veem o texto completo. [file:93]

### 6.4 Configuração de scoring

- Tela com mapa de casco 0–12, permitindo destacar zonas de maior interesse (como a tela de “New Scoring Setup” do All4feet). [file:99]
- Ajuste da escala de gravidade:
  - Por padrão 0–4 (igual All4feet).
  - Futuramente, permitir trocar para outro esquema se a fazenda quiser (ex.: apenas 0–2).

---

## 7. Modelo de dados (conceitual)

### 7.1 Animal

- `id`
- `brinco`
- `tipo` (vaca/touro)

### 7.2 Visita

- `id`
- `animal_id`
- `data` (data da visita / atendimento)
- `criado_por` (usuário)
- Campos de apoio (ex.: “sessão do dia”, se quiser agrupar visitas por dia).

### 7.3 LesaoCasco

Um registro por combinação pé + zona + doença (como no tratamento do All4feet). [web:102]

- `id`
- `animal_id`
- `visita_id`
- `pe` (FL, FR, BL, BR)
- `zona` (0–12)
- `doenca_tipo` (SU, SB, WL, DD, etc.)
- `gravidade` (0–4)
- `tratamento_trim` (bool)
- `tratamento_alivio` (bool)
- `tratamento_bandagem_on` (bool)
- `tratamento_bandagem_off` (bool)
- `tratamento_bloco` (bool)
- `tratamento_outros` (bool)
- `comentario_codigo` (D1, D2, …)
- `recheck_data` (opcional)
- `foto_url` (opcional)
- **`created_at`** (timestamp, imutável)
- **`created_by`** (usuário)
- `is_correction_of` (opcional – id de outro registro, caso seja correção)

---

## 8. Regras de negócio críticas

### 8.1 Imutabilidade de data/hora

- No momento em que o funcionário toca **“Salvar pé”**, o backend (ou camada local) gera:
  - `created_at` = data/hora exatas (idealmente fonte confiável).
  - `created_by` = usuário logado.
- A UI **não tem campos de edição** de data/hora.
- Se precisar corrigir:
  - A ação de “Corrigir” cria **novo registro** com novo `created_at` e `is_correction_of` apontando para o original.
- No banco, bloquear UPDATE/DELETE para usuários comuns nessa tabela, permitindo apenas INSERT, alinhado com boas práticas de audit log clínico. [web:78][web:86][web:87]

### 8.2 Simplicidade para o funcionário

- Fluxo sempre linear:
  - Brinco → 4 pés → Pezinho (quando precisa) → Resumo → Concluir.
- Interface com **pouco texto**:
  - Códigos (SU, DD, D1, D2).
  - Ícones de tratamento.
  - Cores fortes.
- Configurações, textos longos, gráficos e integrações ficam no **modo gerente**.

---

