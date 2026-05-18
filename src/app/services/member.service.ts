import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Member, MemberRequest } from '../models/member.model';

@Injectable({ providedIn: 'root' })
export class MemberService {
  private http = inject(HttpClient);
  private base = 'http://10.51.9.17:8081/api/members';

  getAll(): Observable<Member[]> {
    return this.http.get<Member[]>(this.base);
  }

  create(req: MemberRequest): Observable<Member> {
    return this.http.post<Member>(this.base, req);
  }

  update(id: number, req: MemberRequest): Observable<Member> {
    return this.http.put<Member>(`${this.base}/${id}`, req);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
