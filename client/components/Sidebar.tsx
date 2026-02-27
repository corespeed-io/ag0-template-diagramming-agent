import React, { useState } from 'react';

interface SidebarProps {
  files: string[];
  currentFile: string | null;
  onSelect: (file: string) => void;
  onCreateFile: (name: string) => Promise<boolean>;
  loading: boolean;
}

export function Sidebar({ files, currentFile, onSelect, onCreateFile, loading }: SidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newFileName.trim()) return;
    setCreateError(null);
    const success = await onCreateFile(newFileName.trim());
    if (success) {
      const fileName = newFileName.trim().endsWith('.excalidraw')
        ? newFileName.trim()
        : `${newFileName.trim()}.excalidraw`;
      setIsCreating(false);
      setNewFileName('');
      onSelect(fileName);
    } else {
      setCreateError('Could not create file');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') {
      setIsCreating(false);
      setNewFileName('');
      setCreateError(null);
    }
  };

  return (
    <div style={styles.sidebar}>
      <div style={styles.header}>
        <span style={styles.headerText}>Files</span>
        <button
          style={styles.addBtn}
          onClick={() => { setIsCreating(true); setCreateError(null); }}
          title="New diagram"
        >
          +
        </button>
      </div>

      {isCreating && (
        <div style={styles.createBox}>
          <input
            autoFocus
            style={styles.input}
            placeholder="diagram-name"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span style={styles.ext}>.excalidraw</span>
          {createError && <div style={styles.errorText}>{createError}</div>}
          <div style={styles.createActions}>
            <button style={styles.createBtn} onClick={handleCreate}>Create</button>
            <button style={styles.cancelBtn} onClick={() => { setIsCreating(false); setNewFileName(''); setCreateError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={styles.fileList}>
        {loading && <div style={styles.hint}>Loading...</div>}
        {!loading && files.length === 0 && (
          <div style={styles.hint}>No .excalidraw files found.<br />Click + to create one.</div>
        )}
        {files.map((file) => {
          const isActive = file === currentFile;
          const name = file.split('/').pop() ?? file;
          const dir = file.includes('/') ? file.split('/').slice(0, -1).join('/') : null;

          return (
            <button
              key={file}
              style={{ ...styles.fileItem, ...(isActive ? styles.fileItemActive : {}) }}
              onClick={() => onSelect(file)}
              title={file}
            >
              <span style={styles.fileIcon}>⬡</span>
              <span style={styles.fileInfo}>
                <span style={styles.filePrimary}>{name.replace('.excalidraw', '')}</span>
                {dir && <span style={styles.fileSecondary}>{dir}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: '220px',
    flexShrink: 0,
    background: '#1e1e2e',
    borderRight: '1px solid #313244',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px 8px',
    borderBottom: '1px solid #313244',
  },
  headerText: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    color: '#6c7086',
  },
  addBtn: {
    background: 'none',
    border: '1px solid #45475a',
    color: '#cdd6f4',
    borderRadius: '4px',
    width: '22px',
    height: '22px',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  createBox: {
    padding: '8px 10px',
    borderBottom: '1px solid #313244',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  input: {
    background: '#181825',
    border: '1px solid #45475a',
    borderRadius: '4px',
    color: '#cdd6f4',
    padding: '4px 8px',
    fontSize: '12px',
    outline: 'none',
    width: '100%',
  },
  ext: {
    fontSize: '10px',
    color: '#6c7086',
  },
  createActions: {
    display: 'flex',
    gap: '6px',
  },
  createBtn: {
    background: '#cba6f7',
    color: '#1e1e2e',
    border: 'none',
    borderRadius: '4px',
    padding: '3px 10px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  cancelBtn: {
    background: 'none',
    color: '#6c7086',
    border: '1px solid #45475a',
    borderRadius: '4px',
    padding: '3px 10px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  errorText: {
    color: '#f38ba8',
    fontSize: '11px',
  },
  fileList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '4px 0',
  },
  hint: {
    padding: '16px 12px',
    fontSize: '12px',
    color: '#585b70',
    lineHeight: 1.5,
  },
  fileItem: {
    width: 'calc(100% - 8px)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textAlign: 'left' as const,
    borderRadius: '4px',
    margin: '1px 4px',
  },
  fileItemActive: {
    background: '#313244',
  },
  fileIcon: {
    fontSize: '14px',
    color: '#cba6f7',
    flexShrink: 0,
  },
  fileInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    minWidth: 0,
  },
  filePrimary: {
    fontSize: '13px',
    color: '#cdd6f4',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  fileSecondary: {
    fontSize: '10px',
    color: '#6c7086',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
};
