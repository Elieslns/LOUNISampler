import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Preset } from '../models/preset';
import { API_URL } from '../config/api.config';

@Injectable({
  providedIn: 'root',
})
export class PresetService {
  private apiUrl = `${API_URL}/api/presets`;

  constructor(private http: HttpClient) { }

  getAll(): Observable<{ success: boolean, data: Preset[], count: number }> {
    return this.http.get<{ success: boolean, data: Preset[], count: number }>(this.apiUrl);
  }

  getOne(id: string): Observable<{ success: boolean, data: Preset }> {
    return this.http.get<{ success: boolean, data: Preset }>(`${this.apiUrl}/${id}`);
  }

  create(formData: FormData): Observable<{ success: boolean, data: Preset }> {
    return this.http.post<{ success: boolean, data: Preset }>(this.apiUrl, formData);
  }

  createFromJson(preset: Partial<Preset>): Observable<{ success: boolean, data: Preset }> {
    return this.http.post<{ success: boolean, data: Preset }>(`${this.apiUrl}/json`, preset);
  }

  update(id: string, data: Partial<Preset> | FormData): Observable<{ success: boolean, data: Preset }> {
    return this.http.put<{ success: boolean, data: Preset }>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: string): Observable<{ success: boolean, message: string }> {
    return this.http.delete<{ success: boolean, message: string }>(`${this.apiUrl}/${id}`);
  }
}
