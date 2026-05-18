import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Task, TaskRequest } from '../models/task.model';

export interface ImportResult {
  imported: number;
  skipped: number;
  warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private http = inject(HttpClient);
  private base = 'http://10.51.9.17:8081/api/tasks';

  getAll(filters?: { projectIds?: number[]; statuses?: string[]; priorities?: string[]; assigneeIds?: number[] }): Observable<Task[]> {
    let params = new HttpParams().set('_t', Date.now().toString());
    filters?.projectIds?.forEach(id => params = params.append('projectId', String(id)));
    filters?.statuses?.forEach(s  => params = params.append('status', s));
    filters?.priorities?.forEach(p => params = params.append('priority', p));
    filters?.assigneeIds?.forEach(id => params = params.append('assigneeId', String(id)));
    return this.http.get<Task[]>(this.base, { params });
  }

  getById(id: number): Observable<Task> {
    return this.http.get<Task>(`${this.base}/${id}`);
  }

  create(req: TaskRequest): Observable<Task> {
    return this.http.post<Task>(this.base, req);
  }

  update(id: number, req: TaskRequest): Observable<Task> {
    return this.http.put<Task>(`${this.base}/${id}`, req);
  }

  updateStatus(id: number, status: string): Observable<Task> {
    return this.http.patch<Task>(`${this.base}/${id}/status`, { status });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  deleteAll(): Observable<void> {
    return this.http.delete<void>(this.base);
  }

  importExcel(file: File): Observable<ImportResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportResult>(`${this.base}/import`, form);
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(`${this.base}/import/template`, { responseType: 'blob' });
  }

  exportExcel(): Observable<Blob> {
    return this.http.get(`${this.base}/export`, { responseType: 'blob' });
  }
}
