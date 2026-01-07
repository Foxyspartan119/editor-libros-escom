import React, { useState } from 'react';
import { loadSimulatorFromCode } from '../engine/SimulatorLoader';
import { Upload, X, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import { SimulatorRenderer } from './SimulatorRenderer'; // <--- IMPORTAMOS ESTO

interface SimulatorUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, code: string) => void;
}

export const SimulatorUploader: React.FC<SimulatorUploaderProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'validating' | 'valid' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Usar el nombre del archivo como nombre por defecto si está vacío
    if (!name) setName(selectedFile.name.replace('.js', '').replace(/_/g, ' '));
    setStatus('validating');

    try {
      const text = await selectedFile.text();
      await loadSimulatorFromCode(text); // Validamos
      
      setCode(text);
      setStatus('valid');
      setErrorMessage('');
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'El archivo no es un simulador válido.');
      setCode(null);
    }
  };

  const handleConfirm = () => {
    if (code && name) {
      onSave(name, code);
      handleClose();
    }
  };

  const handleClose = () => {
    setName('');
    setCode(null);
    setStatus('idle');
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="modal-bg" style={{ display: 'flex' }}>
      {/* Hacemos el modal más ancho para que quepa la preview */}
      <div className="modal fade-in" style={{ width: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2><Upload size={24} /> Subir Simulador</h2>
          <button onClick={handleClose} style={{ border: 'none', background: 'transparent', padding: 0 }}>
            <X size={24} />
          </button>
        </div>

        <div className="row">
          <label style={{ fontWeight: 'bold' }}>Nombre para el Menú:</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Permutaciones Agrupadas"
          />
        </div>

        <div className="row">
          <label style={{ fontWeight: 'bold' }}>Archivo JavaScript (.js):</label>
          <input 
            type="file" 
            accept=".js,text/javascript"
            onChange={handleFileChange}
            style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)' }}
          />
        </div>

        {/* --- AQUÍ LA MAGIA: PREVISUALIZACIÓN --- */}
        <div style={{ marginTop: '1rem', minHeight: '60px' }}>
          {status === 'validating' && <p className="loading">Analizando código...</p>}
          
          {status === 'error' && (
            <div className="feedback-incorrect" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <AlertTriangle size={20} />
              <div>
                <strong>Error:</strong> {errorMessage}
              </div>
            </div>
          )}

          {status === 'valid' && code && (
            <div className="fade-in">
              <div className="feedback-correct" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '1rem' }}>
                <CheckCircle size={20} />
                <div><strong>¡Código Válido!</strong> Listo para subir.</div>
              </div>

              {/* Contenedor de Previsualización */}
              <div style={{ border: '2px solid var(--border-color)', borderRadius: '8px', padding: '15px', background: 'var(--bg-secondary)' }}>
                <h4 style={{ margin: '0 0 10px 0', display:'flex', alignItems:'center', gap:'8px', color: 'var(--text-muted)' }}>
                  <Eye size={16}/> Vista Previa del Simulador
                </h4>
                {/* Renderizamos el simulador aquí mismo */}
                <SimulatorRenderer code={code} params={{}} />
              </div>
            </div>
          )}
        </div>

        <div className="buttons">
          <button onClick={handleClose}>Cancelar</button>
          <button 
            id="btnGuardar"
            disabled={status !== 'valid' || !name} 
            onClick={handleConfirm}
          >
            Subir y Guardar
          </button>
        </div>

      </div>
    </div>
  );
};