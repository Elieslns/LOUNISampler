import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api.config';

@Injectable({
  providedIn: 'root',
})
export class FreesoundService {
  private apiUrl = `${API_URL}/api/freesound`;

  constructor(private http: HttpClient) { }

  search(query: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/search`, { params: { query } });
  }

  getDetails(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/sound/${id}`);
  }
}
