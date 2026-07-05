import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, X } from '@phosphor-icons/react';

const OPS = ['+', '−', '×', '÷'];

function compute(a, op, b) {
  if (op === '+') return a + b;
  if (op === '−') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b !== 0 ? a / b : a;
  return b;
}

function fmt(n) {
  if (!isFinite(n)) return '0';
  const s = parseFloat(n.toPrecision(10)).toString();
  return s.length > 12 ? n.toFixed(2) : s;
}

// Standard layout: C +/- % ÷ | 7 8 9 × | 4 5 6 − | 1 2 3 + | 0(span2) . =
const KEYS = ['C', '+/-', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='];

export default function AmountInput({ value, onChange, placeholder, min, max, autoFocus, disabled, cur }) {
  const wrapRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const [disp, setDisp] = useState('0');
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(false);

  const openCalc = () => {
    const rect = wrapRef.current.getBoundingClientRect();
    const PH = 358;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const top = spaceBelow >= PH ? rect.bottom + 4 : Math.max(8, rect.top - PH - 4);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 264));
    setPos({ top, left });
    const n = parseFloat(value);
    setDisp(!isNaN(n) && n !== 0 ? fmt(n) : '0');
    setPrev(null); setOp(null); setFresh(false);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (popRef.current && !popRef.current.contains(e.target) &&
          wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    // Delay so the keyboard-dismiss resize on mobile doesn't close the
    // calculator the moment it opens (keyboard hide = viewport resize).
    const t = setTimeout(() => window.addEventListener('resize', onResize), 400);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      clearTimeout(t);
    };
  }, [open]);

  const press = (key) => {
    if (key === 'C') {
      setDisp('0'); setPrev(null); setOp(null); setFresh(false);
    } else if (key === '+/-') {
      setDisp((d) => d !== '0' ? fmt(-parseFloat(d)) : '0');
    } else if (key === '%') {
      setDisp((d) => fmt(parseFloat(d) / 100));
      setFresh(true);
    } else if (OPS.includes(key)) {
      const n = parseFloat(disp);
      const r = prev !== null && !fresh ? compute(prev, op, n) : n;
      if (prev !== null && !fresh) setDisp(fmt(r));
      setPrev(r); setOp(key); setFresh(true);
    } else if (key === '=') {
      if (op === null || prev === null) { setFresh(true); return; }
      const r = compute(prev, op, parseFloat(disp));
      setDisp(fmt(r));
      setPrev(null); setOp(null); setFresh(true);
    } else if (key === '.') {
      if (fresh) { setDisp('0.'); setFresh(false); }
      else if (!disp.includes('.')) setDisp((d) => d + '.');
    } else {
      if (fresh) { setDisp(key === '0' ? '0' : key); setFresh(false); }
      else setDisp((d) => d === '0' ? key : d.length >= 12 ? d : d + key);
    }
  };

  const useResult = () => {
    let n = parseFloat(disp);
    if (op !== null && prev !== null && isFinite(n)) n = compute(prev, op, n);
    if (isFinite(n)) onChange({ target: { value: String(n) } });
    setOpen(false);
  };

  const finalVal = (() => {
    const n = parseFloat(disp);
    if (isNaN(n)) return null;
    if (prev !== null && op !== null) return compute(prev, op, n);
    return n;
  })();
  const useLabel = finalVal !== null && isFinite(finalVal) ? fmt(finalVal) : disp;

  return (
    <div ref={wrapRef} className={`amt-input-wrap${cur ? ' has-cur' : ''}`}>
      {cur && <span className="cur">{cur}</span>}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={onChange}
      />
      <button type="button" className="calc-trigger" aria-label="Open calculator" tabIndex={-1} onClick={openCalc}>
        <Calculator size={16} />
      </button>
      {open && createPortal(
        <div ref={popRef} className="calc-pop" style={{ top: pos.top, left: pos.left }}>
          <div className="calc-display">
            <button type="button" className="calc-close" aria-label="Close calculator" onClick={() => setOpen(false)}>
              <X weight="bold" />
            </button>
            <span className="calc-expr">{prev !== null && op ? `${fmt(prev)} ${op}` : ' '}</span>
            <span className="calc-val">{disp}</span>
          </div>
          <div className="calc-grid">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className={`calc-btn${k === '=' ? ' eq' : OPS.includes(k) ? ' op' : ['C', '+/-', '%'].includes(k) ? ' fn' : ''}`}
                style={k === '0' ? { gridColumn: 'span 2' } : undefined}
                onClick={() => press(k)}
              >
                {k}
              </button>
            ))}
          </div>
          <button type="button" className="calc-use" onClick={useResult}>
            Use {useLabel}
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
