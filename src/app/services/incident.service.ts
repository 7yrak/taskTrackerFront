import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../config/api.config';
import { Incident, IncidentRequest } from '../models/incident.model';
@Injectable({ providedIn: 'root' })
export class IncidentService {
  private http = inject(HttpClient);
  private base = `${API_BASE_URL}/incidents`;
  all() {
    return this.http.get<Incident[]>(this.base);
  }
  get(id: number) {
    return this.http.get<Incident>(`${this.base}/${id}`);
  }
  create(request: IncidentRequest) {
    return this.http.post<Incident>(this.base, request);
  }
  update(id: number, request: IncidentRequest) {
    return this.http.put<Incident>(`${this.base}/${id}`, request);
  }
  transition(id: number, action: string, actor: string, observation: string, evidenceUrl: string) {
    return this.http.post<Incident>(`${this.base}/${id}/transitions`, {
      action,
      actor,
      observation,
      evidenceUrl,
    });
  }
  comment(id: number, author: string, text: string) {
    return this.http.post<Incident>(`${this.base}/${id}/comments`, { author, text });
  }
  upload(id: number, category: string, file: File) {
    const data = new FormData();
    data.append('category', category);
    data.append('file', file);
    return this.http.post<Incident>(`${this.base}/${id}/attachments`, data);
  }
  download(id: number, attachmentId: number) {
    return this.http.get(`${this.base}/${id}/attachments/${attachmentId}`, {
      responseType: 'blob',
    });
  }
}
