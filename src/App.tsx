import React, { useState, useEffect } from 'react'
import type { BookProject, Page, SimulatorAsset, NodeType, ContentBlock } from './types'
import './editor_libro.css';
import { PageEditor } from './components/PageEditor';
import { SimulatorUploader } from './components/SimulatorUploader';
import { SimulatorRenderer } from './components/SimulatorRenderer'; 
// Iconos: Agregamos HelpCircle y quitamos Trash2 (que no se usa aquí)
import { Moon, Sun, Save, FolderOpen, Download, Undo, HelpCircle, CloudUpload, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'; 
import { generateBookHTML } from './engine/ExportEngine';

// --- FIREBASE IMPORTS ---
import { db } from './firebase'; 
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const INITIAL_PROJECT: BookProject = {
  meta: { title: "Cargando...", author: "Anon", created: Date.now(), theme: 'light' },
  assets: { simulators: [] },
  pages: []
};

// ID DEL LIBRO EN LA NUBE
const CLOUD_BOOK_ID = "libro_curso_principal"; 

function App() {
  const [project, setProject] = useState<BookProject>(INITIAL_PROJECT);
  const [history, setHistory] = useState<BookProject[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // ESTADOS DE MODO
  const [isReadOnly, setIsReadOnly] = useState(true); 
  const [isSyncing, setIsSyncing] = useState(false); 

  // --- 1. EFECTO DE INICIO (DETECTAR MODO Y CONECTAR A NUBE) ---
  useEffect(() => {
    // A) Detectar Admin
    const params = new URLSearchParams(window.location.search);
    const isAdmin = params.get('admin') === 'profe123'; 
    setIsReadOnly(!isAdmin);

    // B) Escuchar cambios en la nube (Firebase)
    const unsubscribe = onSnapshot(doc(db, "projects", CLOUD_BOOK_ID), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as BookProject;
            console.log("☁️ Sincronizado desde la nube");
            setProject(data);
            
            if (!activePageId && data.pages.length > 0) {
                 // No forzamos cambio de página para no molestar al usuario
            }
        } else {
             if(isAdmin) console.log("Listo para crear el primer libro en la nube.");
        }
    });

    return () => unsubscribe();
  }, []);

  // --- EFECTO MODO OSCURO ---
  useEffect(() => {
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // ==========================================
  // FUNCIONES DE NUBE (CLOUD)
  // ==========================================
  const saveToCloud = async () => {
    if (isReadOnly) return;
    setIsSyncing(true);
    try {
        await setDoc(doc(db, "projects", CLOUD_BOOK_ID), project);
        alert("✅ ¡Publicado! Todos los alumnos tienen la última versión.");
    } catch (e) {
        console.error(e);
        alert("❌ Error al subir a la nube.");
    } finally {
        setIsSyncing(false);
    }
  };

  // ==========================================
  // FUNCIONES LOCALES (JSON / LEGACY)
  // ==========================================
  
  // 1. Guardar copia en tu PC (Backup)
  const saveProjectJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", project.meta.title + "_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // 2. Cargar archivo (Soporte para lo de tus compañeros)
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
                alert("Proyecto V2 cargado. Dale a 'PUBLICAR' para subirlo a la nube.");
                return;
            }

            // CASO B: Proyecto Legacy (Tus compañeros)
            if (Array.isArray(json)) {
                console.log("Detectado formato Legacy. Convirtiendo...");
                // --- LÓGICA DE CONVERSIÓN ---
                const convertedPages: Page[] = json.map((legacyPage: any) => {
                    const blocks: ContentBlock[] = [];
                    const contentStr = legacyPage.contenido || "";
                    
                    const regex = /\[simulador:([a-zA-Z0-9_]+)\]/g;
                    let lastIndex = 0;
                    let match;

                    while ((match = regex.exec(contentStr)) !== null) {
                        const textPart = contentStr.slice(lastIndex, match.index).trim();
                        if (textPart) blocks.push({ id: crypto.randomUUID(), type: 'text', content: textPart });

                        const simIdRaw = match[1];
                        blocks.push({
                            id: crypto.randomUUID(), type: 'simulator', content: '',
                            simulatorId: "legacy_" + simIdRaw, simConfig: {}
                        });
                        lastIndex = regex.lastIndex;
                    }
                    const remainingText = contentStr.slice(lastIndex).trim();
                    if (remainingText) blocks.push({ id: crypto.randomUUID(), type: 'text', content: remainingText });

                    let pageType: NodeType = 'seccion';
                    if (legacyPage.tipo === 'capitulo') pageType = 'capitulo';
                    if (legacyPage.tipo === 'portada') pageType = 'portada';

                    return {
                        id: legacyPage.id || crypto.randomUUID(),
                        type: pageType,
                        title: legacyPage.titulo || "Sin Título",
                        blocks: blocks.length > 0 ? blocks : [{ id: crypto.randomUUID(), type: 'text', content: '' }]
                    };
                });

                const newProject: BookProject = {
                    meta: { title: "Libro Importado", author: "Usuario", created: Date.now(), theme: 'light' },
                    assets: { simulators: [] },
                    pages: convertedPages
                };

                setProject(newProject);
                setActivePageId(convertedPages[0]?.id || null);
                alert("✅ Archivo antiguo convertido. \n\nPASO SIGUIENTE:\n1. Revisa que el texto esté bien.\n2. Sube los simuladores (.js) que falten.\n3. Dale a 'PUBLICAR' para guardarlo en la nube.");
            } else {
                alert("Formato no reconocido.");
            }

        } catch (error) {
            console.error(error);
            alert("Error al leer el archivo JSON.");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // ==========================================
  // FUNCIONES DE EDICIÓN
  // ==========================================
  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setProject(previousState);
  };

  // --- GESTIÓN DE ORDEN DE PÁGINAS (FASE 3) ---
  const handleMovePage = (pageId: string, direction: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation(); // Evita que se seleccione la página al hacer click en la flecha
    const index = project.pages.findIndex(p => p.id === pageId);
    if (index < 0) return;
    const targetIndex = index + direction;
    
    // Validar límites
    if (targetIndex < 0 || targetIndex >= project.pages.length) return;

    // Clonar y mover
    const newPages = [...project.pages];
    [newPages[index], newPages[targetIndex]] = [newPages[targetIndex], newPages[index]]; // Intercambio mágico
    
    setProject(prev => ({ ...prev, pages: newPages }));
  };

  const handleDeletePage = (pageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Confirmación de seguridad
    if (!confirm("⚠️ ¿Estás seguro de eliminar esta página?\nSe perderá todo el texto y simuladores que tenga dentro.")) return;
    
    setProject(prev => ({
        ...prev,
        pages: prev.pages.filter(p => p.id !== pageId)
    }));
    
    // Si borramos la página que estábamos viendo, deseleccionar
    if (activePageId === pageId) setActivePageId(null);
  };

  const handleAddPage = (type: NodeType = 'seccion') => {
    setHistory(prev => [...prev, project]);
    const newPage: Page = {
      id: crypto.randomUUID(), type: type, title: type === 'capitulo' ? "Nuevo Capítulo" : "Nueva Sección", blocks: []
    };
    setProject(prev => ({ ...prev, pages: [...prev.pages, newPage] }));
    setActivePageId(newPage.id);
  };

  const handleUpdatePage = (updatedPage: Page) => {
    setProject(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === updatedPage.id ? updatedPage : p)
    }));
  };

  const handleSaveSimulator = (name: string, code: string) => {
    const newSim: SimulatorAsset = {
        id: "sim_" + crypto.randomUUID().slice(0, 8),
        name, code, version: "1.0", timestamp: Date.now()
    };
    setProject(prev => ({
        ...prev,
        assets: { ...prev.assets, simulators: [...prev.assets.simulators, newSim] }
    }));
  };

  const getSimulatorCode = (simId?: string) => {
      if(!simId) return "";
      const cleanId = simId.replace('legacy_', '');
      const sim = project.assets.simulators.find(s => s.id === simId || s.id.includes(cleanId));
      return sim ? sim.code : "";
  };

  const handleExportHTML = () => {
      const htmlContent = generateBookHTML(project);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${project.meta.title.replace(/\s+/g,'_')}_offline.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const getIndentStyle = (type: NodeType) => {
    switch(type) {
        case 'capitulo': return { fontWeight: 'bold', borderLeft: '4px solid var(--brand-primary)', paddingLeft: '8px', marginTop:'10px' };
        case 'subseccion': return { paddingLeft: '30px', fontSize: '0.9em', borderLeft: '1px solid var(--border-color)' };
        case 'portada': return { fontStyle: 'italic', color:'var(--brand-accent)' };
        default: return { paddingLeft: '15px' };
    }
  };

  // ==========================================
  // VISTA 1: MODO ALUMNO (LECTOR)
  // ==========================================
  if (isReadOnly) {
      return (
        <div className="reader-container" style={{maxWidth:'900px', margin:'0 auto', padding:'20px', fontFamily:'system-ui, sans-serif'}}>
            <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'40px', paddingBottom:'20px', borderBottom:'1px solid var(--border-color)'}}>
                <div>
                    <h1 style={{margin:0, color:'var(--brand-primary)'}}>{project.meta.title}</h1>
                </div>
                <button onClick={() => setIsDarkMode(!isDarkMode)} style={{background:'none', border:'1px solid gray', padding:'5px', borderRadius:'4px', cursor:'pointer'}}>
                    {isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
                </button>
            </header>
            
            <div className="content-area">
                {project.pages.length === 0 && (
                    <div style={{textAlign:'center', padding:'50px', color:'gray'}}>
                        <p>Cargando contenido o esperando publicación...</p>
                    </div>
                )}
                
                {project.pages.map(page => (
                    <div key={page.id} style={{marginBottom:'60px', animation:'fadeIn 0.5s'}}>
                        {page.type === 'capitulo' && <h2 style={{color:'var(--brand-primary)', borderBottom:'2px solid #eee', paddingBottom:'10px'}}>{page.title}</h2>}
                        {page.type === 'seccion' && <h3 style={{marginTop:'30px'}}>{page.title}</h3>}
                        {page.type === 'subseccion' && <h4 style={{fontStyle:'italic', color:'#555'}}>{page.title}</h4>}
                        {page.type === 'portada' && <h1 style={{textAlign:'center', fontSize:'3em', margin:'50px 0'}}>{page.title}</h1>}

                        <div style={{lineHeight:'1.6'}}>
                        {page.blocks.map(block => (
                            <div key={block.id} style={{margin:'15px 0'}}>
                                {block.type === 'text' && <div dangerouslySetInnerHTML={{__html: block.content.replace(/\n/g, '<br/>')}} />}
                                {block.type === 'simulator' && (
                                    <div style={{border:'1px solid #ddd', padding:'20px', borderRadius:'8px', background: isDarkMode ? '#1a1a1a' : '#f9fafb'}}>
                                        <SimulatorRenderer code={getSimulatorCode(block.simulatorId)} params={block.simConfig || {}} />
                                    </div>
                                )}
                            </div>
                        ))}
                        </div>
                    </div>
                ))}
            </div>
            <footer style={{marginTop:'50px', textAlign:'center', fontSize:'0.8em', color:'gray', padding:'20px'}}>Libro Interactivo - ESCOM</footer>
        </div>
      );
  }

  // ==========================================
  // VISTA 2: MODO PROFESOR (EDITOR)
  // ==========================================
  return (
    <div className="app-container">
      <header>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <h1>{project.meta.title}</h1>
            <span style={{fontSize:'0.7em', background:'var(--brand-error)', color:'white', padding:'2px 6px', borderRadius:'4px'}}>EDITOR</span>
        </div>
        <div className="header-sep"></div>

        {/* --- AQUI VOLVIÓ TU BOTÓN DE AYUDA --- */}
        <a 
            href="ayuda.html" 
            target="_blank" 
            className="button-link" 
            title="Ver Ayuda"
        >
            <HelpCircle size={18} style={{marginRight:5}}/> Ayuda
        </a>

        <button className="icon-button" onClick={() => setIsDarkMode(!isDarkMode)}>
        {isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
    </button>
    <button className="icon-button" onClick={handleUndo} disabled={history.length === 0} title="Deshacer">
        <Undo size={18}/>
    </button>

    <div className="header-sep"></div>

        {/* GRUPO DE ACCIONES LOCALES */}
        <div className="local-actions-group">
             <label className="icon-button" title="Importar JSON viejo">
                <FolderOpen size={18}/>
                <input type="file" accept=".json" onChange={loadProjectJSON} style={{display:'none'}}/>
            </label>
            <button className="icon-button" onClick={saveProjectJSON} title="Guardar Respaldo Local (JSON)"><Save size={18}/></button>
        </div>

        {/* GRUPO DE NUBE */}
        <button 
            onClick={saveToCloud} 
            disabled={isSyncing}
            style={{background:'var(--brand-success)', color:'white', border: 'none', padding:'8px 15px', borderRadius: '6px', fontWeight: 'bold', marginLeft:'auto', display:'flex', alignItems:'center', cursor: 'pointer'}}
        >
            {isSyncing ? 'Subiendo...' : <><CloudUpload size={18} style={{marginRight:5}}/> PUBLICAR</>}
        </button>
        
        <button className="icon-button" onClick={handleExportHTML} title="Descargar HTML Offline" style={{marginLeft:'10px'}}><Download size={18}/></button>
      </header>
  
      <div className="layout">
        <aside className="toc">
          <h2>Contenido</h2>
          <div className="toolbar" style={{display:'flex', gap:'5px', flexWrap:'wrap'}}>
            <button onClick={() => handleAddPage('capitulo')}>+ Cap</button>
            <button onClick={() => handleAddPage('seccion')}>+ Sec</button>
            <button onClick={() => setIsUploadModalOpen(true)} style={{flexBasis:'100%'}}>+ Simulador</button>
          </div>
          <ul style={{ marginTop: '1rem', listStyle: 'none', padding: 0 }}>
            {project.pages.map((page, index) => (
              <li 
                key={page.id} 
                className={page.id === activePageId ? 'selected' : ''} 
                style={getIndentStyle(page.type)}
                onClick={() => setActivePageId(page.id)}
              >
                {/* Título de la página */}
                <span className="page-title-span" title={page.title}>
                    {page.title || "Sin título"}
                </span>

                {/* --- SUPERPODERES: BOTONES FLOTANTES --- */}
                {!isReadOnly && (
                    <div className="page-actions">
                        <button 
                            className="mini-btn" 
                            onClick={(e) => handleMovePage(page.id, -1, e)} 
                            disabled={index === 0}
                            title="Subir"
                        >
                            <ArrowUp size={14}/>
                        </button>
                        
                        <button 
                            className="mini-btn" 
                            onClick={(e) => handleMovePage(page.id, 1, e)} 
                            disabled={index === project.pages.length - 1}
                            title="Bajar"
                        >
                            <ArrowDown size={14}/>
                        </button>
                        
                        <button 
                            className="mini-btn danger" 
                            onClick={(e) => handleDeletePage(page.id, e)} 
                            title="Eliminar Página"
                        >
                            <Trash2 size={14}/>
                        </button>
                    </div>
                )}
              </li>
            ))}
          </ul>
        </aside>

        <main className="main">
          {activePageId ? (
            (() => {
              const activePage = project.pages.find(p => p.id === activePageId);
              if (!activePage) return <p>Error cargando página</p>;
              return <PageEditor page={activePage} availableSimulators={project.assets.simulators} onUpdatePage={handleUpdatePage} />;
            })()
          ) : <div className="empty-state">
              <p>Selecciona una página o carga un proyecto.</p>
          </div>}
        </main>
      </div>

      <SimulatorUploader isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} onSave={handleSaveSimulator} />
    </div>
  );
}

export default App;