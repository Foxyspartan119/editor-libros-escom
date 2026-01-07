import React, { useEffect, useRef, useState } from 'react';
import { loadSimulatorFromCode, type SimulatorModule } from '../engine/SimulatorLoader';

interface SimulatorRendererProps {
    code: string;
    params: Record<string, any>;
}

export const SimulatorRenderer: React.FC<SimulatorRendererProps> = ({ code, params }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [module, setModule] = useState<SimulatorModule | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    // 1. Cargar el módulo
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                setError(null);
                const simModule = await loadSimulatorFromCode(code);
                if (mounted) setModule(simModule);
            } catch (err: any) {
                if (mounted) setError(err.message);
            }
        };
        load();
        return () => { mounted = false; };
    }, [code]);

    // 2. Ejecutar (Soporte Híbrido)
    useEffect(() => {
        if (!module || !containerRef.current || !isVisible) return;
        
        const container = containerRef.current;
        container.innerHTML = ''; // Limpiar previo

        try {
            // --- OPCIÓN A: FORMATO NUEVO (INIT) ---
            if (module.init) {
                module.init(container, params);
                if (module.update) module.update(container, params);
            } 
            
            // --- OPCIÓN B: FORMATO COMPAÑEROS (RENDER) ---
            else if (module.render) {
                // Obtenemos el string gigante
                const simName = module.meta?.name || "Simulador";
                const htmlAndScript = module.render(params, simName);
                
                // Magia Regex para separar <script> del HTML
                const scriptRegex = /<script>([\s\S]*?)<\/script>/;
                const match = htmlAndScript.match(scriptRegex);
                const htmlOnly = htmlAndScript.replace(scriptRegex, '');
                const scriptContent = match ? match[1] : null;

                // 1. Inyectar HTML
                container.innerHTML = htmlOnly;

                // 2. Inyectar y Ejecutar Script
                if (scriptContent) {
                    const scriptEl = document.createElement('script');
                    scriptEl.textContent = scriptContent;
                    document.body.appendChild(scriptEl); // Ejecutar globalmente
                    
                    // Limpieza inmediata del tag script (ya se ejecutó en memoria)
                    setTimeout(() => scriptEl.remove(), 10);
                }
            }
        } catch (err: any) {
            console.error("Error ejecución:", err);
            container.innerHTML = `<div class="feedback-incorrect">Error: ${err.message}</div>`;
        }

        return () => {
            // Cleanup
            if (module.destroy) module.destroy(container);
            container.innerHTML = ''; 
        };
    }, [module, params, isVisible]);

    if (error) return <div className="feedback-incorrect">Error: {error}</div>;
    if (!module) return <div className="loading">Cargando...</div>;

    // Usamos el nombre del meta o un genérico
    const title = module.meta?.name || "Simulador";

    return (
        <div className="my-4">
            <button
                className={`btn-sim ${isVisible ? 'btn-sim-rojo' : ''}`}
                onClick={() => setIsVisible(!isVisible)}
            >
                {isVisible ? `Ocultar ${title}` : `Abrir ${title}`}
            </button>

            {isVisible && (
                <div className="simulador-box fade-in">
                    <div ref={containerRef} style={{ minHeight: '50px' }}/>
                    <div className="text-muted text-sm mt-2" style={{ fontSize: '0.8em', fontStyle: 'italic' }}>
                       Formato: {module.init ? "Nativo V2" : "Legacy V1"}
                    </div>
                </div>
            )}
        </div>
    );
};