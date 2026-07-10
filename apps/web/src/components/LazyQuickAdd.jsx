/* Balance — Lazy mode quick-add.
   Two floating buttons (expense/income); each opens a bare-bones sheet with
   just a category grid and an amount. Saves straight to the account chosen
   in Settings → Preferences & Logic. */
import React, { useState } from 'react';
import {
  Plus, Minus, X as XIcon,
  House, Coffee, ForkKnife, Airplane, Train, GasPump, Taxi, Bus, Car,
  TShirt, Sparkle, DeviceMobile, ShoppingBag, GraduationCap, BookOpen,
  Laptop, FilmSlate, Phone, Receipt, Cube, Briefcase, GameController, Camera,
  Stethoscope, Pill, Barbell, Scissors, Heartbeat, CreditCard, Bank,
  HandHeart, Gift, Tag, Heart, PawPrint, Baby, Umbrella, DotsThreeCircle,
  Wallet, ChartLineUp, Coins, TrendUp, ArrowCounterClockwise,
} from '@phosphor-icons/react';
import AmountInput from './AmountInput.jsx';

// Ordered keyword → icon lookup, checked against the lowercased category
// name. First match wins, so more specific keywords are listed first.
const ICON_RULES = [
  ['rent', House], ['housing', House], ['utilit', House], ['electric', House], ['water', House], ['broadband', House], ['internet', House], ['maintenance', House],
  ['coffee', Coffee], ['grocer', ForkKnife], ['restaurant', ForkKnife], ['dining', ForkKnife], ['snack', ForkKnife], ['food', ForkKnife], ['delivery', ForkKnife],
  ['flight', Airplane], ['plane', Airplane], ['train', Train], ['fuel', GasPump], ['gas', GasPump], ['ride', Taxi], ['taxi', Taxi], ['cab', Taxi], ['transit', Bus], ['bus', Bus], ['vehicle', Car], ['transport', Car], ['car', Car],
  ['cloth', TShirt], ['fashion', TShirt], ['apparel', TShirt], ['makeup', Sparkle], ['cosmetic', Sparkle], ['gadget', DeviceMobile], ['electronic', DeviceMobile], ['shopping', ShoppingBag],
  ['tuition', GraduationCap], ['certificat', GraduationCap], ['course', GraduationCap], ['book', BookOpen], ['education', BookOpen],
  ['hosting', Laptop], ['software', Laptop], ['server', Laptop], ['streaming', FilmSlate], ['recharge', Phone], ['data pack', Phone], ['mobile', Phone], ['subscription', Receipt], ['tech', DeviceMobile],
  ['inventory', Cube], ['packaging', Cube], ['courier', Cube], ['shipping', Cube], ['business', Briefcase],
  ['gaming', GameController], ['game', GameController], ['photograph', Camera], ['camera', Camera], ['movie', FilmSlate], ['entertainment', FilmSlate], ['hobb', FilmSlate],
  ['doctor', Stethoscope], ['medicine', Pill], ['pharmac', Pill], ['gym', Barbell], ['fitness', Barbell], ['haircut', Scissors], ['grooming', Scissors], ['lotion', Sparkle], ['health', Heartbeat],
  ['credit card', CreditCard], ['loan', Bank], ['bank', Bank], ['financial', Bank], ['fee', Bank],
  ['charity', HandHeart], ['gift', Gift], ['club', Tag], ['membership', Tag], ['giving', Heart], ['social', Heart],
  ['pet', PawPrint], ['kid', Baby], ['child', Baby], ['insurance', Umbrella],
  ['lost', DotsThreeCircle], ['unknown', DotsThreeCircle], ['reconcile', DotsThreeCircle], ['other', DotsThreeCircle],
  ['salary', Wallet], ['wage', Wallet], ['freelance', Laptop], ['contract', Laptop], ['revenue', ChartLineUp], ['sales', ChartLineUp], ['allowance', Coins], ['pocket money', Coins], ['investment', TrendUp], ['interest', TrendUp], ['refund', ArrowCounterClockwise], ['reimburs', ArrowCounterClockwise],
];
function iconForCategory(name) {
  const n = (name || '').toLowerCase();
  for (const [kw, Icon] of ICON_RULES) if (n.includes(kw)) return Icon;
  return null;
}

const tint = (hex) => `color-mix(in oklab, ${hex} 15%, #fff 85%)`;
const inkc = (hex) => `color-mix(in oklab, ${hex} 78%, #000 22%)`;

const Glyph = ({ d: Icon, fill }) => (Icon ? <Icon weight={fill ? 'fill' : 'regular'} /> : null);

function CategoryTile({ name, selected, onClick }) {
  const color = window.BAL.catColor(name);
  const Icon = iconForCategory(name);
  return (
    <button type="button" className={`lazy-cat${selected ? ' on' : ''}`} onClick={onClick}>
      <span className="lazy-cat-ic" style={{ background: tint(color), color: inkc(color) }}>
        {Icon ? <Glyph d={Icon} fill={selected} /> : <b>{(name || '?').charAt(0).toUpperCase()}</b>}
      </span>
      <span>{name}</span>
    </button>
  );
}

function LazySheet({ type, defaultAccountId, onClose }) {
  const cats = window.BAL.categoriesByType(type).map((c) => c.name);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const valid = !!category && Number(amount) > 0;

  const save = () => {
    if (!valid || saving) return;
    setSaving(true);
    const rec = {
      id: window.BAL.newId(), type, date: window.BAL.today(),
      amount: Math.abs(Number(amount)), category, subcategory: '',
      account: defaultAccountId, merchant: category, tags: [],
    };
    window.BAL.saveTxns([rec, ...window.BAL.loadTxns()]);
    onClose();
  };

  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal lazy-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{type === 'income' ? 'Add income' : 'Add expense'}</h3>
          <button className="lib-x" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>
        <div className="modal-body">
          {cats.length === 0 ? (
            <div className="preset-empty">No {type} categories yet — add some in Categories.</div>
          ) : (
            <div className="lazy-catgrid">
              {cats.map((name) => (
                <CategoryTile key={name} name={name} selected={category === name} onClick={() => setCategory(name)} />
              ))}
            </div>
          )}
          <div className="field">
            <label>Amount ({window.BAL.sym()})</label>
            <AmountInput autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={!valid || saving}>
            {saving ? <><span className="btn-spin" />Adding…</> : type === 'income' ? 'Add income' : 'Add expense'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LazyQuickAdd({ defaultAccountId }) {
  const [open, setOpen] = useState(null); // null | 'expense' | 'income'

  if (!defaultAccountId) {
    return (
      <div className="lazy-noacct">
        <p>Pick a default account in <b>Settings → Preferences &amp; Logic</b> to start using Lazy mode.</p>
        <button className="btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('balance:goto', { detail: 'settings' }))}>Go to Settings</button>
      </div>
    );
  }

  return (
    <>
      <div className="lazy-fabs">
        <button type="button" className="lazy-fab lazy-fab-exp" aria-label="Add expense" onClick={() => setOpen('expense')}><Minus weight="bold" /></button>
        <button type="button" className="lazy-fab lazy-fab-inc" aria-label="Add income" onClick={() => setOpen('income')}><Plus weight="bold" /></button>
      </div>
      {open && <LazySheet type={open} defaultAccountId={defaultAccountId} onClose={() => setOpen(null)} />}
    </>
  );
}
