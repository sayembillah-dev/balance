/* Balance — reusable custom dropdown.
   A styled replacement for native <select>: keyboard-navigable, closes on
   outside-click / Escape, and matches the app's surface/border tokens.

   The menu is rendered in a portal with fixed positioning so it is never
   clipped by an ancestor's `overflow: hidden` (settings groups, modals, table
   wrappers) and never trapped in a lower stacking context.

   Usage:
     <Select value={v} onChange={(val) => …}
             options={[{ value, label, disabled? }]}
             placeholder="Choose…" className="…" ariaLabel="…" /> */
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const Caret = () => (
  <svg className="sel-caret" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
    <path fill="currentColor" d="M0 0h10L5 6z" />
  </svg>
);

const MENU_MAX_H = 264;

export default function Select({
  value, onChange, options = [], placeholder = 'Select…',
  disabled = false, className = '', ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // keyboard-highlighted index
  const [coords, setCoords] = useState(null); // { top, left, width, drop }
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  const selected = options.find((o) => o.value === value);
  const label = selected ? selected.label : placeholder;

  // Position the fixed menu against the trigger; flip above if it would spill
  // off the bottom of the viewport.
  const place = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const dropUp = below < Math.min(MENU_MAX_H, options.length * 38 + 12) && r.top > below;
    setCoords({ top: dropUp ? r.top : r.bottom, left: r.left, width: r.width, dropUp });
  };

  // Reposition while open; close on outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
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

  // After the menu mounts, scroll the current selection into view.
  useLayoutEffect(() => {
    if (!open) return;
    const el = menuRef.current?.children[active];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[active]) choose(options[active]); }
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
        <div className="sel-menu" role="listbox" ref={menuRef} style={menuStyle}>
          {options.map((opt, i) => (
            <div
              key={opt.value}
              role="option" aria-selected={opt.value === value}
              className={`sel-opt${opt.value === value ? ' on' : ''}${i === active ? ' active' : ''}${opt.disabled ? ' disabled' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(opt); }}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
