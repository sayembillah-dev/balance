/* Balance — reusable custom dropdown.
   A styled replacement for native <select>: keyboard-navigable, closes on
   outside-click / Escape, and matches the app's surface/border tokens.

   Usage:
     <Select value={v} onChange={(val) => …}
             options={[{ value, label, disabled? }]}
             placeholder="Choose…" className="…" ariaLabel="…" /> */
import { useState, useRef, useEffect } from 'react';

const Caret = () => (
  <svg className="sel-caret" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
    <path fill="currentColor" d="M0 0h10L5 6z" />
  </svg>
);

export default function Select({
  value, onChange, options = [], placeholder = 'Select…',
  disabled = false, className = '', ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // keyboard-highlighted index
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  const selected = options.find((o) => o.value === value);
  const label = selected ? selected.label : placeholder;

  // Close on outside click or Escape while open.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // After the menu opens, scroll the current selection into view.
  useEffect(() => {
    if (!open) return;
    const el = menuRef.current?.children[active];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open the menu with the current selection pre-highlighted.
  const openMenu = () => {
    setActive(options.findIndex((o) => o.value === value));
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
      {open && (
        <div className="sel-menu" role="listbox" ref={menuRef}>
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
        </div>
      )}
    </div>
  );
}
