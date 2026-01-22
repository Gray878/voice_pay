import React from 'react';
import { TransactionState } from '../types';

interface TransactionStatusProps {
  state: TransactionState;
}

const TransactionStatus: React.FC<TransactionStatusProps> = ({ state }) => {
  if (state.status === 'idle') return null;

  const getStatusIcon = () => {
    switch (state.status) {
      case 'processing':
      case 'pending':
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      case 'success':
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case 'error':
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      case 'confirmation':
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      default:
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  const getStatusClass = () => {
    switch (state.status) {
      case 'success':
        return 'status-success';
      case 'error':
        return 'status-error';
      case 'processing':
      case 'pending':
        return 'status-processing';
      case 'confirmation':
        return 'status-confirmation';
      default:
        return 'status-info';
    }
  };

  return (
    <div className={`transaction-status ${getStatusClass()}`}>
      <span className="status-icon">{getStatusIcon()}</span>
      <div className="status-content">
        <p className="status-message">{state.message}</p>
        {state.txHash && (
          <p className="tx-hash">
            交易哈希: <code>{state.txHash.slice(0, 10)}...{state.txHash.slice(-8)}</code>
          </p>
        )}
      </div>
      {(state.status === 'processing' || state.status === 'pending') && (
        <div className="loading-spinner"></div>
      )}
    </div>
  );
};

export default TransactionStatus;
