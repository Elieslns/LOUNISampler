import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

export interface Sample {
    _id?: string;
    name: string;
    category: string;
    filename?: string;
    path?: string;
    url?: string;
    duration?: number;
    createdAt?: string;
}

@Injectable({
    providedIn: 'root',
})
export class SampleService {
    private apiUrl = `${API_URL}/api/samples`;

    constructor(private http: HttpClient) { }

    getAll(category?: string): Observable<{ success: boolean, count: number, data: Sample[] }> {
        const params: any = {};
        if (category) params.category = category;
        return this.http.get<{ success: boolean, count: number, data: Sample[] }>(this.apiUrl, { params });
    }

    upload(file: File, category: string, name?: string): Observable<{ success: boolean, data: Sample }> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        if (name) formData.append('name', name);
        return this.http.post<{ success: boolean, data: Sample }>(this.apiUrl, formData);
    }

    addUrl(url: string, category: string, name?: string): Observable<{ success: boolean, data: Sample }> {
        return this.http.post<{ success: boolean, data: Sample }>(`${this.apiUrl}/url`, { url, category, name });
    }

    delete(id: string): Observable<{ success: boolean, message: string }> {
        return this.http.delete<{ success: boolean, message: string }>(`${this.apiUrl}/${id}`);
    }
}
