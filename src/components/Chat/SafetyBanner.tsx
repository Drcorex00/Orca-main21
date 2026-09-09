import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SafetyAlert {
  level: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  parameters?: Record<string, any>;
}

interface SafetyBannerProps {
  alerts: SafetyAlert[];
  onDismiss?: (index: number) => void;
}

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="7" />
    <path d="M8 11V7M8 5h.01" strokeLinecap="round" />
  </svg>
);

const WarningIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M8 2l7 12H1L8 2z" />
    <path d="M8 11v-4M8 13h.01" strokeLinecap="round" />
  </svg>
);

const DangerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M5 1L1 5v6l4 4h6l4-4V5l-4-4H5z" />
    <path d="M8 11V5M8 13h.01" strokeLinecap="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M3 3l10 10M13 3L3 13" />
  </svg>
);

const SafetyBanner: React.FC<SafetyBannerProps> = ({ alerts, onDismiss }) => {
  if (!alerts || alerts.length === 0) return null;

  const latest = alerts[alerts.length - 1];
  let icon = <InfoIcon />;
  let color = 'var(--orca-accent-blue)';
  let bgStyle = { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' };

  if (latest.level === 'danger') {
    bgStyle = { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' };
    icon = <DangerIcon />;
    color = 'var(--orca-danger)';
  } else if (latest.level === 'warning') {
    bgStyle = { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.3)' };
    icon = <WarningIcon />;
    color = 'var(--orca-warning)';
  }

  const status = latest.level === 'danger' || latest.level === 'warning'
    ? 'Conditions are hazardous'
    : 'Conditions are favorable';
  const explanation = latest.message.length > 110 ? `${latest.message.slice(0, 107).trim()}...` : latest.message;

  return (
    <div className="w-full px-3 py-2">
      <AnimatePresence>
        <motion.div
          key={latest.title}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
          transition={{ duration: 0.2 }}
          className="flex items-start gap-2 p-2 rounded"
          style={{
            ...bgStyle,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          <div className="flex-shrink-0 mt-0.5" style={{ color }}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-xs font-semibold truncate"
              style={{ color: 'var(--orca-text-primary)' }}
            >
              {status}
            </div>
            <div
              className="text-[10px] leading-tight mt-0.5 line-clamp-1"
              style={{ color: 'var(--orca-text-secondary)' }}
            >
              {explanation}
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={() => onDismiss(alerts.length - 1)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--orca-text-muted)' }}
              aria-label="Dismiss warning"
            >
              <CloseIcon />
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SafetyBanner;
