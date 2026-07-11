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

  const suggestions = useMemo<ArtistOption[]>(() => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return [];

    const query = normalize(trimmedValue);
    const selectedType = normalize(tipoValue);
    const findColaborador = (nome: string) => colaboradores.find(colaborador => {
      const names = [colaborador.nome, colaborador.nome_artistico || ''];
      return names.some(candidate => normalize(candidate) === normalize(nome));
    });
    const supportsSelectedType = (colaborador?: ColaboradorOption) => {
      if (!selectedType) return true;
      if (!colaborador) return true; // histórico livre, sem ficha de colaborador associada
      return collaboratorTypes(colaborador, allTipos)
        .some(tipo => normalize(tipo) === selectedType);
    };

    // Histórico primeiro, mas validado contra as skills atuais quando existe ficha.
    const historyMatches: ArtistOption[] = artistHistory
      .filter(item => {
        if (!normalize(item.nome).startsWith(query)) return false;
        if (selectedType && normalize(item.tipo) !== selectedType) return false;
        return supportsSelectedType(findColaborador(item.nome));
      })
      .map(item => {
        const colaborador = findColaborador(item.nome);
        return {
          nome: colaborador ? displayName(colaborador) : item.nome,
          tipo: item.tipo,
          colaborador_id: colaborador?.id ?? item.colaborador_id ?? null,
        };
      });

    // Colaboradores só entram se tiverem efetivamente o tipo escolhido nas skills.
    const collaboratorMatches: ArtistOption[] = colaboradores
      .filter(colaborador => {
        if (!normalize(displayName(colaborador)).startsWith(query)) return false;
        return supportsSelectedType(colaborador);
      })
      .map(colaborador => {
        const tipos = collaboratorTypes(colaborador, allTipos);
        return {
          nome: displayName(colaborador),
          tipo: tipoValue || tipos[0] || '',
          colaborador_id: colaborador.id ?? null,
        };
      });

    // Junta as duas fontes, remove duplicados e nunca sugere o valor já escolhido.
    const seen = new Set<string>();
    return [...historyMatches, ...collaboratorMatches]
      .filter(item => {
        const key = normalize(item.nome);
        if (key === normalize(trimmedValue) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  }, [value, tipoValue, artistHistory, colaboradores, allTipos]);

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
          setShowSuggestions(Boolean(event.target.value.trim()));
        }}
        onFocus={() => value.trim() && suggestions.length > 0 && setShowSuggestions(true)}
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
            background: 'var(--theme-surface)',
            border: '1px solid var(--theme-border)',
            borderRadius: '6px',
            marginTop: '2px',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
              }}
              onMouseEnter={event => {
                event.currentTarget.style.backgroundColor = 'var(--theme-accent)';
                event.currentTarget.style.color = 'var(--theme-bg)';
              }}
              onMouseLeave={event => {
                event.currentTarget.style.backgroundColor = 'transparent';
                event.currentTarget.style.color = 'inherit';
              }}
            >
              <span style={{ fontWeight: 600 }}>{suggestion.nome}</span>
              {suggestion.tipo && (
                <span style={{ color: 'var(--theme-text-muted)', marginLeft: '0.5rem', fontSize: '9px' }}>
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
