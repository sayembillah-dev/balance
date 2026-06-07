/* Balance — AI assistant (coming soon placeholder). */
import React, { useState, useEffect } from 'react';
import { Sparkle, X } from '@phosphor-icons/react';

const A = ({ d: C, fill }) => (C ? <C weight={fill ? 'fill' : 'regular'} /> : null);

function Chat({ onClose }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div className="ai-scrim" onClick={onClose} />
      <div className="ai-drawer" role="dialog" aria-label="Balance assistant">
        <div className="ai-head">
          <span className="mk"><A d={Sparkle} fill /></span>
          <div className="ht"><b>Ask Balance <span className="pill">AI</span></b><span>Your money, answered</span></div>
          <button className="ai-x" onClick={onClose} aria-label="Close"><A d={X} /></button>
        </div>
        <div className="ai-body">
          <div className="ai-empty">
            <span className="orb"><A d={Sparkle} fill /></span>
            <h4>Coming Soon</h4>
            <p>The AI assistant is under development and will be available in a future update.</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AiChat() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('balance:ai-open', h);
    return () => window.removeEventListener('balance:ai-open', h);
  }, []);
  if (!open) return null;
  return <Chat onClose={() => setOpen(false)} />;
}
