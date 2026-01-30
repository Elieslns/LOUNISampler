export interface Sample {
    padIndex: number;
    filename?: string;
    url?: string; // Legacy support
    label: string;
    playbackRate: number;
    volume: number;
    reverse: boolean;
    trimStart: number;
    trimEnd: number;
    sequence?: boolean[];
}
