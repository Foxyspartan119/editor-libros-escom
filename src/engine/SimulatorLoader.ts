// src/engine/SimulatorLoader.ts

/**
 * Interfaz Híbrida: Soporta tanto el formato Nuevo como el Legacy.
 */
export interface SimulatorModule {
  // Metadata es opcional porque el formato viejo no la trae
  meta?: {
    id: string;
    name: string;
    version?: string;
    inputs?: Array<any>;
  };
  
  // FORMATO NUEVO (Recomendado): Manipulación directa del DOM
  init?: (container: HTMLElement, params: Record<string, any>) => void;
  update?: (container: HTMLElement, params: Record<string, any>) => void;
  destroy?: (container: HTMLElement) => void;

  // FORMATO LEGACY (Tus compañeros): Devuelve HTML string + Script
  render?: (params: Record<string, any>, simName?: string) => string;
}

export async function loadSimulatorFromCode(jsCode: string): Promise<SimulatorModule> {
  const blob = new Blob([jsCode], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);

  try {
    /* @vite-ignore */
    const module = await import(/* @vite-ignore */ url);
    const sim = module.default;

    // VALIDACIÓN HÍBRIDA
    const esFormatoNuevo = typeof sim?.init === 'function';
    const esFormatoViejo = typeof sim?.render === 'function';

    if (!esFormatoNuevo && !esFormatoViejo) {
      throw new Error("El archivo no es válido. Debe exportar 'init' (nuevo) o 'render' (formato compañeros).");
    }

    // Si es formato viejo y no trae meta, le inventamos una básica para que no falle React
    if (esFormatoViejo && !sim.meta) {
      sim.meta = {
        id: 'legacy_' + Date.now(),
        name: 'Simulador Importado', // Se sobreescribirá con el nombre del archivo al subir
        version: '0.0.0',
        inputs: []
      };
    }

    return sim as SimulatorModule;
  } catch (error) {
    console.error("Error cargando simulador:", error);
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}