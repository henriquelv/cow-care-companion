import { HelpCircle, X } from "lucide-react";

const SCREEN_HELP: Record<string, { title: string; steps: string[] }> = {
  today: {
    title: "Tela inicial",
    steps: [
      "Use Nova para registrar um atendimento.",
      "As abas separam revisões, problemas, animais OK e animais sem visita.",
      "A busca encontra o animal pelo número do brinco.",
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
    title: "Resumo",
    steps: [
      "Consulte atendimentos, gravidade e doenças do período.",
      "Os prazos de curativo ajudam a priorizar os próximos atendimentos.",
    ],
  },
};

interface HelpModalProps {
  screen: string;
  onClose: () => void;
}

export function HelpModal({ screen, onClose }: HelpModalProps) {
  const content = SCREEN_HELP[screen] ?? SCREEN_HELP.today;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HelpCircle className="h-5 w-5" />
          </span>
          <h2 className="min-w-0 flex-1 text-lg font-extrabold">{content.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface"
            aria-label="Fechar ajuda"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ol className="mt-5 space-y-3">
          {content.steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-relaxed">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-14 w-full rounded-xl bg-primary px-4 font-bold text-primary-foreground"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
