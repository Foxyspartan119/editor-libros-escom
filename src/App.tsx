import React, { useState, useEffect } from 'react'
import type { BookProject, Page, SimulatorAsset, NodeType, ContentBlock } from './types'
import './editor_libro.css';
import { PageEditor } from './components/PageEditor';
import { SimulatorUploader } from './components/SimulatorUploader';
// Iconos
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
  meta: { title: "Libro Interactivo", author: "Profe", created: Date.now(), theme: 'light' },
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
  
  // ESTADOS DE PROCESO
  const [isSyncing, setIsSyncing] = useState(false); 

  // Memoria para la nube
  const [cloudSimulators, setCloudSimulators] = useState<SimulatorAsset[]>([]);

  // --- 1. EFECTO DE INICIO (CONECTAR A NUBE) ---
  useEffect(() => {
    // Escuchar cambios en la nube (Firebase)
    const unsubscribe = onSnapshot(doc(db, "projects", CLOUD_BOOK_ID), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as BookProject;
            console.log("☁️ Sincronizado desde la nube");
            setProject(data);
        } else {
             console.log("Listo para crear el primer libro en la nube.");
        }
    });

    return () => unsubscribe();
  }, []);

  // --- 2. ESCUCHAR SIMULADORES ---
  useEffect(() => {
    const q = query(collection(db, "simuladores")); 
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sims = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SimulatorAsset[];

      setCloudSimulators(sims); 
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
    setIsSyncing(true);
    try {
        await setDoc(doc(db, "projects", CLOUD_BOOK_ID), project);
        alert("✅ ¡Publicado! Todos los cambios están en la nube.");
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
  const saveProjectJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", project.meta.title + "_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

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
                alert("Proyecto cargado. Dale a 'PUBLICAR' para subirlo a la nube.");
                return;
            }

            // CASO B: Proyecto Legacy (Tus compañeros)
            if (Array.isArray(json)) {
                console.log("Detectado formato Legacy. Convirtiendo...");
                // --- LÓGICA DE CONVERSIÓN QUE FALTABA ---
                const convertedPages: Page[] = json.map((legacyPage: any) => {
                    const blocks: ContentBlock[] = []; // <--- USO EXPLÍCITO DE ContentBlock
                    const contentStr = legacyPage.contenido || "";
                    
                    // Regex para encontrar [simulador:id]
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

                        // 2. El simulador
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
                    
                    // 3. Texto final
                    const remainingText = contentStr.slice(lastIndex).trim();
                    if (remainingText) {
                        blocks.push({ 
                            id: crypto.randomUUID(), 
                            type: 'text', 
                            content: remainingText 
                        });
                    }

                    // Determinar tipo de página
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

                // Crear el proyecto convertido
                const newProject: BookProject = {
                    meta: { title: "Libro Importado (Legacy)", author: "Usuario", created: Date.now(), theme: 'light' },
                    assets: { simulators: [] },
                    pages: convertedPages
                };

                setProject(newProject);
                setActivePageId(convertedPages[0]?.id || null);
                alert("✅ Archivo antiguo convertido correctamente. Revisa y dale a PUBLICAR.");
            } else {
                alert("Formato no reconocido.");
            }

        } catch (error) {
            console.error(error);
            alert("Error al leer el archivo JSON.");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
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

  const handleMovePage = (pageId: string, direction: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation(); 
    const index = project.pages.findIndex(p => p.id === pageId);
    if (index < 0) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= project.pages.length) return;
    const newPages = [...project.pages];
    [newPages[index], newPages[targetIndex]] = [newPages[targetIndex], newPages[index]]; 
    setProject(prev => ({ ...prev, pages: newPages }));
  };

  const handleDeletePage = (pageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("⚠️ ¿Eliminar página?")) return;
    setProject(prev => ({ ...prev, pages: prev.pages.filter(p => p.id !== pageId) }));
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
    // Guardamos localmente para vista inmediata, pero lo ideal es subirlo a la nube
    // Aquí actualizamos el estado local por si acaso
    setProject(prev => ({
        ...prev,
        assets: { ...prev.assets, simulators: [...prev.assets.simulators, newSim] }
    }));
  };

  const handleExportHTML = () => {
      // ESTRATEGIA DE SEGURIDAD PARA SIMULADORES:
      // 1. Tomamos los simuladores que están en el proyecto actual (memoria local)
      const localSims = project.assets.simulators || [];
      
      // 2. Tomamos los de la nube (si existen y se cargaron)
      const cloudSims = cloudSimulators || [];

      // 3. Los combinamos evitando duplicados (priorizando la versión más reciente o local)
      // Creamos un mapa por ID
      const mergedSimsMap = new Map();
      
      // Primero agregamos los de la nube
      cloudSims.forEach(sim => mergedSimsMap.set(sim.id, sim));
      
      // Luego sobreescribimos con los locales (que podrían ser más recientes si acabas de editar)
      localSims.forEach(sim => mergedSimsMap.set(sim.id, sim));

      const finalSimulatorsList = Array.from(mergedSimsMap.values());

      if (finalSimulatorsList.length === 0) {
          alert("⚠️ Advertencia: No se encontraron simuladores para exportar. Asegúrate de haber guardado al menos uno.");
      }

      // Creamos el objeto final para exportar
      const projectToExport = { 
          ...project, 
          assets: { 
              simulators: finalSimulatorsList 
          } 
      };

      try {
          const htmlContent = generateBookHTML(projectToExport);
          const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); 
          a.href = url; 
          a.download = `${project.meta.title.replace(/\s+/g,'_')}_completo.html`;
          document.body.appendChild(a); 
          a.click(); 
          document.body.removeChild(a); 
          URL.revokeObjectURL(url);
      } catch (error) {
          console.error("Error exportando:", error);
          alert("Hubo un error al generar el archivo HTML. Revisa la consola.");
      }
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
  // RENDER PRINCIPAL (SOLO EDITOR)
  // ==========================================
  return (
    <div className="app-container">
      <header>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <h1>{project.meta.title}</h1>
            <span style={{fontSize:'0.7em', background:'var(--brand-primary)', color:'white', padding:'2px 6px', borderRadius:'4px'}}>EDITOR MAESTRO</span>
        </div>
        <div className="header-sep"></div>

        <a href="ayuda.html" target="_blank" className="button-link" title="Ver Ayuda">
            <HelpCircle size={18} style={{marginRight:5}}/> Ayuda
        </a>

        <button className="icon-button" onClick={() => setIsDarkMode(!isDarkMode)}>
            {isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
        </button>
        <button className="icon-button" onClick={handleUndo} disabled={history.length === 0} title="Deshacer">
            <Undo size={18}/>
        </button>

        <div className="header-sep"></div>

        <div className="local-actions-group">
             <label className="icon-button" title="Importar JSON viejo">
                <FolderOpen size={18}/>
                <input type="file" accept=".json" onChange={loadProjectJSON} style={{display:'none'}}/>
            </label>
            <button className="icon-button" onClick={saveProjectJSON} title="Guardar Respaldo Local (JSON)"><Save size={18}/></button>
        </div>

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
                <span className="page-title-span" title={page.title}>{page.title || "Sin título"}</span>
                <div className="page-actions">
                    <button className="mini-btn" onClick={(e) => handleMovePage(page.id, -1, e)} disabled={index === 0}><ArrowUp size={14}/></button>
                    <button className="mini-btn" onClick={(e) => handleMovePage(page.id, 1, e)} disabled={index === project.pages.length - 1}><ArrowDown size={14}/></button>
                    <button className="mini-btn danger" onClick={(e) => handleDeletePage(page.id, e)}><Trash2 size={14}/></button>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <main className="main">
          {activePageId ? (
            (() => {
              const activePage = project.pages.find(p => p.id === activePageId);
              if (!activePage) return <p>Error cargando página</p>;
              return (
              <PageEditor 
                page={activePage}
                availableSimulators={cloudSimulators} 
                onUpdatePage={handleUpdatePage}
              />);
            })()
          ) : <div className="empty-state"><p>Selecciona una página para editar.</p></div>}
        </main>
      </div>

      <SimulatorUploader isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} onSave={handleSaveSimulator} />
    </div>
  );
}

export default App;