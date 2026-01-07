// src/types.ts

// Definicion de simulador
export interface SimulatorAsset {
    id: string;
    name: string;
    code: string;
    version: string;
    timestamp: number;
}

// Bloques de Contenido de una pagina
export type BlockType = 'text' | 'image' | 'simulator' | 'latex';

export interface ContentBlock {
    id: string;
    type: BlockType;
    content: string;

    // Si es un simulador, usamos estas propiedades opcionales
    simulatorId?: string;
    simConfig?: Record<string, any>;
}

export type NodeType = 'portada' | 'capitulo' | 'seccion' | 'subseccion';

// Estructura de página y libro
export interface Page {
    id: string;
    type: NodeType;
    title: string;
    blocks: ContentBlock[];
}

export interface BookProject {
    meta: {
        title: string;
        author: string;
        created: number;
        theme: 'light' | 'dark';
    };
    assets: {
        simulators: SimulatorAsset[];
    };
    pages: Page[];
}