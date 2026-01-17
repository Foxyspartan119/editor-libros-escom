import React, { useMemo } from 'react';
import type { ContentBlock, SimulatorAsset } from '../types';
import { SimulatorRenderer } from './SimulatorRenderer';
import { Trash2, ArrowUp, ArrowDown, GripVertical, Type, Gamepad2 } from 'lucide-react';

interface BlockEditorProps {
  block: ContentBlock;
  availableSimulators: SimulatorAsset[];
  onUpdate: (updatedBlock: ContentBlock) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  availableSimulators,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast
}) => {
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ ...block, content: e.target.value });
  };

  const handleSimulatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const simId = e.target.value;
    onUpdate({
      ...block,
      simulatorId: simId,
      simConfig: {}
    });
  };

  const currentSimAsset = useMemo(
    () => availableSimulators.find(s => s.id === block.simulatorId),
    [availableSimulators, block.simulatorId]
  );

  const kindLabel = block.type === 'simulator' ? 'Simulador' : 'Texto / LaTeX';

  return (
    <section className={`block-card fade-in ${block.type === 'simulator' ? 'is-sim' : 'is-text'}`}>
      <div className="block-toolbar">
        <div className="block-left">
          <span className="block-grip" title="Bloque">
            <GripVertical size={16} />
          </span>

          <span className={`block-tag ${block.type === 'simulator' ? 'sim' : 'text'}`}>
            {block.type === 'simulator' ? <Gamepad2 size={14} /> : <Type size={14} />}
            {kindLabel}
          </span>

          {block.type === 'simulator' && (
            <span className="block-hint">
              {currentSimAsset ? `Usando: ${currentSimAsset.name}` : 'Selecciona un simulador'}
            </span>
          )}
        </div>

        <div className="block-actions">
          <button className="icon-mini" onClick={onMoveUp} disabled={isFirst} title="Subir">
            <ArrowUp size={16} />
          </button>
          <button className="icon-mini" onClick={onMoveDown} disabled={isLast} title="Bajar">
            <ArrowDown size={16} />
          </button>
          <button className="icon-mini danger" onClick={onDelete} title="Eliminar">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="block-body">
        {block.type === 'text' && (
          <textarea
            className="block-textarea"
            value={block.content}
            onChange={handleContentChange}
            placeholder="Escribe aquí tu contenido… (LaTeX entre \\( \\) o $$ $$)"
            rows={5}
          />
        )}

        {block.type === 'simulator' && (
          <div className="block-sim">
            <div className="block-field">
              <label className="block-label">Elige un simulador</label>
              <select
                className="block-select"
                value={block.simulatorId || ''}
                onChange={handleSimulatorChange}
              >
                <option value="">— Selecciona un simulador —</option>
                {availableSimulators.map(sim => (
                  <option key={sim.id} value={sim.id}>
                    {sim.name} (v{sim.version})
                  </option>
                ))}
              </select>
            </div>

            {block.simulatorId && !currentSimAsset && (
              <div className="block-warning">
                ⚠️ Simulador no encontrado (¿fue borrado?)
              </div>
            )}

            {currentSimAsset && (
              <div className="block-preview">
                <div className="block-preview-title">Vista previa en vivo</div>
                <div className="block-preview-frame">
                  <SimulatorRenderer code={currentSimAsset.code} params={block.simConfig || {}} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
