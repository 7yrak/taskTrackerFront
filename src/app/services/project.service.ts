import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Project, ProjectRequest } from '../models/project.model';
import { API_BASE_URL } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private http = inject(HttpClient);
  private base = `${API_BASE_URL}/projects`;

  getAll(): Observable<Project[]> {
    return this.http.get<Project[]>(this.base);
  }

  getById(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.base}/${id}`);
  }

  create(req: ProjectRequest): Observable<Project> {
    return this.http.post<Project>(this.base, req);
  }

  update(id: number, req: ProjectRequest): Observable<Project> {
    return this.http.put<Project>(`${this.base}/${id}`, req);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  addMember(projectId: number, memberId: number): Observable<Project> {
    return this.http.post<Project>(`${this.base}/${projectId}/members/${memberId}`, {});
  }

  removeMember(projectId: number, memberId: number): Observable<Project> {
    return this.http.delete<Project>(`${this.base}/${projectId}/members/${memberId}`);
  }
}
