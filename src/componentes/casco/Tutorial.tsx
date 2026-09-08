import { useEffect, useMemo, useState, type FormEvent } from "react";
import { HelpCircle, MessageCircleQuestion, Send, X } from "lucide-react";

const SCREEN_HELP: Record<string, { title: string; steps: string[] }> = {
  today: {
    title: "Tela inicial",
    steps: [
      "Use Nova para registrar um atendimento.",
      "A Agenda clínica reúne revisões e prazos de liberação sem repetir os animais na tela.",
      "Use Em tratamento, Com revisão ou Sem visita para reduzir a lista. Toque novamente para desmarcar.",
      "A busca consulta todos os animais pelo número do brinco, mesmo fora do filtro rápido.",
    ],
  },
  register: {
    title: "Registrar visita",
    steps: [
      "Informe o brinco, tipo do animal e lote.",
      "Marque os pés com problema.",
      "Para cada pé, registre doença, gravidade e tratamento.",
      "Revise os dados e salve a visita.",
    ],
  },
  foot: {
    title: "Detalhe do pé",
    steps: [
      "A gravidade vai de 0, sem doença, até 3, grave.",
      "É possível marcar mais de um tratamento.",
      "Use revisão para agendar um novo atendimento.",
      "A foto fica salva no aparelho até a sincronização.",
    ],
  },
  history: {
    title: "Histórico do animal",
    steps: [
      "As visitas aparecem em ordem de data e horário.",
      "Casos curados permanecem no histórico.",
      "Use Registrar correção para ajustar um registro sem apagar o original.",
    ],
  },
  summary: {
    title: "Meu trabalho",
    steps: [
      "Consulte somente os seus atendimentos e animais do período.",
      "Escolha as datas e o tipo antes de gerar seu PDF.",
      "Use Alterar PIN para trocar sua senha numérica com segurança.",
    ],
  },
};

const HELP_ANSWERS = [
  {
    words: ["solicitac", "solicitar", "mancando"],
    answer:
      "Para enviar, use Solicitar atendimento na tela inicial. Para consultar, aceitar, agendar ou excluir, abra Calendário e depois Solicitações pendentes.",
  },
  {
    words: ["excluir", "apagar", "errada"],
    answer:
      "Solicitações podem ser excluídas em Calendário > Solicitações pendentes. Outros cadastros ficam em Menu > Gestão da fazenda ou Administração, conforme sua permissão.",
  },
  {
    words: ["revisao", "retorno", "agenda"],
    answer:
      "A revisão é marcada no fim do atendimento. No Calendário, ela será classificada pela data: atrasada, hoje, próximos 7 dias ou futura.",
  },
  {
    words: ["preventivo", "seis meses", "6 meses"],
    answer:
      "Um atendimento sem lesão pode ser concluído como preventivo. O próximo preventivo entra automaticamente na agenda para seis meses depois.",
  },
  {
    words: ["relatorio", "pdf", "exportar"],
    answer:
      "Abra Meu trabalho para o relatório individual. Gerentes usam Administração para relatórios da equipe. A agenda possui seu próprio botão Baixar agenda em PDF.",
  },
  {
    words: ["senha", "pin", "acesso"],
    answer:
      "Abra Meu trabalho > Alterar PIN. Se o acesso foi perdido, um gerente pode redefinir o PIN na Administração.",
  },
  {
    words: ["offline", "internet", "sincronizar"],
    answer:
      "Depois do primeiro acesso online, o app mantém o login e trabalha offline. O ícone de sincronização envia as pendências quando a internet voltar.",
  },
  {
    words: ["fazenda", "trocar"],
    answer:
      "Abra o menu de três pontos e toque em Trocar fazenda ou acesso. Fazendas já liberadas no aparelho podem ser trocadas offline sem repetir o login.",
  },
  {
    words: ["doenca", "lesao", "taco", "tratamento"],
    answer:
      "Na nova visita, escolha os cascos, a área e as lesões. Depois confirme para registrar tratamentos e taco. Revise tudo no resumo antes de salvar.",
  },
] as const;

const QUICK_QUESTIONS = [
  "Onde vejo solicitações?",
  "Como marco uma revisão?",
  "Como funciona offline?",
];

function normalizeQuestion(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function answerQuestion(question: string) {
  const normalized = normalizeQuestion(question);
  const ranked = HELP_ANSWERS.map((entry) => ({
    entry,
    score: entry.words.filter((word) => normalized.includes(word)).length,
  })).sort((left, right) => right.score - left.score);
  return ranked[0]?.score
    ? ranked[0].entry.answer
    : "Não encontrei essa função. Tente perguntar usando palavras como solicitação, revisão, preventivo, relatório, PIN, fazenda ou offline.";
}

interface HelpModalProps {
  screen: string;
  onClose: () => void;
}

export function HelpModal({ screen, onClose }: HelpModalProps) {
  const content = SCREEN_HELP[screen] ?? SCREEN_HELP.today;
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const answer = useMemo(
    () => (askedQuestion ? answerQuestion(askedQuestion) : ""),
    [askedQuestion],
  );

  function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setAskedQuestion(question.trim());
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="modal-viewport fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div className="modal-panel w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HelpCircle className="h-5 w-5" />
          </span>
          <h2 id="help-modal-title" className="min-w-0 flex-1 text-lg font-extrabold">
            {content.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface"
            aria-label="Fechar ajuda"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ol className="mt-4 space-y-2">
          {content.steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-relaxed">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <section className="mt-5 border-t border-border pt-4" aria-labelledby="help-question-title">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 id="help-question-title" className="font-display text-sm font-black uppercase">
              Pergunte onde fica uma função
            </h3>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((quickQuestion) => (
              <button
                key={quickQuestion}
                type="button"
                onClick={() => {
                  setQuestion(quickQuestion);
                  setAskedQuestion(quickQuestion);
                }}
                className="min-h-10 rounded-lg border border-border bg-surface px-3 text-left text-xs font-semibold"
              >
                {quickQuestion}
              </button>
            ))}
          </div>
          <form onSubmit={ask} className="mt-3 flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Pergunte como encontrar uma função</span>
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ex.: onde excluo uma solicitação?"
                className="min-h-12 w-full rounded-lg border-2 border-border bg-background px-3 outline-none focus:border-primary"
              />
            </label>
            <button
              type="submit"
              disabled={!question.trim()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Enviar pergunta"
            >
              <Send className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>
          {answer ? (
            <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm leading-relaxed">
              <p className="text-[10px] font-black uppercase text-primary">Resposta</p>
              <p className="mt-1">{answer}</p>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Esta ajuda funciona offline e não envia informações da fazenda.
          </p>
        </section>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-12 w-full rounded-xl bg-primary px-4 font-bold text-primary-foreground"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
