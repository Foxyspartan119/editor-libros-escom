import type { BookProject } from "../types";

export function generateBookHTML(project: BookProject): string {
  // 1. Extraemos el CSS (asumimos que está disponible o usamos uno base)
  // Para asegurar que se vea bien, inyectamos estilos críticos aquí.
  const styles = `
    :root { 
        --bg-primary: #ffffff; --text-primary: #1a202c; --brand-primary: #2563eb; 
        --bg-secondary: #f8fafc; --border-color: #e2e8f0;
    }
    body { font-family: system-ui, sans-serif; line-height: 1.6; color: var(--text-primary); margin: 0; background: #f1f5f9; }
    .book-container { max-width: 800px; margin: 40px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    h1, h2 { color: var(--brand-primary); border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; }
    .page-content { display: none; animation: fadeIn 0.3s ease; }
    .page-content.active { display: block; }
    .nav-buttons { display: flex; justify-content: space-between; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    button { background: var(--brand-primary); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
    button:disabled { background: #cbd5e1; cursor: not-allowed; }
    
    /* Estilos del Simulador (Copiados de tu CSS) */
    .simulador-wrapper { margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f8fafc; }
    .btn-sim { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; width: 100%; text-align: left; }
    .btn-sim-rojo { background: #dc2626; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `;

  // 2. Serializamos el proyecto completo dentro del HTML
  const projectDataScript = `window.BOOK_DATA = ${JSON.stringify(project)};`;

  // 3. El Script del Lector (Vanilla JS)
  // Este script correrá en el navegador del usuario final
  const readerScript = `
    document.addEventListener('DOMContentLoaded', () => {
        const data = window.BOOK_DATA;
        const container = document.getElementById('book-content');
        const prevBtn = document.getElementById('btn-prev');
        const nextBtn = document.getElementById('btn-next');
        const pageNum = document.getElementById('page-num');
        
        let currentPageIdx = 0;

        // --- MOTOR DE SIMULADORES (Versión Ligera) ---
        const simulators = {};
        data.assets.simulators.forEach(sim => {
            simulators[sim.id] = sim;
        });

        function renderBlock(block) {
            if (block.type === 'text') {
                const div = document.createElement('div');
                div.className = 'text-block';
                // Convertir saltos de línea y LaTeX básico
                div.innerHTML = block.content
                    .replace(/\\n/g, '<br>')
                    // Un hack simple para renderizar simuladores Legacy en texto si quedaron huerfanos
                    .replace(/\\[simulador:(.*?)\\]/g, ''); 
                return div;
            }
            if (block.type === 'simulator') {
                const wrapper = document.createElement('div');
                wrapper.className = 'simulador-wrapper';
                const simAsset = simulators[block.simulatorId || block.simulatorId?.replace('legacy_', '')];
                
                if (!simAsset) {
                    wrapper.innerHTML = '<p style="color:red">Simulador no encontrado: ' + block.simulatorId + '</p>';
                    return wrapper;
                }

                // Inyección del código JS
                // NOTA: Para exportación real, usamos Blob URL igual que en el editor
                const blob = new Blob([simAsset.code], { type: 'text/javascript' });
                const url = URL.createObjectURL(blob);

                import(url).then(module => {
                    const sim = module.default;
                    // Detectar formato (Igual que en tu editor)
                    if (sim.init) {
                        const container = document.createElement('div');
                        wrapper.appendChild(container);
                        sim.init(container, block.simConfig || {});
                    } else if (sim.render) {
                        // Legacy Support
                        const html = sim.render(block.simConfig || {}, simAsset.name);
                        const scriptRegex = /<script>([\\s\\S]*?)<\\/script>/;
                        const match = html.match(scriptRegex);
                        const htmlOnly = html.replace(scriptRegex, '');
                        
                        const div = document.createElement('div');
                        div.innerHTML = htmlOnly;
                        wrapper.appendChild(div);

                        if (match && match[1]) {
                            const script = document.createElement('script');
                            script.textContent = match[1];
                            document.body.appendChild(script);
                        }
                    }
                }).catch(err => {
                    wrapper.innerHTML = 'Error cargando simulador: ' + err.message;
                });

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

            // Actualizar controles
            pageNum.textContent = \`Página \${index + 1} de \${data.pages.length}\`;
            prevBtn.disabled = index === 0;
            nextBtn.disabled = index === data.pages.length - 1;
            
            // Renderizar Matemáticas (MathJax) si existe
            if (window.MathJax) {
                window.MathJax.typesetPromise([container]);
            }
        }

        // Event Listeners
        prevBtn.onclick = () => { if(currentPageIdx > 0) showPage(--currentPageIdx); };
        nextBtn.onclick = () => { if(currentPageIdx < data.pages.length - 1) showPage(++currentPageIdx); };

        // Iniciar
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
        tex: {
          // Aquí le decimos qué símbolos buscar para matemáticas
          inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], 
          displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
          processEscapes: true
        },
        svg: {
          fontCache: 'global'
        }
      };
    </script>
    
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
</head>
<body>
    <div class="book-container">
        <h1 style="text-align:center">${project.meta.title}</h1>
        <hr/>
        
        <div id="book-content">
            </div>

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