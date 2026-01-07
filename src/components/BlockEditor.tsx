// src/components/BlockEditor.tsx
import React from 'react';
import type { ContentBlock, SimulatorAsset } from '../types';
import { SimulatorRenderer } from './SimulatorRenderer';
import { Trash2, ArrowUp, ArrowDown } from 'lucide-react';

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
    
    // Función para actualizar texto
    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate({ ...block, content: e.target.value });
    };

    // Función para cambiar el simulador seleccionado
    const handleSimulatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const simId = e.target.value;
        onUpdate({
            ...block,
            simulatorId: simId,
            simConfig: {} // Reiniciamos parámetros al cambiar de simulador
        });
    };

    // Buscamos el simulador actual en la lista
    const currentSimAsset = availableSimulators.find(s => s.id === block.simulatorId);

    return (
        <div className="paper-container fade-in" style={{ position: 'relative', padding: '1rem', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>

            {/* BARRA DE HERRAMIENTAS */}
            <div className="toolbar-line" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="badge">
                    {block.type === 'simulator' ? '🎮 Simulador' : '📝 Texto / LaTeX'}
                </span>

                <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={onMoveUp} disabled={isFirst} title="Subir">
                        <ArrowUp size={16} />
                    </button>
                    <button onClick={onMoveDown} disabled={isLast} title="Bajar">
                        <ArrowDown size={16} />
                    </button>
                    <button onClick={onDelete} className="delete-btn" style={{ color: 'var(--brand-error)', borderColor: 'var(--brand-error)' }} title="Eliminar">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* --- CASO 1: EDITOR DE TEXTO --- */}
            {block.type === 'text' && (
                <textarea
                    value={block.content}
                    onChange={handleContentChange}
                    placeholder="Escribe aquí tu contenido... (Soporta LaTeX entre \( \))"
                    rows={4}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                />
            )}

            {/* --- CASO 2: EDITOR DE SIMULADOR --- */}
            {block.type === 'simulator' && (
                <div>
                    {/* Selector de Simulador */}
                    <div className="row" style={{ marginBottom: '1rem' }}>
                        <label style={{ fontWeight: 'bold', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>
                            Elige un Simulador:
                        </label>
                        <select 
                            value={block.simulatorId || ''} 
                            onChange={handleSimulatorChange}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                        >
                            <option value="">-- Selecciona un simulador --</option>
                            {availableSimulators.map(sim => (
                                <option key={sim.id} value={sim.id}>
                                    {sim.name} (v{sim.version})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Previsualización */}
                    {currentSimAsset ? (
                        <div style={{ border: '2px dashed var(--brand-secondary)', padding: '10px', borderRadius: '8px', background: '#f8fafc' }}>
                            <p style={{fontSize: '0.8em', color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 10px 0'}}>
                                — Vista Previa en Vivo —
                            </p>
                            <SimulatorRenderer 
                                code={currentSimAsset.code} 
                                params={block.simConfig || {}} 
                            />
                        </div>
                    ) : (
                        block.simulatorId && <p className="text-muted">⚠️ Simulador no encontrado (¿fue borrado?)</p>
                    )}
                </div>
            )}
        </div>
    );
};