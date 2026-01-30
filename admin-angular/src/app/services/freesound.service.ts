import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FreesoundService {
  private apiUrl = '/api/freesound';

  constructor(private http: HttpClient) { }

  search(query: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/search`, { params: { query } });
  }

  getDetails(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/sound/${id}`);
  }
}
