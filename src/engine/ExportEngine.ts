import type { BookProject } from "../types";

export function generateBookHTML(project: BookProject): string {
  // 1. Estilos Base (Limpio y profesional)
  const styles = `
    :root { --bg-primary: #ffffff; --text-primary: #1a202c; --brand-primary: #2563eb; --bg-secondary: #f8fafc; --border-color: #e2e8f0; }
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: var(--text-primary); margin: 0; background: #f1f5f9; }
    .book-container { max-width: 800px; margin: 40px auto; background: white; padding: 50px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); min-height: 80vh; }
    h1, h2, h3 { color: var(--brand-primary); }
    h1 { text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 40px; }
    h2 { border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-top: 40px; }
    .nav-buttons { display: flex; justify-content: space-between; margin-top: 60px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    button { background: var(--brand-primary); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: opacity 0.2s; }
    button:hover { opacity: 0.9; }
    button:disabled { background: #cbd5e1; cursor: not-allowed; }
    
    /* Simuladores */
    .simulador-wrapper { margin: 30px 0; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; background: #f8fafc; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
    .btn-sim { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 5px; }
    .sim-input { padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
    
    /* Utilidades Visuales */
    .stat-card { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .sim-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 15px; }
  `;

  // 2. SANITIZACIÓN CRÍTICA DEL JSON
  // Esto evita que caracteres invisibles o scripts maliciosos rompan el libro
  const safeJson = JSON.stringify(project)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  const projectDataScript = `window.BOOK_DATA = ${safeJson};`;

  // 3. Script del Lector (Motor Offline)
  const readerScript = `
    document.addEventListener('DOMContentLoaded', () => {
        const data = window.BOOK_DATA;
        if (!data) { document.body.innerHTML = '<h1>Error: No se cargaron los datos del libro.</h1>'; return; }

        const container = document.getElementById('book-content');
        const prevBtn = document.getElementById('btn-prev');
        const nextBtn = document.getElementById('btn-next');
        const pageNum = document.getElementById('page-num');
        
        let currentPageIdx = 0;

        // --- MOTOR DE SIMULADORES ---
        const simulators = {};
        
        // Carga segura de simuladores
        if (data.assets && data.assets.simulators) {
            data.assets.simulators.forEach(sim => {
                // Convertir 'export default' a algo ejecutable
                let cleanCode = sim.code
                    .replace(/export\\s+default/, 'return')
                    .replace(/import\\s+.*?from.*?\\n/g, ''); // Quitar imports si los hubiera
                
                try {
                    const simFactory = new Function(cleanCode);
                    simulators[sim.id] = simFactory(); 
                } catch (e) {
                    console.error("Error compilando simulador " + sim.name, e);
                    simulators[sim.id] = { 
                        init: (c) => c.innerHTML = '<div style="color:red; padding:10px; border:1px solid red;">Error en código: ' + sim.name + '</div>' 
                    };
                }
            });
        }

        function renderBlock(block) {
            if (block.type === 'text') {
                const div = document.createElement('div');
                div.className = 'text-block';
                // Convertir saltos de línea a <br>
                div.innerHTML = block.content.replace(/\\n/g, '<br/>');
                return div;
            }
            
            if (block.type === 'simulator') {
                const wrapper = document.createElement('div');
                wrapper.className = 'simulador-wrapper';
                
                // Buscar simulador (Soporte para IDs legacy "legacy_xyz")
                const simId = block.simulatorId || '';
                const cleanId = simId.replace('legacy_', '');
                const simModule = simulators[simId] || simulators[cleanId];
                
                if (!simModule) {
                    wrapper.innerHTML = '<p style="color:#ef4444; background:#fee2e2; padding:10px; border-radius:4px;">⚠️ Simulador no encontrado en el archivo (' + simId + ')</p>';
                    return wrapper;
                }

                try {
                    const contentDiv = document.createElement('div');
                    wrapper.appendChild(contentDiv);
                    if (simModule.init) {
                        simModule.init(contentDiv, block.simConfig || {});
                    } else {
                        wrapper.innerHTML = 'El simulador no tiene función init()';
                    }
                } catch(err) {
                     wrapper.innerHTML = 'Error ejecutando simulador: ' + err.message;
                }

                return wrapper;
            }
            return document.createElement('div');
        }

        function showPage(index) {
            container.innerHTML = '';
            
            if (!data.pages || data.pages.length === 0) {
                container.innerHTML = '<p>El libro no tiene páginas.</p>';
                return;
            }

            const page = data.pages[index];
            
            // Título de la página
            const title = document.createElement('h2');
            title.textContent = page.title;
            container.appendChild(title);

            // Renderizar Bloques
            if (page.blocks) {
                page.blocks.forEach(block => {
                    container.appendChild(renderBlock(block));
                });
            }

            // Actualizar UI
            pageNum.textContent = \`Página \${index + 1} de \${data.pages.length}\`;
            prevBtn.disabled = index === 0;
            nextBtn.disabled = index === data.pages.length - 1;
            
            // Renderizar Matemáticas (MathJax)
            if (window.MathJax) {
                setTimeout(() => {
                    window.MathJax.typesetPromise([container]).catch(e => console.log('MathJax error', e));
                }, 50);
            }
            
            // Scroll arriba
            window.scrollTo(0,0);
        }

        prevBtn.onclick = () => { if(currentPageIdx > 0) showPage(--currentPageIdx); };
        nextBtn.onclick = () => { if(currentPageIdx < data.pages.length - 1) showPage(++currentPageIdx); };

        showPage(0);
    });
  `;

  // 4. HTML Final
  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.meta.title}</title>
    <style>${styles}</style>
    
    <script>
      window.MathJax = {
        tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']] },
        svg: { fontCache: 'global' }
      };
    </script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    
    <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
</head>
<body>
    <div class="book-container">
        <h1 style="text-align:center">${project.meta.title}</h1>
        <div id="book-content"></div>
        <div class="nav-buttons">
            <button id="btn-prev">Anterior</button>
            <span id="page-num" style="align-self:center; color:#64748b;">Página 1</span>
            <button id="btn-next">Siguiente</button>
        </div>
    </div>
    
    <script>${projectDataScript}</script>
    
    <script>${readerScript}</script>
</body>
</html>
  `;
}