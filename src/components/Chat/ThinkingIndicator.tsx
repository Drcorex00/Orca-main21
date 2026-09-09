import React, { useEffect, useRef, useState } from 'react';

const PHASES = [
  'Reading the ocean',
  'Pulling wave and wind data',
  'Checking sea state',
  'Composing your answer',
];

/**
 * Fluid "processing" animation shown while ORCA is thinking.
 * A flowing wave ribbon plus a shimmering, rotating status line.
 */
export const ThinkingIndicator: React.FC = () => {
  const [phase, setPhase] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      setPhase((p) => (p + 1) % PHASES.length);
    }, 2200);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      {/* Fluid wave ribbon */}
      <svg width="54" height="20" viewBox="0 0 54 20" style={{ overflow: 'visible', flexShrink: 0 }}>
        <defs>
          <linearGradient id="orca-think-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="50%" stopColor="#c9c9c9" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.25)" />
          </linearGradient>
        </defs>
        <path
          className="orca-flow-path"
          d="M0 10 C 7 2, 13 18, 20 10 S 33 2, 40 10 S 53 18, 60 10"
          fill="none"
          stroke="url(#orca-think-grad)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          className="orca-flow-path orca-flow-path-slow"
          d="M0 10 C 7 16, 13 4, 20 10 S 33 16, 40 10 S 53 4, 60 10"
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>

      {/* Shimmering status text */}
      <span key={phase} className="orca-shimmer-text anim-fade-in" style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.03em' }}>
        {PHASES[phase]}…
      </span>
    </div>
  );
};

export default ThinkingIndicator;
