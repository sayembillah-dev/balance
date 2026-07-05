/* Balance — reusable custom dropdown.
   A styled replacement for native <select>: keyboard-navigable, closes on
   outside-click / Escape, and matches the app's surface/border tokens.

   The menu is rendered in a portal with fixed positioning so it is never
   clipped by an ancestor's `overflow: hidden` (settings groups, modals, table
   wrappers) and never trapped in a lower stacking context.

   Usage:
     <Select value={v} onChange={(val) => …}
             options={[{ value, label, disabled? }]}
             placeholder="Choose…" className="…" ariaLabel="…"
             searchable /> */
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { CaretDown } from '@phosphor-icons/react';

const Caret = () => <CaretDown className="sel-caret" weight="bold" aria-hidden="true" />;

const MENU_MAX_H = 264;

export default function Select({
  value, onChange, options = [], placeholder = 'Select…',
  disabled = false, className = '', ariaLabel, searchable = false,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [coords, setCoords] = useState(null);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  const filtered = searchable && query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const selected = options.find((o) => o.value === value);
  const label = selected ? selected.label : placeholder;

  const place = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const dropUp = below < Math.min(MENU_MAX_H, options.length * 38 + 12) && r.top > below;
    const menuMinW = Math.max(r.width, 180);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - menuMinW - 8));
    setCoords({ top: dropUp ? r.top : r.bottom, left, width: r.width, dropUp });
  };

  useEffect(() => {
    if (!open) { setQuery(''); return undefined; }
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const reflow = () => place();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', reflow, true);
    window.addEventListener('resize', reflow);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', reflow, true);
      window.removeEventListener('resize', reflow);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!open) return;
    if (searchable) { searchRef.current?.focus(); return; }
    menuRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openMenu = () => {
    setActive(options.findIndex((o) => o.value === value));
    place();
    setOpen(true);
  };

  const choose = (opt) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  };

  const navKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) choose(filtered[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else e.stopPropagation();
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (filtered[active]) choose(filtered[active]); }
    else if (e.key === 'Tab') { setOpen(false); }
  };

  const menuStyle = coords && {
    position: 'fixed',
    left: coords.left,
    minWidth: coords.width,
    maxHeight: MENU_MAX_H,
    ...(coords.dropUp
      ? { bottom: window.innerHeight - coords.top + 5 }
      : { top: coords.top + 5 }),
  };

  return (
    <div className={`sel${open ? ' open' : ''}${disabled ? ' disabled' : ''}${className ? ` ${className}` : ''}`} ref={rootRef}>
      <button
        type="button" className="sel-btn" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
        onClick={() => { if (!disabled) (open ? setOpen(false) : openMenu()); }} onKeyDown={onKeyDown}
      >
        <span className={`sel-val${selected ? '' : ' placeholder'}`}>{label}</span>
        <Caret />
      </button>
      {open && coords && createPortal(
        <div className={`sel-menu${searchable ? ' sel--has-search' : ''}`} role="listbox" ref={menuRef} style={menuStyle}>
          {searchable && (
            <div className="sel-search" onMouseDown={(e) => e.stopPropagation()}>
              <input
                ref={searchRef}
                type="text"
                className="sel-search-inp"
                placeholder="Search…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={navKey}
              />
            </div>
          )}
          <div className={searchable ? 'sel-opts' : undefined}>
            {filtered.length === 0 && (
              <div className="sel-opt disabled" style={{ pointerEvents: 'none' }}>No results</div>
            )}
            {filtered.map((opt, i) => (
              <div
                key={opt.value}
                data-idx={i}
                role="option" aria-selected={opt.value === value}
                className={`sel-opt${opt.value === value ? ' on' : ''}${i === active ? ' active' : ''}${opt.disabled ? ' disabled' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(opt); }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
