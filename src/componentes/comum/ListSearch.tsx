import { Search, X } from "lucide-react";

export function ListSearch({
  value,
  onChange,
  placeholder = "Buscar nesta lista",
  label = placeholder,
  resultLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  resultLabel?: string;
}) {
  return (
    <div>
      <label className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-border bg-card px-3 focus-within:border-primary">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{label}</span>
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </label>
      {resultLabel ? (
        <p className="mt-1.5 px-1 text-xs text-muted-foreground">{resultLabel}</p>
      ) : null}
    </div>
  );
}
