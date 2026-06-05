import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Stats } from '../models/stats.model';
import { API_BASE_URL } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class StatsService {
  private http = inject(HttpClient);

  getStats(): Observable<Stats> {
    return this.http.get<Stats>(`${API_BASE_URL}/stats`, {
      params: { _t: Date.now().toString() }
    });
  }
}
