import React, { useState, useEffect } from 'react'
import type { BookProject, Page, SimulatorAsset, NodeType, ContentBlock } from './types'
import './editor_libro.css';
import { PageEditor } from './components/PageEditor';
import { SimulatorUploader } from './components/SimulatorUploader';
// Importamos iconos para la interfaz
import { Moon, Sun, Save, FolderOpen, Download, Undo, HelpCircle } from 'lucide-react'; 
import { generateBookHTML } from './engine/ExportEngine';

const INITIAL_PROJECT: BookProject = {
  meta: { title: "Nuevo Libro Interactivo", author: "Anon", created: Date.now(), theme: 'light' },
  assets: { simulators: [] },
  pages: [ ]
};

function App() {
  const [project, setProject] = useState<BookProject>(INITIAL_PROJECT);
  
  // 1. ESTADO PARA EL HISTORIAL (UNDO)
  const [history, setHistory] = useState<BookProject[]>([]);

  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // --- EFECTO MODO OSCURO ---
  useEffect(() => {
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // --- SISTEMA DE UNDO (DESHACER) ---
  const pushToHistory = () => {
    setHistory(prev => {
        const newHist = [...prev, project];
        if (newHist.length > 20) newHist.shift(); // Guardamos máx 20 pasos
        return newHist;
    });
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setProject(previousState);
    
    // Intentamos mantener la página activa si existe en el estado anterior
    if (previousState.pages.length > 0 && (!activePageId || !previousState.pages.find(p => p.id === activePageId))) {
        setActivePageId(previousState.pages[0].id);
    }
  };

  // --- GESTIÓN DE PÁGINAS ---
  const handleAddPage = (type: NodeType = 'seccion') => {
    pushToHistory(); 
    const newPage: Page = {
      id: crypto.randomUUID(), 
      type: type,
      title: type === 'capitulo' ? "Nuevo Capítulo" : "Nueva Sección",
      blocks: []
    };
    setProject(prev => ({ ...prev, pages: [...prev.pages, newPage] }));
    setActivePageId(newPage.id);
  };

  const handleUpdatePage = (updatedPage: Page) => {
    setProject(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === updatedPage.id ? updatedPage : p)
    }))
  };

  // --- ESTILOS DINÁMICOS PARA EL ÍNDICE ---
  const getIndentStyle = (type: NodeType) => {
      switch(type) {
          case 'capitulo': return { fontWeight: 'bold', borderLeft: '4px solid var(--brand-primary)', paddingLeft: '8px' };
          case 'subseccion': return { paddingLeft: '30px', fontSize: '0.9em', borderLeft: '1px solid var(--border-color)' };
          case 'portada': return { fontStyle: 'italic', color: 'var(--brand-accent)' };
          default: return { paddingLeft: '15px' }; // seccion normal
      }
  };

  const handleSaveSimulator = (name: string, code: string) => {
    const newSim: SimulatorAsset = {
      id: "sim_" + crypto.randomUUID().slice(0, 8),
      name: name,
      code: code,
      version: "1.0",
      timestamp: Date.now()
    };
    setProject(prev => ({
      ...prev,
      assets: { ...prev.assets, simulators: [...prev.assets.simulators, newSim] }
    }));
    alert(`¡Simulador "${name}" añadido a la librería!`);
  };

  // --- GUARDAR JSON ---
  const saveProjectJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", project.meta.title + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // --- CARGAR JSON (CON LÓGICA DE CONVERSIÓN RESTAURADA) ---
  const loadProjectJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target?.result as string);
            
            // CASO A: Proyecto Nuevo (Formato V2)
            if (json.meta && json.pages && !Array.isArray(json)) {
                setProject(json);
                setActivePageId(json.pages[0]?.id || null);
                alert("Proyecto cargado correctamente.");
                return;
            }

            // CASO B: Proyecto Legacy (Array de tus compañeros)
            if (Array.isArray(json)) {
                console.log("Detectado formato Legacy. Convirtiendo...");
                
                const convertedPages: Page[] = json.map((legacyPage: any) => {
                    const blocks: ContentBlock[] = [];
                    const contentStr = legacyPage.contenido || "";
                    
                    // Regex para encontrar [simulador:nombre]
                    const regex = /\[simulador:([a-zA-Z0-9_]+)\]/g;
                    let lastIndex = 0;
                    let match;

                    while ((match = regex.exec(contentStr)) !== null) {
                        // 1. Texto antes del simulador
                        const textPart = contentStr.slice(lastIndex, match.index).trim();
                        if (textPart) {
                            blocks.push({
                                id: crypto.randomUUID(),
                                type: 'text',
                                content: textPart
                            });
                        }

                        // 2. El simulador (Placeholder legacy)
                        const simIdRaw = match[1];
                        blocks.push({
                            id: crypto.randomUUID(),
                            type: 'simulator',
                            content: '',
                            simulatorId: "legacy_" + simIdRaw, 
                            simConfig: {}
                        });

                        lastIndex = regex.lastIndex;
                    }

                    // 3. Texto final restante
                    const remainingText = contentStr.slice(lastIndex).trim();
                    if (remainingText) {
                        blocks.push({
                            id: crypto.randomUUID(),
                            type: 'text',
                            content: remainingText
                        });
                    }

                    // Intentamos mapear el tipo antiguo al nuevo
                    let pageType: NodeType = 'seccion';
                    if (legacyPage.tipo === 'capitulo') pageType = 'capitulo';
                    if (legacyPage.tipo === 'portada') pageType = 'portada';

                    return {
                        id: legacyPage.id || crypto.randomUUID(),
                        type: pageType, // <--- AQUI APLICAMOS EL TIPO DETECTADO
                        title: legacyPage.titulo || "Sin Título",
                        blocks: blocks.length > 0 ? blocks : [{ 
                            id: crypto.randomUUID(), 
                            type: 'text', 
                            content: '' 
                        }]
                    };
                });

                const newProject: BookProject = {
                    meta: { 
                        title: "Proyecto Importado", 
                        author: "Usuario", 
                        created: Date.now(), 
                        theme: 'light' 
                    },
                    assets: { simulators: [] },
                    pages: convertedPages
                };

                setProject(newProject);
                setActivePageId(convertedPages[0]?.id || null);
                alert("Proyecto antiguo convertido exitosamente.\n\nIMPORTANTE: Recuerda subir los archivos .js de los simuladores usando el botón '+ Importar Simulador' para que funcionen.");
            } else {
                alert("Formato de archivo no reconocido.");
            }

        } catch (error) {
            console.error(error);
            alert("Error al leer el archivo JSON.");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // --- EXPORTAR HTML ---
  const handleExportHTML = () => {
      // Usamos la función importada directamente desde arriba
      const htmlContent = generateBookHTML(project);
      
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = `${project.meta.title.replace(/\s+/g, '_')}_offline.html`;
      document.body.appendChild(a); 
      a.click(); 
      document.body.removeChild(a); 
      URL.revokeObjectURL(url);
  };

  return (
    <div className="app-container">
      <header>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <h1>{project.meta.title}</h1>
        </div>
        
        <div className="sep"></div>

        {/* --- BOTONES HEADER --- */}
        <a 
            href="/ayuda.html" 
            target="_blank" 
            className="button-lookalike" 
            title="Ver Ayuda"
            style={{textDecoration:'none', color:'inherit'}}
        >
            <HelpCircle size={18} style={{marginRight:5}}/> Ayuda
        </a>

        <button 
            onClick={handleUndo} 
            disabled={history.length === 0}
            title="Deshacer último cambio"
        >
            <Undo size={18}/> Deshacer
        </button>

        <div className="sep" style={{flex:0, width:'1px', height:'20px', margin:'0 10px'}}></div>

        <button onClick={() => setIsDarkMode(!isDarkMode)}>
            {isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
        </button>

        <label htmlFor="load-project-input" className="button-lookalike">
            <FolderOpen size={18} style={{marginRight:5}}/> Cargar
        </label>
        <input 
            id="load-project-input" 
            type="file" 
            accept=".json" 
            onChange={loadProjectJSON} 
            style={{display:'none'}}
        />

        <button id="btnGuardar" onClick={saveProjectJSON} style={{display:'flex', alignItems:'center', gap:'5px'}}>
            <Save size={18}/> Guardar
        </button>
        
        <button id="btnDescargar" onClick={handleExportHTML} style={{display:'flex', alignItems:'center', gap:'5px'}}>
            <Download size={18}/> Exportar
        </button>
      </header>
  
      <div className="layout">
        <aside className="toc">
          <h2>Contenido</h2>
          
          {/* --- BARRA LATERAL (Botones Divididos) --- */}
          <div className="toolbar" style={{display:'flex', gap:'5px', flexWrap:'wrap'}}>
            <button onClick={() => handleAddPage('capitulo')} style={{flex:1, fontSize:'0.8rem'}}>+ Cap</button>
            <button onClick={() => handleAddPage('seccion')} style={{flex:1, fontSize:'0.8rem'}}>+ Sec</button>
            
            <button 
              onClick={() => setIsUploadModalOpen(true)}
              style={{ width:'100%', marginTop:'5px', backgroundColor: 'var(--brand-success)', color:'white', borderColor: 'var(--brand-success)'} }
              >+ Simulador</button>
          </div>

          <ul style={{ marginTop: '1rem' }}>
            {project.pages.map(page => (
              <li
                key={page.id}
                className={page.id === activePageId ? 'selected' : ''}
                style={getIndentStyle(page.type)}
                onClick={() => setActivePageId(page.id)}
              >
                {page.type === 'capitulo' ? page.title.toUpperCase() : page.title}
              </li>
            ))}
          </ul>
        </aside>

        <main className="main">
          {activePageId ? (
            (() => {
              const activePage = project.pages.find(p => p.id === activePageId);
              if (!activePage) return <p className="error">Página no encontrada.</p>;
              return (
                <PageEditor
                  page={activePage}
                  availableSimulators={project.assets.simulators}
                  onUpdatePage={handleUpdatePage}
                />
              );
            })()
          ) : project.pages.length === 0 ? (
            <div className="empty-state">
              <h3>¡Bienvenido!</h3>
              <p>Comienza añadiendo un Capítulo.</p>
            </div>
          ) : (
            <div className="info">
              Selecciona una página para editar.
            </div>
          )}
        </main>
      </div>

      <SimulatorUploader
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSave={handleSaveSimulator}
      />
    </div>
  );
}

const styleSheet = document.createElement("style");
styleSheet.innerText = `
  .button-lookalike {
    font-family: var(--font-sans);
    font-size: 0.9rem;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    font-weight: 600;
    transition: all var(--transition-fast);
  }
  .button-lookalike:hover {
    background: var(--bg-secondary);
    border-color: var(--brand-primary);
  }
`;
document.head.appendChild(styleSheet);

export default App;