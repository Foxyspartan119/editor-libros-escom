import type { BookProject } from "../types";

export function generateBookHTML(project: BookProject): string {
  // 1. CSS Integrado (Versión limpia)
  const styles = `
    :root { --bg-primary: #ffffff; --text-primary: #1a202c; --brand-primary: #2563eb; --bg-secondary: #f8fafc; --border-color: #e2e8f0; }
    body { font-family: system-ui, sans-serif; line-height: 1.6; color: var(--text-primary); margin: 0; background: #f1f5f9; }
    .book-container { max-width: 800px; margin: 40px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    h1, h2 { color: var(--brand-primary); border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; }
    .nav-buttons { display: flex; justify-content: space-between; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    button { background: var(--brand-primary); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
    button:disabled { background: #cbd5e1; cursor: not-allowed; }
    .simulador-wrapper { margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f8fafc; }
    .btn-sim { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top:5px; }
    /* Tus clases para grids y tablas */
    .stem-leaf-grid { display: grid; grid-template-columns: auto 1fr; gap: 0; font-family: 'Courier New', monospace; border: 1px solid #ccc; max-width: 300px; margin: 10px 0; }
    .stem { background: #eee; padding: 5px; text-align: right; border-right: 2px solid #333; font-weight: bold; }
    .leaf { padding: 5px; letter-spacing: 3px; }
  `;

  const projectDataScript = `window.BOOK_DATA = ${JSON.stringify(project)};`;

  // 3. Script del Lector (Modificado para cargar simuladores sin 'import')
  const readerScript = `
    document.addEventListener('DOMContentLoaded', () => {
        const data = window.BOOK_DATA;
        const container = document.getElementById('book-content');
        const prevBtn = document.getElementById('btn-prev');
        const nextBtn = document.getElementById('btn-next');
        const pageNum = document.getElementById('page-num');
        
        let currentPageIdx = 0;

        // --- MOTOR DE SIMULADORES OFFLINE ---
        // Transformamos el código 'export default' en una función ejecutable
        const simulators = {};
        data.assets.simulators.forEach(sim => {
            // Truco: Reemplazamos 'export default' por 'return' y lo envolvemos en una función
            // Esto permite ejecutar el código como texto plano sin necesitar módulos
            let cleanCode = sim.code.replace('export default', 'return');
            try {
                // Creamos una fábrica de simuladores
                const simFactory = new Function(cleanCode);
                simulators[sim.id] = simFactory(); 
            } catch (e) {
                console.error("Error compilando simulador " + sim.name, e);
                simulators[sim.id] = { init: (c) => c.innerHTML = '<p style="color:red">Error en código de simulador</p>' };
            }
        });

        function renderBlock(block) {
            if (block.type === 'text') {
                const div = document.createElement('div');
                div.innerHTML = block.content.replace(/\\n/g, '<br>'); 
                return div;
            }
            if (block.type === 'simulator') {
                const wrapper = document.createElement('div');
                wrapper.className = 'simulador-wrapper';
                
                // Buscamos el simulador por ID (manejando legacy si es necesario)
                const simId = block.simulatorId || block.simulatorId?.replace('legacy_', '');
                const simModule = simulators[simId];
                
                if (!simModule) {
                    wrapper.innerHTML = '<p style="color:red; background:#fee;">⚠️ Simulador no encontrado en el archivo (' + simId + ')</p>';
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
            const page = data.pages[index];
            
            const title = document.createElement('h2');
            title.textContent = page.title;
            container.appendChild(title);

            page.blocks.forEach(block => {
                container.appendChild(renderBlock(block));
            });

            pageNum.textContent = \`Página \${index + 1} de \${data.pages.length}\`;
            prevBtn.disabled = index === 0;
            nextBtn.disabled = index === data.pages.length - 1;
            
            if (window.MathJax) {
                // Reiniciamos MathJax para el nuevo contenido
                setTimeout(() => window.MathJax.typesetPromise([container]), 50);
            }
        }

        prevBtn.onclick = () => { if(currentPageIdx > 0) showPage(--currentPageIdx); };
        nextBtn.onclick = () => { if(currentPageIdx < data.pages.length - 1) showPage(++currentPageIdx); };

        showPage(0);
    });
  `;

  // 4. Construcción del HTML Final
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