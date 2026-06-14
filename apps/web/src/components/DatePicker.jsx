import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import { CalendarBlank } from '@phosphor-icons/react';
import 'react-day-picker/style.css';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseDate(iso) {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtIso(date) {
  if (!date) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function fmtDisplay(iso) {
  if (!iso) return 'Select date';
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

export default function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  function toggle() {
    if (open) { setOpen(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [open]);

  function handleSelect(date) {
    if (!date) return;
    onChange(fmtIso(date));
    setOpen(false);
  }

  const selected = parseDate(value);

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className={`date-pick-btn${open ? ' open' : ''}`}
        onClick={toggle}
      >
        <CalendarBlank size={15} />
        <span>{fmtDisplay(value)}</span>
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          className="date-pick-pop"
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected ?? new Date()}
            navLayout="around"
          />
        </div>,
        document.body
      )}
    </>
  );
}
