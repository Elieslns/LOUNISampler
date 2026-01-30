import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface SequencerPreset {
    _id: string;
    name: string;
    sequences: any[];
    bpm: number;
    createdAt: string;
}

@Injectable({
    providedIn: 'root'
})
export class SequencerPresetService {
    private apiUrl = `${API_URL}/api/sequencer-presets`;

    constructor(private http: HttpClient) { }

    getPresets(): Observable<{ success: boolean; data: SequencerPreset[] }> {
        return this.http.get<{ success: boolean; data: SequencerPreset[] }>(this.apiUrl);
    }

    deletePreset(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/${id}`);
    }
}
