'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface ArtistOption {
  nome: string;
  tipo: string;
  colaborador_id?: number | null;
}

interface ColaboradorOption {
  id?: number;
  nome: string;
  nome_artistico?: string;
  nome_pessoal?: string;
  skills?: string;
}

interface ArtistAutocompleteProps {
  value: string;
  tipoValue: string;
  onNomeChange: (nome: string) => void;
  onTipoChange: (tipo: string) => void;
  onSelectSuggestion?: (suggestion: ArtistOption) => void;
  artistHistory: ArtistOption[];
  allTipos: string[];
  colaboradores: ColaboradorOption[];
  placeholder?: string;
  inputStyle?: React.CSSProperties;
}

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const SKILL_ALIASES: Record<string, string> = {
  'cantor/a': 'Cantor(a)',
  'cantor(a)': 'Cantor(a)',
  'bailarino/a': 'Bailarino(a)',
  'ator/host': 'Animador / Host',
  'animador/a': 'Animador / Host',
  'produtor/coordenador': 'Produtor',
  'makeup & hair': 'Make-up & Hair',
  'assistente de guarda-roupa': 'Guarda-Roupa',
  'coreógrafo/a': 'Coreógrafo(a)',
  'coreografo/a': 'Coreógrafo(a)',
};

const canonicalSkill = (skill: string, allTipos: string[]) => {
  const clean = skill.trim();
  const alias = SKILL_ALIASES[normalize(clean)];
  if (alias) return alias;
  return allTipos.find(tipo => normalize(tipo) === normalize(clean)) || clean;
};

const collaboratorTypes = (colaborador: ColaboradorOption, allTipos: string[]) =>
  (colaborador.skills || '')
    .split(',')
    .map(skill => canonicalSkill(skill, allTipos))
    .filter(Boolean);

const displayName = (colaborador: ColaboradorOption) =>
  colaborador.nome_artistico?.trim() || colaborador.nome.trim();


