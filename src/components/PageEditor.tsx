import React, { useMemo } from 'react';
import '../editor_libro.css';
import type { Page, ContentBlock, SimulatorAsset } from '../types';
import { BlockEditor } from './BlockEditor';
import { FileText, Gamepad2, LayoutPanelTop, Tag } from 'lucide-react';

interface PageEditorProps {
  page: Page;
  availableSimulators: SimulatorAsset[];
  onUpdatePage: (updatedPage: Page) => void;
}

const TYPE_LABEL: Record<string, string> = {
  portada: 'Portada',
  capitulo: 'Capítulo',
  seccion: 'Sección',
  subseccion: 'Subsección',
};

export const PageEditor: React.FC<PageEditorProps> = ({ page, availableSimulators, onUpdatePage }) => {
  const updateBlock = (blockId: string, newData: ContentBlock) => {
    const newBlocks = page.blocks.map(b => (b.id === blockId ? newData : b));
    onUpdatePage({ ...page, blocks: newBlocks });
  };

  const deleteBlock = (blockId: string) => {
    if (!confirm('¿Eliminar este bloque?')) return;
    const newBlocks = page.blocks.filter(b => b.id !== blockId);
    onUpdatePage({ ...page, blocks: newBlocks });
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= page.blocks.length) return;
    const newBlocks = [...page.blocks];
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    onUpdatePage({ ...page, blocks: newBlocks });
  };

  const addBlock = (type: 'text' | 'simulator') => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type,
      content: '',
      simulatorId: '',
      simConfig: {},
    };
    onUpdatePage({ ...page, blocks: [...page.blocks, newBlock] });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdatePage({ ...page, title: e.target.value });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdatePage({ ...page, type: e.target.value as any });
  };

  const stats = useMemo(() => {
    const total = page.blocks?.length ?? 0;
    const text = page.blocks?.filter(b => b.type === 'text').length ?? 0;
    const sims = page.blocks?.filter(b => b.type === 'simulator').length ?? 0;
    return { total, text, sims };
  }, [page.blocks]);

  return (
    <div className="page-editor">
      {/* Top / Meta */}
      <div className="page-top">
        <div className="page-top-left">
          <div className="page-type-row">
            <span className="page-pill">
              <LayoutPanelTop size={14} />
              Editor
            </span>

            <label className="page-type-label">
              <Tag size={14} />
              Tipo
            </label>

            <select className="page-type-select" value={page.type || 'seccion'} onChange={handleTypeChange}>
              <option value="portada">Portada</option>
              <option value="capitulo">Capítulo</option>
              <option value="seccion">Sección</option>
              <option value="subseccion">Subsección</option>
            </select>

            <span className="page-chip">
              {TYPE_LABEL[String(page.type || 'seccion')] ?? 'Sección'}
            </span>
          </div>

          <input
            className="page-title-input"
            type="text"
            value={page.title}
            onChange={handleTitleChange}
            placeholder="Título de la página"
          />

          <div className="page-submeta">
            <span className="page-submeta-item">{stats.total} bloques</span>
            <span className="page-dot">•</span>
            <span className="page-submeta-item">{stats.text} texto</span>
            <span className="page-dot">•</span>
            <span className="page-submeta-item">{stats.sims} simuladores</span>
          </div>
        </div>

        {/* Actions
        <div className="page-top-actions">
          <button className="btn-action" onClick={() => addBlock('text')}>
            <FileText size={18} /> Añadir texto
          </button>

          <button className="btn-action accent" onClick={() => addBlock('simulator')}>
            <Gamepad2 size={18} /> Añadir simulador
          </button>
        </div>
        */}
      </div>
      
      {/* Content */}
      <div className="page-content">
        {page.blocks.length === 0 ? (
          <div className="page-empty">
            <div className="page-empty-emoji">🧱</div>
            <div className="page-empty-title">Esta página está vacía</div>
            <div className="page-empty-sub">Agrega un bloque de texto o un simulador para empezar.</div>

            <div className="page-empty-actions">
              <button className="btn-action" onClick={() => addBlock('text')}>
                <FileText size={18} /> Añadir texto
              </button>
              <button className="btn-action accent" onClick={() => addBlock('simulator')}>
                <Gamepad2 size={18} /> Añadir simulador
              </button>
            </div>
          </div>
        ) : (
          <div className="blocks-list">
            {page.blocks.map((block, index) => (
              <BlockEditor
                key={block.id}
                block={block}
                availableSimulators={availableSimulators}
                onUpdate={(newData) => updateBlock(block.id, newData)}
                onDelete={() => deleteBlock(block.id)}
                onMoveUp={() => moveBlock(index, -1)}
                onMoveDown={() => moveBlock(index, 1)}
                isFirst={index === 0}
                isLast={index === page.blocks.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="page-bottom">
        <div className="page-bottom-inner">
          <span className="page-bottom-hint">Tip: usa bloques cortos y títulos claros para que el libro se lea mejor 📚</span>
          <div className="page-bottom-actions">
            <button className="btn-action" onClick={() => addBlock('text')}>
              <FileText size={18} /> Texto
            </button>
            <button className="btn-action accent" onClick={() => addBlock('simulator')}>
              <Gamepad2 size={18} /> Simulador
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
