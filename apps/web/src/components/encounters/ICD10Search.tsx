'use client';

import { useState, useCallback, useRef } from 'react';

interface ICD10Result {
  code: string;
  description: string;
  category: string;
}

interface SelectedDiagnosis {
  code: string;
  description: string;
  isPrimary: boolean;
}

interface ICD10SearchProps {
  selected: SelectedDiagnosis[];
  onChange: (diagnoses: SelectedDiagnosis[]) => void;
  apiBase?: string;
}

export default function ICD10Search({
  selected,
  onChange,
  apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
}: ICD10SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ICD10Result[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setResults([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await fetch(
            `${apiBase}/api/v1/icd10/search?q=${encodeURIComponent(q)}&limit=10`
          );
          const body = await res.json();
          setResults(body.data ?? []);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [apiBase]
  );

  const add = (item: ICD10Result) => {
    if (selected.some((s) => s.code === item.code)) return;
    onChange([
      ...selected,
      { code: item.code, description: item.description, isPrimary: selected.length === 0 },
    ]);
    setQuery('');
    setResults([]);
  };

  const remove = (code: string) => onChange(selected.filter((s) => s.code !== code));

  const togglePrimary = (code: string) =>
    onChange(selected.map((s) => ({ ...s, isPrimary: s.code === code })));

  return (
    <div>
      {/* Selected diagnoses */}
      {selected.length > 0 && (
        <ul className="mb-2 list-none p-0">
          {selected.map((s) => (
            <li
              key={s.code}
              className="mb-1 flex items-center gap-2 rounded bg-blue-50 px-2 py-1.5 text-sm"
            >
              <span className="font-semibold">{s.code}</span>
              <span className="flex-1">{s.description}</span>
              <button
                type="button"
                onClick={() => togglePrimary(s.code)}
                title={s.isPrimary ? 'Primary diagnosis' : 'Set as primary'}
                className={`cursor-pointer rounded border-0 px-2 py-0.5 text-xs ${
                  s.isPrimary
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {s.isPrimary ? '★ Primary' : 'Set primary'}
              </button>
              <button
                type="button"
                onClick={() => remove(s.code)}
                aria-label={`Remove ${s.code}`}
                className="cursor-pointer border-0 bg-transparent font-bold text-red-500"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
          placeholder="Search ICD-10 code or description (e.g. J06 or respiratory)"
          aria-label="Search ICD-10 diagnosis codes"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
            Searching…
          </span>
        )}
      </div>

      {/* Dropdown results */}
      {results.length > 0 && (
        <ul
          role="listbox"
          aria-label="ICD-10 search results"
          className="mt-1 max-h-60 list-none overflow-y-auto rounded-md border border-neutral-300 bg-white p-0 shadow-md"
        >
          {results.map((r) => (
            <li
              key={r.code}
              role="option"
              onClick={() => add(r)}
              className="cursor-pointer border-b border-neutral-100 px-3 py-2 text-sm hover:bg-blue-50"
            >
              <span className="mr-2 font-semibold">{r.code}</span>
              {r.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
