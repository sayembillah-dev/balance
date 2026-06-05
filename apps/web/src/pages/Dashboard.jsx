/* Balance — modular dashboard.
   Widgets auto-fit a dense responsive grid, can be added/removed via the
   library, and dragged to reorder. */
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ---------- tiny icon helper ----------
const Ico = ({ d, fill }) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const ICONS = {
  wallet:  ['M2.5 7.5A2.5 2.5 0 0 1 5 5h13a1.5 1.5 0 0 1 1.5 1.5v0H5a2.5 2.5 0 0 0 0 0', 'M2.5 7.5v9A2.5 2.5 0 0 0 5 19h14a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 19 9H5a2.5 2.5 0 0 1-2.5-1.5', 'M16.5 13.5h.01'],
  card:    ['M2.5 6.5h19v11h-19z', 'M2.5 10.5h19', 'M6 14.5h4'],
  trend:   ['M3 17l5-5 3 3 7-7', 'M15 8h5v5'],
  pie:     ['M12 3a9 9 0 1 0 9 9h-9V3Z', 'M14 3.2A9 9 0 0 1 20.8 10H14V3.2Z'],
  bars:    ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  list:    ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3.5 6h.01', 'M3.5 12h.01', 'M3.5 18h.01'],
  bill:    ['M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Z', 'M9 8h6', 'M9 12h6'],
  target:  ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M12 12h.01'],
  gauge:   ['M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M5 19a9 9 0 1 1 14 0'],
  bolt:    ['M13 2 4 14h7l-1 8 9-12h-7l1-8Z'],
  plus:    ['M12 5v14', 'M5 12h14'],
  sliders: ['M3 6h11', 'M18 6h3', 'M16 4.2v3.6', 'M3 12h5', 'M12 12h9', 'M10 10.2v3.6', 'M3 18h11', 'M18 18h3', 'M16 16.2v3.6'],
  x:       ['M6 6l12 12', 'M18 6 6 18'],
  grip:    ['M9 5h.01', 'M9 12h.01', 'M9 19h.01', 'M15 5h.01', 'M15 12h.01', 'M15 19h.01'],
  up:      ['M7 14l5-5 5 5'],
  down:    ['M7 10l5 5 5-5'],
  arrow:   ['M5 12h14', 'M13 6l6 6-6 6'],
  send:    ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4 20-7Z'],
  request: ['M12 5v14', 'M5 12h14', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z'],
};
const WIcon = ({ k }) => <Ico d={ICONS[k] || ICONS.wallet} />;

const CAT = ['var(--primary)', '#2f6fe0', '#7c4dd8', '#e0892f', '#d6457a', '#3aa3a3'];

const Delta = ({ v, good }) => {
  const up = v >= 0;
  const cls = (good === undefined ? up : good) ? 'up' : 'down';
  return (
    <span className={`chip ${cls}`}>
      <Ico d={up ? ICONS.up : ICONS.down} />{up ? '+' : ''}{v}%
    </span>
  );
};

function Stat({ value, delta, good, sub }) {
  return (
    <div className="wg-body">
      <div className="st-val">{value}</div>
      <div className="st-meta">
        {delta !== undefined && <Delta v={delta} good={good} />}
        <span className="st-sub">{sub}</span>
      </div>
    </div>
  );
}

function Sparkline({ value, delta, pts }) {
  const w = 240, h = 38, max = Math.max(...pts), min = Math.min(...pts);
  const sx = (i) => (i / (pts.length - 1)) * w;
  const sy = (v) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
  const line = pts.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <div className="wg-body">
      <div className="st-val">{value}</div>
      <div className="st-meta"><Delta v={delta} /><span className="st-sub">total invested</span></div>
      <div className="st-spark">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <polygon points={area} fill="var(--primary-soft)" />
          <polyline points={line} fill="none" stroke="var(--primary)" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function Donut({ segs }) {
  const total = segs.reduce((s, x) => s + x.v, 0);
  let acc = 0;
  const stops = segs.map((s, i) => {
    const start = (acc / total) * 360; acc += s.v;
    const end = (acc / total) * 360;
    return `${CAT[i % CAT.length]} ${start}deg ${end}deg`;
  }).join(', ');
  return (
    <div className="wg-body">
      <div className="donut-wrap">
        <div className="donut" style={{ background: `conic-gradient(${stops})` }}>
          <div className="donut-c"><b>₹{(total / 1000).toFixed(1)}k</b><span>spent</span></div>
        </div>
        <div className="legend">
          {segs.map((s, i) => (
            <div className="legend-row" key={s.label}>
              <i style={{ background: CAT[i % CAT.length] }} />
              <span>{s.label}</span><b>₹{s.v.toLocaleString('en-IN')}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarChart({ data, hot }) {
  const max = Math.max(...data.map((d) => d.v));
  return (
    <div className="wg-body">
      <div className="bars">
        {data.map((d, i) => (
          <div className="bar-col" key={d.label}>
            <div className={`bar${i === hot ? ' hot' : ''}`} style={{ height: `${(d.v / max) * 100}%` }} />
            <small>{d.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressList({ rows }) {
  return (
    <div className="wg-body">
      <div className="prog-list">
        {rows.map((r) => (
          <div className="prog-row" key={r.label}>
            <div className="prog-top"><span>{r.label}</span><b>{r.spent} / {r.cap}</b></div>
            <div className="track"><i style={{ width: `${r.pct}%`, background: r.pct > 90 ? '#c02626' : 'var(--primary)' }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalRing({ pct, title, sub }) {
  return (
    <div className="wg-body">
      <div className="ring-wrap">
        <div className="ring" style={{ background: `conic-gradient(var(--primary) ${pct * 3.6}deg, var(--border-soft) 0)` }}>
          <div className="ring-c"><b>{pct}%</b></div>
        </div>
        <div className="goal-meta"><b>{title}</b><p>{sub}</p></div>
      </div>
    </div>
  );
}

function WList({ rows }) {
  return (
    <div className="wg-body">
      <div className="wlist">
        {rows.map((r, i) => (
          <div className="wlist-row" key={i}>
            <div className="wlist-av" style={{ background: r.tint || 'var(--primary-soft)', color: r.fg || 'var(--primary-ink)' }}>{r.av}</div>
            <div className="wlist-m"><b>{r.name}</b><span>{r.meta}</span></div>
            <div className="wlist-amt">{r.amt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Quick() {
  const acts = [['send', 'Send'], ['request', 'Request'], ['plus', 'Add money'], ['card', 'Pay bill']];
  return (
    <div className="wg-body">
      <div className="quick">
        {acts.map(([k, l]) => <button key={l} type="button"><WIcon k={k} />{l}</button>)}
      </div>
    </div>
  );
}

const CATALOG = {
  balance:      { title: 'Account Balance', icon: 'wallet', w: 1, h: 1, desc: 'Current total balance', render: () => <Stat value="₹8,98,450" delta={6.2} sub="vs last month" /> },
  expenses:     { title: 'Monthly Expenses', icon: 'card', w: 1, h: 1, desc: 'This month so far', render: () => <Stat value="₹24,093" delta={-2.1} good sub="vs last month" /> },
  savings:      { title: 'Savings Rate', icon: 'gauge', w: 1, h: 1, desc: 'Income kept this month', render: () => <Stat value="32%" delta={4.0} sub="of income saved" /> },
  quick:        { title: 'Quick Actions', icon: 'bolt', w: 1, h: 1, desc: 'Shortcuts to move money', render: () => <Quick /> },
  investment:   { title: 'Total Investment', icon: 'trend', w: 2, h: 1, desc: 'Portfolio value + trend', render: () => <Sparkline value="₹1,45,555" delta={12.4} pts={[8, 9, 8.5, 10, 11, 10.5, 12, 13, 12.5, 14, 14.5, 15]} /> },
  budget:       { title: 'Budget Progress', icon: 'bars', w: 2, h: 1, desc: 'Spending vs caps', render: () => <ProgressList rows={[{ label: 'Food', spent: '₹6.1k', cap: '₹8k', pct: 76 }, { label: 'Shopping', spent: '₹4.3k', cap: '₹6k', pct: 72 }]} /> },
  goal:         { title: 'Savings Goal', icon: 'target', w: 1, h: 2, desc: 'Progress toward a goal', render: () => <GoalRing pct={48} title="iPhone 17 Pro" sub="₹70,000 of ₹1,45,000" /> },
  bills:        { title: 'Upcoming Bills', icon: 'bill', w: 1, h: 2, desc: 'Subscriptions & dues', render: () => <WList rows={[
                    { av: 'N', name: 'Netflix', meta: 'Due 28 Jun', amt: '₹149', tint: 'color-mix(in oklab,#e23b3b 14%,#fff)', fg: '#c02626' },
                    { av: 'S', name: 'Spotify', meta: 'Due 02 Jul', amt: '₹49', tint: 'color-mix(in oklab,#16a34a 14%,#fff)', fg: '#15803d' },
                    { av: 'F', name: 'Figma', meta: 'Due 05 Jul', amt: '₹3,999' },
                    { av: 'W', name: 'WiFi', meta: 'Due 11 Jul', amt: '₹399', tint: 'color-mix(in oklab,#2f6fe0 14%,#fff)', fg: '#2657c0' },
                  ]} /> },
  category:     { title: 'Spending by Category', icon: 'pie', w: 2, h: 2, desc: 'Where your money goes', render: () => <Donut segs={[
                    { label: 'Food & Grocery', v: 6156 }, { label: 'Investment', v: 5000 }, { label: 'Shopping', v: 4356 },
                    { label: 'Travelling', v: 3670 }, { label: 'Miscellaneous', v: 2749 }, { label: 'Bills', v: 2162 },
                  ]} /> },
  trend:        { title: 'Monthly Trend', icon: 'bars', w: 2, h: 2, desc: 'Expenses over 8 months', render: () => <BarChart hot={7} data={[
                    { label: 'Jun', v: 18 }, { label: 'Jul', v: 22 }, { label: 'Aug', v: 16 }, { label: 'Sep', v: 25 },
                    { label: 'Oct', v: 21 }, { label: 'Nov', v: 27 }, { label: 'Dec', v: 30 }, { label: 'Jan', v: 24 },
                  ]} /> },
  transactions: { title: 'Recent Transactions', icon: 'list', w: 2, h: 2, desc: 'Latest activity', render: () => <WList rows={[
                    { av: 'A', name: 'Amazon', meta: 'Shopping · 31 May', amt: '−₹2,100' },
                    { av: 'P', name: 'PVR Cinemas', meta: 'Movie · 28 May', amt: '−₹299' },
                    { av: 'G', name: 'Groww', meta: 'Investment · 24 May', amt: '−₹5,000' },
                    { av: 'I', name: 'IRCTC', meta: 'Travel · 20 May', amt: '−₹2,460' },
                    { av: 'S', name: 'Swiggy', meta: 'Food · 15 May', amt: '−₹678' },
                  ]} /> },
};

const DEFAULTS = ['balance', 'expenses', 'investment', 'category', 'trend', 'transactions', 'bills', 'goal'];
const STORE = 'balance.widgets.v1';

function WidgetCard({ id, cols, onRemove, onHandleDown, dragging }) {
  const c = CATALOG[id];
  if (!c) return null;
  const span = Math.min(c.w, cols);
  return (
    <div
      className={`wg${dragging ? ' dragging' : ''}`}
      style={{ gridColumn: `span ${span}`, gridRow: `span ${c.h}` }}
      data-wid={id}
    >
      <div className="wg-head">
        <div className="wg-title"><span className="wg-ic"><WIcon k={c.icon} /></span><span>{c.title}</span></div>
        <div className="wg-tools">
          <button className="wg-tool grab" title="Drag to reorder" aria-label="Drag to reorder"
                  onPointerDown={(e) => onHandleDown(e, id)}><Ico d={ICONS.grip} /></button>
          <button className="wg-tool" title="Remove" aria-label="Remove widget" onClick={() => onRemove(id)}><Ico d={ICONS.x} /></button>
        </div>
      </div>
      {c.render()}
    </div>
  );
}

function Library({ active, onToggle, onClose }) {
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="lib" onMouseDown={(e) => e.stopPropagation()}>
        <div className="lib-head">
          <div>
            <h3>Add widgets</h3>
            <p>{active.length} of {Object.keys(CATALOG).length} added · tap to toggle</p>
          </div>
          <button className="lib-x" onClick={onClose} aria-label="Close"><Ico d={ICONS.x} /></button>
        </div>
        <div className="lib-grid">
          {Object.entries(CATALOG).map(([id, c]) => {
            const on = active.includes(id);
            return (
              <div className={`lib-card${on ? ' added' : ''}`} key={id}>
                <span className="li-ic"><WIcon k={c.icon} /></span>
                <div className="li-meta"><h4>{c.title}</h4><p>{c.desc}</p></div>
                <button className="li-btn" onClick={() => onToggle(id)} aria-label={on ? 'Remove' : 'Add'}>
                  <Ico d={on ? ICONS.x : ICONS.plus} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [widgets, setWidgets] = useState(() => {
    const s = window.BAL.loadWidgets();
    if (Array.isArray(s) && s.length) return s.filter((id) => CATALOG[id]);
    return DEFAULTS;
  });
  const [cols, setCols] = useState(4);
  const [libOpen, setLibOpen] = useState(false);
  const gridRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const widgetsRef = useRef(widgets);
  widgetsRef.current = widgets;

  useEffect(() => { window.BAL.saveWidgets(widgets); }, [widgets]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      let c = 4;
      if (w < 560) c = 1; else if (w < 840) c = 2; else if (w < 1140) c = 3; else c = 4;
      setCols(c);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const remove = useCallback((id) => setWidgets((w) => w.filter((x) => x !== id)), []);
  const toggle = useCallback((id) => setWidgets((w) => w.includes(id) ? w.filter((x) => x !== id) : [...w, id]), []);

  const startHandle = useCallback((e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setDragId(id);
    document.body.style.userSelect = 'none';
    const move = (ev) => {
      const grid = gridRef.current;
      if (!grid) return;
      let best = null, bestD = Infinity, before = true;
      grid.querySelectorAll('.wg').forEach((el) => {
        const wid = el.dataset.wid;
        if (wid === id) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const d = Math.hypot(ev.clientX - cx, ev.clientY - cy);
        if (d < bestD) {
          bestD = d; best = wid;
          before = ev.clientY < cy - 8 ? true : ev.clientY > cy + 8 ? false : ev.clientX < cx;
        }
      });
      if (!best) return;
      const cur = widgetsRef.current;
      const arr = cur.filter((x) => x !== id);
      let idx = arr.indexOf(best);
      if (!before) idx += 1;
      arr.splice(idx, 0, id);
      if (arr.join() !== cur.join()) setWidgets(arr);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.userSelect = '';
      setDragId(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <h2>Overview</h2>
          <p>{widgets.length} widget{widgets.length === 1 ? '' : 's'} · drag to rearrange</p>
        </div>
        <div className="dash-actions">
          <button className="btn-primary" onClick={() => setLibOpen(true)}><Ico d={ICONS.sliders} />Manage Widgets</button>
        </div>
      </div>

      <div className="dash-grid" ref={gridRef} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {widgets.map((id) => (
          <WidgetCard key={id} id={id} cols={cols} onRemove={remove} onHandleDown={startHandle} dragging={dragId === id} />
        ))}
      </div>

      {widgets.length === 0 && (
        <div className="dash-empty">
          <span className="badge"><Ico d={ICONS.bars} /></span>
          <h3>Your dashboard is empty</h3>
          <p>Add widgets to track balances, spending, goals and more — they’ll arrange themselves to fit.</p>
          <button className="btn-primary" onClick={() => setLibOpen(true)}><Ico d={ICONS.plus} />Add your first widget</button>
        </div>
      )}

      {libOpen && <Library active={widgets} onToggle={toggle} onClose={() => setLibOpen(false)} />}
    </div>
  );
}
