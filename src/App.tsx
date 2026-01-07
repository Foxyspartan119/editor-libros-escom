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
import { doc, onSnapshot, setDoc, collection, query } from 'firebase/firestore';

declare global {
    interface Window {
        MathJax: any;
    }
}

const INITIAL_PROJECT: BookProject = {
  meta: { title: "Libro Interactivo", author: "Anon", created: Date.now(), theme: 'light' },
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

  // Memoria para la nube
  const [cloudSimulators, setCloudSimulators] = useState<SimulatorAsset[]>([]);

  // Indice de la página que está leyendo el alumno
  const [readerPageIndex, setReaderPageIndex] = useState(0);

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
            
            setReaderPageIndex(0); // Reiniciar al inicio
        } else {
             if(isAdmin) console.log("Listo para crear el primer libro en la nube.");
        }
    });

    return () => unsubscribe();
  }, []);

// --- ANTENA 2: ESCUCHAR SIMULADORES (VERSIÓN ROBUSTA) ---
  useEffect(() => {
    // 1. Quitamos 'orderBy' temporalmente para evitar errores de índice silenciosos
    const q = query(collection(db, "simuladores")); 
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sims = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SimulatorAsset[];

      console.log("🎮 Lista de Nube cargada:", sims.length, sims);
      setCloudSimulators(sims); // <--- GUARDAMOS EN LA VARIABLE SEGURA
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
  // VISTA 1: MODO ALUMNO (LECTOR CON PAGINACIÓN)
  // ==========================================
if (isReadOnly) {
    const currentPage = project.pages[readerPageIndex];
    const totalPages = project.pages.length;

    // 1. EFECTO MAESTRO DE MATHJAX
    useEffect(() => {
        // A) Definir la configuración ANTES de cargar el script
        window.MathJax = {
            tex: {
                inlineMath: [['$', '$'], ['\\(', '\\)']],
                displayMath: [['$$', '$$'], ['\\[', '\\]']],
                packages: ['base', 'ams']
            },
            startup: {
                typeset: false // Lo haremos manualmente para evitar conflictos con React
            }
        };

        // B) Cargar el script si no existe
        if (!document.getElementById('mathjax-script')) {
            const script = document.createElement('script');
            script.id = 'mathjax-script';
            script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
            script.async = true;
            document.head.appendChild(script);
        }
    }, []);

    // 2. EFECTO DE RENDERIZADO (Se activa al cambiar de página)
    useEffect(() => {
        if (currentPage && window.MathJax && window.MathJax.typesetPromise) {
            // Damos un respiro de 50ms para asegurar que el DOM de React ya pintó el texto
            setTimeout(() => {
                const contentDiv = document.getElementById('book-content-area');
                if (contentDiv) {
                    // Limpiamos renderizados previos para evitar duplicados
                    window.MathJax.typesetClear([contentDiv]);
                    // Renderizamos
                    window.MathJax.typesetPromise([contentDiv]).catch((err: any) => console.error(err));
                }
            }, 50);
        }
    }, [readerPageIndex, currentPage]); // Se repite cada vez que cambias de página

    const handleNext = () => {
        if (readerPageIndex < totalPages - 1) {
            setReaderPageIndex(prev => prev + 1);
            window.scrollTo(0, 0);
        }
    };

    const handlePrev = () => {
        if (readerPageIndex > 0) {
            setReaderPageIndex(prev => prev - 1);
            window.scrollTo(0, 0);
        }
    };

    return (
        // CONTENEDOR PRINCIPAL "RESET"
        // Fondo gris, bloqueamos estilos globales de alineación
        <div style={{ 
            minHeight: '100vh', 
            width: '100%',
            backgroundColor: '#f1f5f9', 
            padding: '40px 20px', 
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxSizing: 'border-box',
            position: 'absolute', // Truco para tapar la UI del editor si algo queda abajo
            top: 0,
            left: 0,
            zIndex: 9999,
            overflowY: 'auto'
        }}>
            
            {/* HEADER FLOTANTE SIMPLE */}
            <div style={{ maxWidth: '800px', margin: '0 auto 20px auto', display: 'flex', justifyContent: 'flex-end' }}>
                 <button 
                    onClick={() => setIsDarkMode(!isDarkMode)} 
                    style={{ background: 'white', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}
                 >
                    {isDarkMode ? <Sun size={18} color="#333"/> : <Moon size={18} color="#333"/>}
                </button>
            </div>

            {/* LA HOJA DE PAPEL (Igual a ExportEngine.ts) */}
            <div style={{ 
                maxWidth: '800px', 
                margin: '0 auto', 
                background: 'white', 
                padding: '50px', 
                borderRadius: '8px', 
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                color: '#1a202c'
            }}>
                
                {/* Título del Libro */}
                <h1 style={{ textAlign: 'center', color: '#2563eb', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', marginTop: 0 }}>
                    {project.meta.title}
                </h1>

                {/* AREA DE CONTENIDO (Target para MathJax) */}
                <div id="book-content-area" style={{ minHeight: '400px', marginTop: '30px' }}>
                    {!currentPage ? (
                        <div style={{ textAlign: 'center', padding: '50px', color: 'gray' }}>Cargando...</div>
                    ) : (
                        <div key={currentPage.id}>
                            {/* Títulos de Página */}
                            {currentPage.type === 'capitulo' && <h2 style={{ color: '#2563eb', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', fontSize:'1.8em' }}>{currentPage.title}</h2>}
                            {currentPage.type === 'seccion' && <h3 style={{ marginTop: '20px', fontSize: '1.5em', color:'#1e293b' }}>{currentPage.title}</h3>}
                            {currentPage.type === 'portada' && <h1 style={{ textAlign: 'center', fontSize: '3em', margin: '60px 0', color: '#2563eb' }}>{currentPage.title}</h1>}

                            {/* Bloques de Texto y Sims */}
                            <div style={{ lineHeight: '1.8', fontSize: '1.1rem', textAlign: 'justify' }}>
                                {currentPage.blocks.map(block => (
                                    <div key={block.id} style={{ margin: '20px 0' }}>
                                        {block.type === 'text' && (
                                            <div dangerouslySetInnerHTML={{ __html: block.content.replace(/\n/g, '<br/>') }} />
                                        )}
                                        
                                        {block.type === 'simulator' && (
                                            <div style={{ margin: '25px 0', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', background: '#f8fafc' }}>
                                                <SimulatorRenderer 
                                                    code={getSimulatorCode(block.simulatorId)} 
                                                    params={block.simConfig || {}} 
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* BOTONES DE NAVEGACIÓN */}
                {totalPages > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', borderTop: '1px solid #e2e8f0', paddingTop: '30px' }}>
                        <button 
                            onClick={handlePrev} 
                            disabled={readerPageIndex === 0}
                            style={{
                                background: readerPageIndex === 0 ? '#e2e8f0' : '#fff',
                                color: readerPageIndex === 0 ? '#94a3b8' : '#2563eb', 
                                border: '1px solid #cbd5e1', 
                                padding: '10px 25px', 
                                borderRadius: '6px', 
                                cursor: readerPageIndex === 0 ? 'not-allowed' : 'pointer', 
                                fontWeight: 'bold'
                            }}
                        >
                            ← Anterior
                        </button>

                        <span style={{ alignSelf: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                            Página {readerPageIndex + 1} de {totalPages}
                        </span>

                        <button 
                            onClick={handleNext} 
                            disabled={readerPageIndex === totalPages - 1}
                            style={{
                                background: readerPageIndex === totalPages - 1 ? '#e2e8f0' : '#2563eb',
                                color: readerPageIndex === totalPages - 1 ? '#94a3b8' : 'white', 
                                border: 'none', 
                                padding: '10px 25px', 
                                borderRadius: '6px', 
                                cursor: readerPageIndex === totalPages - 1 ? 'not-allowed' : 'pointer', 
                                fontWeight: 'bold'
                            }}
                        >
                            Siguiente →
                        </button>
                    </div>
                )}
            </div>
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
              // Fusion de listas de simuladores (locales + nube)
              const allSims = [...cloudSimulators];
              return (
              <PageEditor 
                page={activePage}
                availableSimulators={allSims}
                onUpdatePage={handleUpdatePage}
              />);
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