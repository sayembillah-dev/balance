/* Balance — first-run onboarding. A short, friendly, skippable setup: welcome →
   currency (applied app-wide) → first account → first goal → done. Each step is
   skippable, and the whole flow can be skipped from the top-right. */
import React, { useState } from 'react';
import { CURRENCIES } from '@balance/shared';
import { useAuth } from '../lib/auth.jsx';
import { apiPatch } from '../lib/api.js';

const ACCOUNT_TYPES = [
  { t: 'Bank', e: '🏦', c: '#2f6fe0' },
  { t: 'Card', e: '💳', c: '#7c4dd8' },
  { t: 'Wallet', e: '👛', c: '#138a72' },
  { t: 'Cash', e: '💵', c: '#e0892f' },
];
const GOAL_EMOJIS = ['🎯', '✈️', '💻', '🏠', '🚗', '📱', '💍', '🎓', '🏖️', '🛟'];

const TOTAL = 5;

export default function Onboarding() {
  const { user, markOnboarded } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState('INR');
  const [acct, setAcct] = useState({ name: '', type: 'Bank', opening: '' });
  const [goal, setGoal] = useState({ emoji: '🎯', title: '', target: '' });

  const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'there';
  const sym = (CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0]).symbol;

  const next = () => setStep((s) => Math.min(TOTAL - 1, s + 1));
  const finish = async () => { setBusy(true); await markOnboarded(); /* Gate swaps to the app */ };

  const applyCurrency = async () => {
    setBusy(true);
    try { await apiPatch('/me/settings', { currency }); window.BAL.setCurrency(currency); } catch { /* non-fatal */ }
    setBusy(false); next();
  };

  const addAccount = async () => {
    if (!acct.name.trim()) return;
    setBusy(true);
    const meta = ACCOUNT_TYPES.find((a) => a.t === acct.type);
    window.BAL.saveAccounts([
      ...window.BAL.loadAccounts(),
      { id: window.BAL.newId(), name: acct.name.trim(), type: acct.type, number: null, color: meta.c, opening: Number(acct.opening) || 0 },
    ]);
    setBusy(false); next();
  };

  const addGoal = async () => {
    if (!goal.title.trim() || !(Number(goal.target) > 0)) { next(); return; }
    setBusy(true);
    const data = window.BAL.loadSavings();
    window.BAL.saveSavings({
      pool: data.pool || 0,
      goals: [...(data.goals || []), { id: window.BAL.newId(), emoji: goal.emoji, title: goal.title.trim(), target: Number(goal.target), saved: 0, deadline: '', created: new Date().toISOString().slice(0, 10) }],
    });
    setBusy(false); next();
  };

  return (
    <div className="ob">
      <style>{OB_CSS}</style>

      <button className="ob-skip" onClick={finish} disabled={busy}>Skip setup →</button>

      <div className="ob-stage">
        <div className="ob-progress">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span key={i} className={`ob-dot${i <= step ? ' on' : ''}`} />
          ))}
        </div>

        <div className="ob-card" key={step}>
          {/* 0 — Welcome */}
          {step === 0 && (
            <div className="ob-step">
              <div className="ob-emoji wiggle">👋</div>
              <h1>Welcome, {firstName}!</h1>
              <p>Balance helps you see exactly where your money goes — accounts, spending, budgets and goals, all in one calm place.</p>
              <p className="ob-soft">It takes under a minute to set up. Let's go.</p>
              <div className="ob-actions">
                <button className="btn-primary ob-cta" onClick={next}>Get started</button>
              </div>
            </div>
          )}

          {/* 1 — Currency */}
          {step === 1 && (
            <div className="ob-step">
              <div className="ob-emoji pop" style={{ fontWeight: 700 }}>{sym}</div>
              <h1>Pick your currency</h1>
              <p>This is used everywhere in the app. You can change it later in Settings.</p>
              <div className="ob-grid">
                {CURRENCIES.map((c) => (
                  <button key={c.code} className={`ob-cur${currency === c.code ? ' on' : ''}`} onClick={() => setCurrency(c.code)}>
                    <b>{c.symbol}</b>
                    <span>{c.code}</span>
                    <small>{c.name}</small>
                  </button>
                ))}
              </div>
              <div className="ob-actions">
                <button className="btn-ghost" onClick={next} disabled={busy}>Skip</button>
                <button className="btn-primary ob-cta" onClick={applyCurrency} disabled={busy}>Continue</button>
              </div>
            </div>
          )}

          {/* 2 — First account */}
          {step === 2 && (
            <div className="ob-step">
              <div className="ob-emoji pop">🏦</div>
              <h1>Add your first account</h1>
              <p>Where's your money? Add a bank, card, wallet or cash so you can start tracking. You can add more anytime.</p>
              <div className="ob-types">
                {ACCOUNT_TYPES.map((a) => (
                  <button key={a.t} className={`ob-type${acct.type === a.t ? ' on' : ''}`} onClick={() => setAcct({ ...acct, type: a.t })} style={acct.type === a.t ? { borderColor: a.c, color: a.c } : undefined}>
                    <span>{a.e}</span>{a.t}
                  </button>
                ))}
              </div>
              <div className="ob-form">
                <input className="txn-field" placeholder="Account name (e.g. HDFC Savings)" value={acct.name} onChange={(e) => setAcct({ ...acct, name: e.target.value })} autoFocus />
                <div className="ob-amount">
                  <span className="ob-amt-sym">{sym}</span>
                  <input className="txn-field" type="number" min="0" placeholder="0" value={acct.opening} onChange={(e) => setAcct({ ...acct, opening: e.target.value })} />
                  <small>current balance</small>
                </div>
              </div>
              <div className="ob-actions">
                <button className="btn-ghost" onClick={next} disabled={busy}>Skip for now</button>
                <button className="btn-primary ob-cta" onClick={addAccount} disabled={busy || !acct.name.trim()}>Add account</button>
              </div>
            </div>
          )}

          {/* 3 — First goal */}
          {step === 3 && (
            <div className="ob-step">
              <div className="ob-emoji pop">{goal.emoji}</div>
              <h1>Dream a little</h1>
              <p>Saving for something? Set a goal and watch it fill up. Totally optional.</p>
              <div className="ob-emojis">
                {GOAL_EMOJIS.map((e) => (
                  <button key={e} className={`ob-em${goal.emoji === e ? ' on' : ''}`} onClick={() => setGoal({ ...goal, emoji: e })}>{e}</button>
                ))}
              </div>
              <div className="ob-form">
                <input className="txn-field" placeholder="Goal name (e.g. New laptop)" value={goal.title} onChange={(e) => setGoal({ ...goal, title: e.target.value })} />
                <div className="ob-amount">
                  <span className="ob-amt-sym">{sym}</span>
                  <input className="txn-field" type="number" min="0" placeholder="0" value={goal.target} onChange={(e) => setGoal({ ...goal, target: e.target.value })} />
                  <small>target amount</small>
                </div>
              </div>
              <div className="ob-actions">
                <button className="btn-ghost" onClick={next} disabled={busy}>Skip</button>
                <button className="btn-primary ob-cta" onClick={addGoal} disabled={busy}>{goal.title.trim() && Number(goal.target) > 0 ? 'Add goal' : 'Continue'}</button>
              </div>
            </div>
          )}

          {/* 4 — Done */}
          {step === 4 && (
            <div className="ob-step">
              <div className="ob-emoji burst">🎉</div>
              <h1>You're all set!</h1>
              <p>Here's how to get the most out of Balance:</p>
              <ul className="ob-tips">
                <li><b>＋ New</b> (top bar) logs a transaction in seconds.</li>
                <li><b>Dashboard</b> widgets are yours — add, remove and drag to reorder.</li>
                <li><b>Budgets & Goals</b> keep you on track as you go.</li>
              </ul>
              <div className="ob-actions">
                <button className="btn-primary ob-cta" onClick={finish} disabled={busy}>Go to my dashboard</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const OB_CSS = `
.ob { position: fixed; inset: 0; display: grid; place-items: center; padding: 24px;
  background: radial-gradient(1200px 600px at 50% -10%, var(--primary-soft, #eef0ff), transparent),
              var(--bg, #f7f6f3); overflow: auto; z-index: 50; }
.ob-skip { position: fixed; top: 20px; right: 24px; background: none; border: none; cursor: pointer;
  color: var(--ink-3, #8a8f98); font-size: 14px; font-weight: 600; }
.ob-skip:hover { color: var(--ink, #1a1a1a); }
.ob-stage { width: 100%; max-width: 560px; }
.ob-progress { display: flex; gap: 8px; justify-content: center; margin-bottom: 22px; }
.ob-dot { width: 30px; height: 5px; border-radius: 99px; background: var(--border, #e2e5ea); transition: background .3s; }
.ob-dot.on { background: var(--primary, #4f46e5); }
.ob-card { background: var(--card, #fff); border: 1px solid var(--border, #e7e9ee); border-radius: 22px;
  box-shadow: 0 24px 60px -28px rgba(20,20,40,.35); padding: 38px 34px;
  animation: obIn .42s cubic-bezier(.2,.8,.2,1); }
.ob-step { text-align: center; }
.ob-emoji { font-size: 64px; line-height: 1; margin-bottom: 10px; }
.ob-step h1 { font-size: 26px; margin: 6px 0 8px; color: var(--ink, #15171c); }
.ob-step p { color: var(--ink-2, #5b606b); margin: 0 0 6px; line-height: 1.5; }
.ob-soft { color: var(--ink-3, #9aa0aa) !important; font-size: 14px; }
.ob-actions { display: flex; gap: 10px; justify-content: center; margin-top: 24px; }
.ob-cta { min-width: 180px; }
.ob-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0 4px; }
.ob-cur { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 14px 8px; cursor: pointer;
  border: 2px solid var(--border, #e7e9ee); border-radius: 14px; background: var(--card, #fff); transition: .16s; }
.ob-cur:hover { border-color: var(--primary, #4f46e5); transform: translateY(-2px); }
.ob-cur.on { border-color: var(--primary, #4f46e5); background: var(--primary-soft, #eef0ff); }
.ob-cur b { font-size: 24px; }
.ob-cur span { font-weight: 700; font-size: 13px; }
.ob-cur small { color: var(--ink-3, #9aa0aa); font-size: 11px; }
.ob-types { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 18px 0 14px; }
.ob-type { display: flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 99px; cursor: pointer;
  border: 2px solid var(--border, #e7e9ee); background: var(--card, #fff); font-weight: 600; transition: .16s; }
.ob-type.on { background: var(--primary-soft, #eef0ff); }
.ob-form { display: flex; flex-direction: column; gap: 12px; text-align: left; margin-top: 6px; }
.ob-form .txn-field { width: 100%; height: 46px; }
.ob-amount { position: relative; display: flex; align-items: center; gap: 10px; }
.ob-amount .txn-field { padding-left: 30px; flex: 1; }
.ob-amt-sym { position: absolute; left: 12px; font-weight: 700; color: var(--ink-2, #5b606b); pointer-events: none; }
.ob-amount small { color: var(--ink-3, #9aa0aa); font-size: 12px; white-space: nowrap; }
.ob-emojis { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 16px 0; }
.ob-em { font-size: 22px; width: 42px; height: 42px; border-radius: 12px; cursor: pointer;
  border: 2px solid var(--border, #e7e9ee); background: var(--card, #fff); transition: .14s; }
.ob-em:hover { transform: scale(1.08); }
.ob-em.on { border-color: var(--primary, #4f46e5); background: var(--primary-soft, #eef0ff); }
.ob-tips { text-align: left; margin: 14px auto 0; max-width: 380px; color: var(--ink-2, #5b606b); line-height: 1.8; padding-left: 18px; }
@keyframes obIn { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes obWiggle { 0%,100% { transform: rotate(0); } 25% { transform: rotate(16deg); } 75% { transform: rotate(-12deg); } }
@keyframes obPop { from { transform: scale(.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes obBurst { 0% { transform: scale(.3) rotate(-15deg); } 60% { transform: scale(1.25) rotate(8deg); } 100% { transform: scale(1) rotate(0); } }
.wiggle { animation: obWiggle 1s ease-in-out 2; transform-origin: 70% 70%; }
.pop { animation: obPop .4s cubic-bezier(.2,1.4,.4,1); }
.burst { animation: obBurst .7s cubic-bezier(.2,1.3,.3,1); }
`;
