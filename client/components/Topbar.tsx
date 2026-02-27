import React from 'react';
import type { SaveStatus } from '../hooks/useAutoSave.ts';

interface TopbarProps {
  currentFile: string | null;
  saveStatus: SaveStatus;
}

const statusConfig: Record<SaveStatus, { label: string; color: string }> = {
  idle: { label: '', color: 'transparent' },
  saving: { label: 'Saving...', color: '#f9e2af' },
  saved: { label: 'Saved', color: '#a6e3a1' },
  error: { label: 'Save failed', color: '#f38ba8' },
};

export function Topbar({ currentFile, saveStatus }: TopbarProps) {
  const status = statusConfig[saveStatus];
  const fileName = currentFile ? currentFile.split('/').pop() : null;

  return (
    <div style={styles.topbar}>
      <div style={styles.left}>
        <span style={styles.appName}>Diagramming Studio</span>
        {fileName && (
          <>
            <span style={styles.separator}>›</span>
            <span style={styles.fileName}>{fileName}</span>
          </>
        )}
      </div>
      <div style={styles.right}>
        {saveStatus !== 'idle' && (
          <span style={{ ...styles.statusBadge, color: status.color }}>
            {saveStatus === 'saving' && <span style={styles.dot} />}
            {status.label}
          </span>
        )}
      </div>
    </div>
  );
}

const styles = {
  topbar: {
    height: '48px',
    background: '#181825',
    borderBottom: '1px solid #313244',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    flexShrink: 0,
  } as React.CSSProperties,
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  appName: {
    fontWeight: 700,
    fontSize: '15px',
    color: '#cba6f7',
    letterSpacing: '-0.3px',
  } as React.CSSProperties,
  separator: {
    color: '#585b70',
    fontSize: '16px',
  } as React.CSSProperties,
  fileName: {
    fontSize: '13px',
    color: '#a6adc8',
    fontFamily: 'monospace',
  } as React.CSSProperties,
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  statusBadge: {
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  } as React.CSSProperties,
  dot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#f9e2af',
    animation: 'pulse 1s infinite',
  } as React.CSSProperties,
};
