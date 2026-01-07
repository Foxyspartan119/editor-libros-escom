import React from 'react';
import type { Page, ContentBlock, SimulatorAsset } from '../types';
import { BlockEditor } from './BlockEditor';
import { FileText, Gamepad2 } from 'lucide-react'; // Iconos

interface PageEditorProps {
  page: Page;
  availableSimulators: SimulatorAsset[];
  onUpdatePage: (updatedPage: Page) => void;
}

export const PageEditor: React.FC<PageEditorProps> = ({ page, availableSimulators, onUpdatePage }) => {

  // --- Funciones CRUD de Bloques ---
  
  const updateBlock = (blockId: string, newData: ContentBlock) => {
    const newBlocks = page.blocks.map(b => b.id === blockId ? newData : b);
    onUpdatePage({ ...page, blocks: newBlocks });
  };

  const deleteBlock = (blockId: string) => {
    if (!confirm("¿Eliminar este bloque?")) return;
    const newBlocks = page.blocks.filter(b => b.id !== blockId);
    onUpdatePage({ ...page, blocks: newBlocks });
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const newBlocks = [...page.blocks];
    const targetIndex = index + direction;
    // Intercambio seguro
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    onUpdatePage({ ...page, blocks: newBlocks });
  };

  const addBlock = (type: 'text' | 'simulator') => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: type,
      content: '', // Vacío para texto
      simulatorId: '', // Vacío para sim
      simConfig: {}
    };
    onUpdatePage({ ...page, blocks: [...page.blocks, newBlock] });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdatePage({ ...page, title: e.target.value });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdatePage({ ...page, type: e.target.value as any });
  };

  return (
    <div className="page-editor">
      {/* Título de la Página */}
      <div style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '10px' }}>Tipo de Página</label>
          <select
            value={page.type || 'seccion'}
            onChange={handleTypeChange}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              fontWeight: 'bold',
              color: 'var(--brand-primary)'
            }}
            >
            <option value="portada">Portada</option>
            <option value="capitulo">Capítulo</option>
            <option value="seccion">Sección</option>
            <option value="subseccion">Subsección</option>
            </select>
        </div>

        <input 
          type="text" 
          value={page.title} 
          onChange={handleTitleChange}
          placeholder="Título de la Página"
          style={{ 
            fontSize: '1.8rem', 
            fontWeight: 'bold', 
            width: '100%', 
            padding: '0.5rem 0', 
            border: 'none', 
            borderBottom: '2px solid var(--brand-primary)',
            background: 'transparent',
            color: 'var(--text-primary)',
            outline: 'none'
          }}
        />
      </div>

      {/* Lista de Bloques */}
      <div className="blocks-list">
        {page.blocks.length === 0 && (
          <div className="empty-state">
            Esta página está vacía. Añade contenido abajo.
          </div>
        )}

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

      {/* Botones de Acción Flotantes o al Final */}
      <div className="actions-area" style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button onClick={() => addBlock('text')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} /> Añadir Texto
        </button>
        <button onClick={() => addBlock('simulator')} style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: 'var(--brand-accent)' }}>
          <Gamepad2 size={18} /> Añadir Simulador
        </button>
      </div>

    </div>
  );
};