import { useState } from "react";
import { X, ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { markTutorialDone } from "@/lib/casco-store";

interface Slide {
  icon: string;
  title: string;
  body: string;
  tip?: string;
  visual?: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    icon: "🐄",
    title: "Caderninho de Casco",
    body: "Este app registra os problemas de casco das vacas. É fácil de usar e funciona sem internet.",
    tip: "Toque na seta → para continuar",
    visual: (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface p-4">
        <div className="flex gap-3">
          <div className="rounded-xl bg-good/20 p-3 text-center">
            <div className="font-display text-3xl font-black">5</div>
            <div className="text-[10px] uppercase text-muted-foreground">Animais</div>
          </div>
          <div className="rounded-xl bg-warn/20 p-3 text-center">
            <div className="font-display text-3xl font-black text-warn-foreground">3</div>
            <div className="text-[10px] uppercase text-muted-foreground">Problemas</div>
          </div>
          <div className="rounded-xl bg-danger/10 p-3 text-center">
            <div className="font-display text-3xl font-black text-danger">1</div>
            <div className="text-[10px] uppercase text-muted-foreground">Graves</div>
          </div>
        </div>
        <div className="w-full rounded-xl bg-primary py-3 text-center font-display text-sm uppercase text-primary-foreground">
          + Nova Vaca
        </div>
      </div>
    ),
  },
  {
    icon: "🔢",
    title: "Brinco e Tipo",
    body: "Digite o número do brinco da vaca. Depois toque em VACA 🐄 ou TOURO 🐂.",
    tip: "O teclado abre automático — só digitar o número.",
    visual: (
      <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
        <div className="rounded-xl border-2 border-primary bg-card px-4 py-3 text-center font-display text-4xl font-black">
          1284
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border-2 border-primary bg-primary py-2 text-center text-xl">
            🐄 Vaca
          </div>
          <div className="rounded-xl border-2 border-border py-2 text-center text-xl">
            🐂 Touro
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "🦶",
    title: "Os 4 Pés",
    body: "Toque em cada pé da vaca para dizer se está BOM ou COM PROBLEMA.",
    tip: "1º toque = BOM ✅ · 2º toque = COM PROBLEMA ⚠️",
    visual: (
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface p-4">
        <div className="flex flex-col items-center rounded-xl border-2 border-good bg-good/10 p-3">
          <div className="rounded-full bg-good p-1.5">
            <span className="text-lg leading-none text-white">✓</span>
          </div>
          <span className="mt-1 text-[10px] font-bold uppercase text-good">Frente Esq.</span>
          <span className="text-[9px] text-good">Bom</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border-2 border-danger bg-danger/10 p-3">
          <div className="rounded-full bg-danger p-1.5 animate-pulse">
            <span className="text-lg leading-none text-white">⚠</span>
          </div>
          <span className="mt-1 text-[10px] font-bold uppercase text-danger">Frente Dir.</span>
          <span className="text-[9px] text-danger">Problema</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border-2 border-good bg-good/10 p-3">
          <div className="rounded-full bg-good p-1.5">
            <span className="text-lg leading-none text-white">✓</span>
          </div>
          <span className="mt-1 text-[10px] font-bold uppercase text-good">Trás Esq.</span>
          <span className="text-[9px] text-good">Bom</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border-2 border-border bg-surface p-3">
          <div className="rounded-full bg-muted p-1.5">
            <span className="text-lg leading-none text-muted-foreground">?</span>
          </div>
          <span className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Trás Dir.</span>
          <span className="text-[9px] text-muted-foreground">Tocar...</span>
        </div>
      </div>
    ),
  },
  {
    icon: "🗺️",
    title: "Zona do Casco",
    body: "Toque na parte do casco onde está o problema. Pode escolher mais de uma zona.",
    tip: "A cor muda conforme a gravidade da doença escolhida.",
    visual: (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface p-4">
        <div className="relative w-32">
          {/* Mini representação do casco */}
          <svg viewBox="0 0 100 148" className="w-full">
            <path
              d="M 50,4 C 80,4 94,20 94,50 L 94,100 Q 94,138 70,143 Q 50,148 30,143 Q 6,138 6,100 L 6,50 C 6,20 20,4 50,4 Z"
              fill="#f3f4f6"
              stroke="#9ca3af"
              strokeWidth="1.5"
            />
            <path d="M 38,8 L 62,8 L 60,33 L 40,33 Z" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1.5" />
            <path d="M 13,57 L 87,57 L 87,90 L 13,90 Z" fill="#fecaca" stroke="#dc2626" strokeWidth="1.5" />
            <text x="50" y="22" textAnchor="middle" fontSize="7" fontWeight="800" fill="#713f12">1</text>
            <text x="50" y="76" textAnchor="middle" fontSize="7" fontWeight="800" fill="#7f1d1d">0</text>
          </svg>
        </div>
        <div className="grid grid-cols-7 gap-1 w-full">
          {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(z => (
            <div
              key={z}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg border-2 font-display text-[10px] font-black",
                z === 0 || z === 1 ? "border-danger/50 bg-danger/20 text-danger" : "border-border bg-card"
              )}
            >
              {z}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: "🔍",
    title: "Doença e Gravidade",
    body: "Para cada doença, escolha a gravidade de 0 a 4. Zero significa que não tem esse problema.",
    tip: "Pode marcar mais de uma doença no mesmo pé.",
    visual: (
      <div className="space-y-1.5 rounded-2xl bg-surface p-3">
        {[
          { code: "SH", emoji: "🟡", full: "Hemorragia / Laminite", sev: 2 },
          { code: "DD", emoji: "🦠", full: "Dermatite Digital", sev: 0 },
          { code: "SU", emoji: "🔴", full: "Úlcera de Sola", sev: 3 },
        ].map(({ code, emoji, full, sev }) => (
          <div
            key={code}
            className={cn(
              "rounded-xl border-2 p-2",
              sev > 0 ? "border-danger/40 bg-danger/5" : "border-border bg-card",
            )}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-base leading-none">{emoji}</span>
              <span className="font-display text-xs font-black uppercase">{code}</span>
              <span className="text-[9px] text-muted-foreground flex-1 truncate">{full}</span>
              {sev > 0 && <span className="text-[9px] font-black text-danger">Grav.{sev}</span>}
            </div>
            <div className="grid grid-cols-5 gap-0.5">
              {[0,1,2,3,4].map(s => (
                <div
                  key={s}
                  className={cn(
                    "rounded-md py-1 text-center font-display text-[10px] font-black",
                    s === sev
                      ? s === 0 ? "bg-muted" : s <= 1 ? "bg-warn" : s === 2 ? "bg-accent" : "bg-danger text-white"
                      : "bg-muted/40 text-muted-foreground",
                  )}
                >
                  {s === 0 ? "—" : s}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: "💊",
    title: "Tratamento",
    body: "Marque o que foi feito no pé. Pode marcar mais de um tratamento.",
    tip: "Toque nos botões do que foi feito. Ficam verdes quando selecionados.",
    visual: (
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface p-3">
        {[
          { e: "🔪", t: "Casquear", a: true },
          { e: "🩹", t: "Curativo", a: true },
          { e: "🟦", t: "Bloco", a: false },
          { e: "💧", t: "Spray", a: false },
        ].map(({ e, t, a }) => (
          <div
            key={t}
            className={cn(
              "flex items-center gap-2 rounded-xl border-2 px-2 py-2 font-display text-xs uppercase",
              a ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
            )}
          >
            <span className="text-lg leading-none">{e}</span>
            <span>{t}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: "✅",
    title: "Marcar como Curado",
    body: "Se o problema foi resolvido, toque em MARCAR COMO CURADO. O histórico fica salvo.",
    tip: "O botão fica verde quando o casco é marcado como curado.",
    visual: (
      <div className="space-y-2 rounded-2xl bg-surface p-3">
        <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-good bg-good py-3 text-good-foreground">
          <span className="text-xl">✅</span>
          <span className="font-display text-sm uppercase font-black">Marcado como CURADO</span>
        </div>
        <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-border bg-card py-3 text-muted-foreground">
          <span className="text-xl">⏰</span>
          <span className="font-display text-sm uppercase">Marcar revisão futura</span>
        </div>
      </div>
    ),
  },
  {
    icon: "💾",
    title: "Salvar a Visita",
    body: "Quando terminar todos os pés, toque em SALVAR VISITA. Fica salvo no aparelho, mesmo sem internet.",
    tip: "O botão verde fica ativo só quando tudo está preenchido.",
    visual: (
      <div className="space-y-2 rounded-2xl bg-surface p-3">
        <div className="flex items-center justify-center gap-2 rounded-xl bg-primary py-4 text-primary-foreground">
          <span className="text-xl">💾</span>
          <span className="font-display text-lg uppercase">Salvar Visita</span>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">
          Dados salvos · Funciona offline · Sem internet
        </p>
      </div>
    ),
  },
];

// Conteúdo de ajuda específico por tela
export const SCREEN_HELP: Record<string, { title: string; steps: string[] }> = {
  today: {
    title: "Tela Inicial",
    steps: [
      "📊 Os números mostram: animais atendidos, pés com problema e casos graves",
      "🐄 Toque em NOVA VACA para registrar uma nova visita",
      "📋 Toque em TODOS OS ANIMAIS para ver o histórico completo",
      "📊 Toque em RESUMO DO DIA para ver estatísticas detalhadas",
      "🔍 Use a busca para encontrar um animal pelo número do brinco",
    ],
  },
  register: {
    title: "Registrar Visita",
    steps: [
      "1️⃣ Digite o número do brinco da vaca no campo grande",
      "2️⃣ Toque em VACA 🐄 ou TOURO 🐂",
      "3️⃣ Toque em cada pé: 1º toque = BOM ✅, 2º toque = COM PROBLEMA ⚠️",
      "4️⃣ Para cada pé com problema: escolha a zona, a doença e o tratamento",
      "5️⃣ Toque SALVAR VISITA quando terminar todos os pés",
    ],
  },
  foot: {
    title: "Detalhe do Pé",
    steps: [
      "🗺️ Toque nas zonas do casco onde está o problema (pode marcar várias)",
      "🔍 Para cada doença, escolha a gravidade de 0 (não tem) a 4 (muito grave)",
      "💊 Marque os tratamentos aplicados (pode marcar vários)",
      "✅ Se o problema foi resolvido, toque em MARCAR COMO CURADO",
      "⏰ Se precisar de revisão futura, toque em MARCAR REVISÃO",
      "📷 Toque em TIRAR FOTO para fotografar o casco",
    ],
  },
  history: {
    title: "Histórico do Animal",
    steps: [
      "📅 Veja todas as visitas anteriores deste animal em ordem de data",
      "🟢 Verde = tudo bom · 🟡 Amarelo = problema · 🔴 Vermelho = caso grave",
      "✅ CURADO aparece quando o problema foi marcado como resolvido",
      "⏰ REVISÃO aparece quando foi marcado que o animal precisa ser visto",
      "🗑️ Toque no botão de lixeira para apagar uma visita",
    ],
  },
  animals: {
    title: "Lista de Animais",
    steps: [
      "🔍 Use a busca para encontrar um animal pelo número do brinco",
      "Filtros disponíveis:",
      "  • TODOS — mostra todos os animais",
      "  • ⏰ REVISÃO — mostra só os que precisam de revisão",
      "  • 📅 ÚLTIMA SEMANA — mostra animais atendidos na última semana",
      "  • 🔴 GRAVES — mostra só casos com gravidade 3 ou 4",
      "Toque em um animal para ver o histórico completo",
    ],
  },
  summary: {
    title: "Resumo do Dia",
    steps: [
      "📊 Veja o total de animais atendidos hoje",
      "📈 As barras mostram quantos casos são leves, médios e graves",
      "🦠 A lista mostra quais doenças apareceram mais hoje",
      "📅 Os números da semana e do mês ajudam a ver a tendência",
    ],
  },
};

interface TutorialProps {
  onClose: () => void;
  startSlide?: number;
}

export function TutorialModal({ onClose, startSlide = 0 }: TutorialProps) {
  const [idx, setIdx] = useState(startSlide);
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;
  const isFirst = idx === 0;

  function finish() {
    markTutorialDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-t-3xl bg-background p-6 pb-10 shadow-2xl">
        {/* Indicadores de progresso */}
        <div className="mb-4 flex gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all",
                i === idx ? "bg-primary" : i < idx ? "bg-primary/40" : "bg-muted",
              )}
            />
          ))}
        </div>

        {/* Ícone e título */}
        <div className="mb-4 text-center">
          <span className="text-5xl leading-none">{slide.icon}</span>
          <h2 className="mt-2 font-display text-2xl uppercase">{slide.title}</h2>
        </div>

        {/* Visual */}
        {slide.visual && <div className="mb-4">{slide.visual}</div>}

        {/* Texto */}
        <p className="text-center text-base leading-relaxed text-foreground">{slide.body}</p>

        {/* Dica */}
        {slide.tip && (
          <p className="mt-3 rounded-xl bg-primary/10 px-4 py-2 text-center text-sm font-semibold text-primary">
            💡 {slide.tip}
          </p>
        )}

        {/* Navegação */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={isFirst}
            className="flex items-center justify-center gap-1 rounded-xl border-2 border-border bg-surface py-3 font-display text-sm uppercase disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>

          <button
            onClick={finish}
            className="rounded-xl border-2 border-border bg-surface py-3 font-display text-sm uppercase text-muted-foreground"
          >
            Fechar
          </button>

          {isLast ? (
            <button
              onClick={finish}
              className="rounded-xl bg-primary py-3 font-display text-sm uppercase text-primary-foreground stamp"
            >
              Começar! 🚀
            </button>
          ) : (
            <button
              onClick={() => setIdx((i) => Math.min(SLIDES.length - 1, i + 1))}
              className="flex items-center justify-center gap-1 rounded-xl bg-primary py-3 font-display text-sm uppercase text-primary-foreground stamp"
            >
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface HelpModalProps {
  screen: string;
  onClose: () => void;
}

export function HelpModal({ screen, onClose }: HelpModalProps) {
  const content = SCREEN_HELP[screen] ?? SCREEN_HELP["today"];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-t-3xl bg-background p-6 pb-10 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            <h2 className="font-display text-xl uppercase">{content.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {content.steps.map((step, i) => (
            <p key={i} className="rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed">
              {step}
            </p>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-primary py-4 font-display text-lg uppercase text-primary-foreground stamp"
        >
          Entendido ✅
        </button>
      </div>
    </div>
  );
}
