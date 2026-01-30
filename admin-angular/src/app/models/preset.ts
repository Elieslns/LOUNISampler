import { Sample } from './sample';

export interface Preset {
    _id?: string;
    name: string;
    category: string;
    bpm: number;
    samples: Sample[];
    fx?: {
        reverbAmount: number;
        delayAmount: number;
    };
    createdAt?: Date;
}
