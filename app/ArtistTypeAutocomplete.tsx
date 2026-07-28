'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

interface ArtistTypeAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  inputStyle?: React.CSSProperties;
}

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

export const ArtistTypeAutocomplete: React.FC<ArtistTypeAutocompleteProps> = ({
  value,
  onChange,
  options,
  placeholder = 's/ tipo',
  inputStyle = {},
}) => {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId().replace(/:/g, '');

  const sortedOptions = useMemo(() => Array.from(new Set(options.filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' })), [options]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery || normalize(query) === normalize(value)) return sortedOptions;
    return sortedOptions.filter(option => normalize(option).includes(normalizedQuery));
  }, [query, value, sortedOptions]);

  useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setQuery(nextValue);
    setOpen(false);
  };

  const commitTypedValue = () => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) {
      choose('');
      return;
    }
    const exact = sortedOptions.find(option => normalize(option) === normalizedQuery);
    if (exact) {
      choose(exact);
      return;
    }
    setQuery(value);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          ref={inputRef}
          id={`artist-type-${inputId}`}
          name={`artist-type-search-${inputId}`}
          type="text"
          value={open ? query : value}
          onChange={event => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={event => {
            setQuery(value);
            setOpen(true);
            requestAnimationFrame(() => event.currentTarget.select());
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (filteredOptions.length === 1) choose(filteredOptions[0]);
              else commitTypedValue();
            }
            if (event.key === 'Escape') {
              setQuery(value);
              setOpen(false);
              inputRef.current?.blur();
            }
            if (event.key === 'ArrowDown' && !open) setOpen(true);
          }}
          onBlur={() => {
            // O clique numa opção usa onMouseDown e fecha antes deste blur.
            window.setTimeout(() => {
              if (!containerRef.current?.contains(document.activeElement)) commitTypedValue();
            }, 0);
          }}
          placeholder={placeholder}
          style={{
            ...inputStyle,
            width: '100%',
            boxSizing: 'border-box',
            paddingRight: '1.65rem',
          }}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          spellCheck={false}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Abrir tipos de artista"
          onMouseDown={event => {
            event.preventDefault();
            setQuery(value);
            setOpen(current => !current);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '1.55rem',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            opacity: 0.55,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            right: 0,
            background: 'var(--theme-surface-elevated)',
            color: 'var(--theme-text)',
            border: '1px solid var(--theme-input-border)',
            zIndex: 10000,
            maxHeight: '220px',
            overflowY: 'auto',
            boxShadow: 'var(--theme-dropdown-shadow)',
          }}
        >
          {(!query.trim() || normalize('s/ tipo').includes(normalize(query))) && (
            <div
              role="option"
              aria-selected={!value}
              onMouseDown={event => {
                event.preventDefault();
                choose('');
              }}
              style={{
                padding: '0.6rem 0.65rem',
                fontSize: inputStyle.fontSize ?? '10px',
                color: !value ? 'var(--theme-accent)' : 'var(--theme-text)',
                background: !value ? 'var(--theme-dropdown-selected)' : 'transparent',
                cursor: 'pointer',
                borderBottom: '1px solid var(--theme-border)',
              }}
            >
              s/ tipo
            </div>
          )}

          {filteredOptions.map(option => (
            <div
              role="option"
              aria-selected={option === value}
              key={option}
              onMouseDown={event => {
                event.preventDefault();
                choose(option);
              }}
              style={{
                padding: '0.6rem 0.65rem',
                fontSize: inputStyle.fontSize ?? '10px',
                color: option === value ? 'var(--theme-accent)' : 'var(--theme-text)',
                background: option === value ? 'var(--theme-dropdown-selected)' : 'transparent',
                cursor: 'pointer',
                borderBottom: '1px solid var(--theme-border)',
              }}
              onMouseEnter={event => { event.currentTarget.style.background = 'var(--theme-dropdown-hover)'; }}
              onMouseLeave={event => { event.currentTarget.style.background = option === value ? 'var(--theme-dropdown-selected)' : 'transparent'; }}
            >
              {option}
            </div>
          ))}

          {filteredOptions.length === 0 && query.trim() && (
            <div style={{ padding: '0.65rem', fontSize: '9px', color: 'var(--theme-text-subtle)' }}>
              Nenhum tipo disponível para este artista.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