export function buildArtistSuggestions({
  value,
  tipoValue,
  artistHistory,
  allTipos,
  colaboradores,
}: Pick<ArtistAutocompleteProps, 'value' | 'tipoValue' | 'artistHistory' | 'allTipos' | 'colaboradores'>): ArtistOption[] {
    const trimmedValue = value.trim();
    const query = normalize(trimmedValue);
    const selectedType = normalize(tipoValue);

    const findColaboradorById = (id?: number | null) =>
      id ? colaboradores.find(colaborador => colaborador.id === id) : undefined;

    const findColaboradorByCurrentName = (nome: string) => colaboradores.find(colaborador => {
      const names = [colaborador.nome, colaborador.nome_artistico || '', colaborador.nome_pessoal || ''];
      return names.some(candidate => normalize(candidate) === normalize(nome));
    });

    const resolveHistoryColaborador = (item: ArtistOption) =>
      findColaboradorById(item.colaborador_id) || findColaboradorByCurrentName(item.nome);

    const supportsSelectedType = (colaborador?: ColaboradorOption) => {
      if (!selectedType) return true;
      if (!colaborador) return false;
      return collaboratorTypes(colaborador, allTipos)
        .some(tipo => normalize(tipo) === selectedType);
    };

    const collaboratorMatches: ArtistOption[] = colaboradores
      .filter(colaborador => {
        if (!supportsSelectedType(colaborador)) return false;
        if (!query) return true;

        const searchableNames = [
          displayName(colaborador),
          colaborador.nome,
          colaborador.nome_artistico || '',
          colaborador.nome_pessoal || '',
        ];
        return searchableNames.some(nome => normalize(nome).startsWith(query));
      })
      .map(colaborador => {
        const tipos = collaboratorTypes(colaborador, allTipos);
        return {
          nome: displayName(colaborador),
          tipo: tipoValue || tipos[0] || '',
          colaborador_id: colaborador.id ?? null,
        };
      });

    // Com o campo vazio, a lista deve representar apenas a equipa atual:
    // todos os colaboradores que têm a função selecionada, uma vez por ID.
    const historyMatches: ArtistOption[] = query
      ? artistHistory
          .filter(item => {
            const colaborador = resolveHistoryColaborador(item);
            const matchesHistoricalAlias = normalize(item.nome).startsWith(query);
            const matchesCurrentName = colaborador
              ? [displayName(colaborador), colaborador.nome, colaborador.nome_artistico || '', colaborador.nome_pessoal || '']
                  .some(nome => normalize(nome).startsWith(query))
              : false;

            if (!matchesHistoricalAlias && !matchesCurrentName) return false;

            // Registos históricos ligados a um colaborador obedecem às skills atuais.
            // Entradas antigas sem ligação só aparecem se o tipo histórico coincidir.
            if (colaborador) return supportsSelectedType(colaborador);
            return !selectedType || normalize(item.tipo) === selectedType;
          })
          .map(item => {
            const colaborador = resolveHistoryColaborador(item);
            return {
              nome: colaborador ? displayName(colaborador) : item.nome,
              tipo: colaborador ? (tipoValue || item.tipo) : item.tipo,
              colaborador_id: colaborador?.id ?? item.colaborador_id ?? null,
            };
          })
      : [];

    // O ID é a identidade real. Nomes/aliases históricos ligados ao mesmo ID
    // nunca podem originar duas opções distintas.
    const seen = new Set<string>();
    return [...historyMatches, ...collaboratorMatches]
      .filter(item => {
        const key = item.colaborador_id
          ? `id:${item.colaborador_id}`
          : `name:${normalize(item.nome)}|type:${normalize(item.tipo)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .filter(item => normalize(item.nome) !== normalize(trimmedValue))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }));

}

export const ArtistAutocomplete: React.FC<ArtistAutocompleteProps> = ({
  value,
  tipoValue,
  onNomeChange,
  onTipoChange,
  onSelectSuggestion,
  artistHistory,
  allTipos,
  colaboradores,
  placeholder = 'Escolher colaborador...',
  inputStyle = {},
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = useId().replace(/:/g, '');

  const suggestions = useMemo(() => buildArtistSuggestions({
    value,
    tipoValue,
    artistHistory,
    allTipos,
    colaboradores,
  }), [value, tipoValue, artistHistory, colaboradores, allTipos]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion: ArtistOption) => {
    setShowSuggestions(false);
    if (onSelectSuggestion) {
      onSelectSuggestion(suggestion);
      return;
    }
    onNomeChange(suggestion.nome);
    if (suggestion.tipo) onTipoChange(suggestion.tipo);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        id={`artist-${inputId}`}
        name={`artist-search-${inputId}`}
        type="text"
        value={value}
        onChange={event => {
          onNomeChange(event.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        placeholder={placeholder}
        style={{
          ...inputStyle,
          width: '100%',
          position: 'relative',
          zIndex: 1,
        }}
        autoComplete="new-password"
        aria-autocomplete="list"
        spellCheck={false}
        data-1p-ignore="true"
        data-lpignore="true"
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--theme-surface-elevated)',
            color: 'var(--theme-text)',
            border: '1px solid var(--theme-input-border)',
            borderRadius: '6px',
            marginTop: '2px',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto',
            boxShadow: 'var(--theme-dropdown-shadow)',
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              role="option"
              aria-selected="false"
              key={`${normalize(suggestion.nome)}-${suggestion.colaborador_id ?? index}`}
              onMouseDown={event => {
                event.preventDefault();
                handleSelectSuggestion(suggestion);
              }}
              style={{
                padding: '0.6rem 0.75rem',
                fontSize: '11px',
                cursor: 'pointer',
                borderBottom: index < suggestions.length - 1 ? '1px solid var(--theme-border)' : 'none',
                transition: 'background 0.1s',
                backgroundColor: 'transparent',
                color: 'var(--theme-text)',
              }}
              onMouseEnter={event => {
                event.currentTarget.style.backgroundColor = 'var(--theme-accent)';
                event.currentTarget.style.color = 'var(--theme-accent-contrast)';
              }}
              onMouseLeave={event => {
                event.currentTarget.style.backgroundColor = 'transparent';
                event.currentTarget.style.color = 'var(--theme-text)';
              }}
            >
              <span style={{ fontWeight: 600 }}>{suggestion.nome}</span>
              {suggestion.tipo && (
                <span style={{ color: 'inherit', opacity: 0.72, marginLeft: '0.5rem', fontSize: '9px' }}>
                  - {suggestion.tipo}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
