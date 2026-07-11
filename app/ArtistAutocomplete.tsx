'use client';

import { useState, useRef, useEffect } from 'react';

interface ArtistOption {
  nome: string;
  tipo: string;
}

interface ArtistAutocompleteProps {
  value: string;
  tipoValue: string;
  onNomeChange: (nome: string) => void;
  onTipoChange: (tipo: string) => void;
  artistHistory: ArtistOption[]; // Histórico de artistas já usados (nome + tipo)
  allTipos: string[]; // Lista de tipos disponíveis
  colaboradores: { nome: string; nome_artistico?: string }[]; // Lista de colaboradores
  placeholder?: string;
  inputStyle?: React.CSSProperties;
}

export const ArtistAutocomplete: React.FC<ArtistAutocompleteProps> = ({
  value,
  tipoValue,
  onNomeChange,
  onTipoChange,
  artistHistory,
  allTipos,
  colaboradores,
  placeholder = "Escolher colaborador...",
  inputStyle = {},
}) => {
  const [suggestions, setSuggestions] = useState<ArtistOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Quando muda o input de nome, atualiza sugestões
  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const query = value.toLowerCase();
    
    // Filtrar artistas do histórico baseado no tipo selecionado e no texto escrito
    let filtered = artistHistory.filter(a => {
      const matchesQuery = a.nome.toLowerCase().startsWith(query);
      const matchesTipo = !tipoValue || a.tipo === tipoValue;
      return matchesQuery && matchesTipo;
    });

    // Se não há resultados no histórico, mostrar colaboradores disponíveis
    if (filtered.length === 0) {
      filtered = colaboradores
        .filter(c => {
          const displayName = c.nome_artistico || c.nome;
          return displayName.toLowerCase().startsWith(query);
        })
        .map(c => ({
          nome: c.nome_artistico || c.nome,
          tipo: tipoValue || 'DJ', // Usar tipo selecionado ou default
        }));
    }

    // Remover duplicatas
    const seen = new Set<string>();
    const unique = filtered.filter(a => {
      const key = `${a.nome}|${a.tipo}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setSuggestions(unique.slice(0, 8)); // Limitar a 8 sugestões
    setShowSuggestions(unique.length > 0);
  }, [value, tipoValue, artistHistory, colaboradores]);

  // Ao clicar fora, fechar sugestões
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion: ArtistOption) => {
    onNomeChange(suggestion.nome);
    onTipoChange(suggestion.tipo);
    setShowSuggestions(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={value}
        onChange={e => onNomeChange(e.target.value)}
        onFocus={() => value.trim() && suggestions.length > 0 && setShowSuggestions(true)}
        placeholder={placeholder}
        style={{
          ...inputStyle,
          width: '100%',
          position: 'relative',
          zIndex: 1,
        }}
        autoComplete="off"
      />

      {/* Dropdown de sugestões */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--theme-surface)',
            border: `1px solid var(--theme-border)`,
            borderRadius: '6px',
            marginTop: '2px',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {suggestions.map((suggestion, i) => (
            <div
              key={`${suggestion.nome}-${suggestion.tipo}-${i}`}
              onClick={() => handleSelectSuggestion(suggestion)}
              style={{
                padding: '0.6rem 0.75rem',
                fontSize: '11px',
                cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? `1px solid var(--theme-border)` : 'none',
                transition: 'background 0.1s',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--theme-accent)';
                (e.currentTarget as HTMLElement).style.color = 'var(--theme-bg)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'inherit';
              }}
            >
              <span style={{ fontWeight: 600 }}>{suggestion.nome}</span>
              <span style={{ color: 'var(--theme-text-muted)', marginLeft: '0.5rem', fontSize: '9px' }}>
                - {suggestion.tipo}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
