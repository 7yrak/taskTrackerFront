import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Stats } from '../models/stats.model';

@Injectable({ providedIn: 'root' })
export class StatsService {
  private http = inject(HttpClient);

  getStats(): Observable<Stats> {
    return this.http.get<Stats>('http://10.51.9.17:8081/api/stats', {
      params: { _t: Date.now().toString() }
    });
  }
}
