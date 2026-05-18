import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Reminder, ReminderComment } from '../models/reminder.model';

@Injectable({
  providedIn: 'root'
})
export class ReminderService {
  private apiUrl = 'http://10.51.9.17:8081/api/reminders';

  constructor(private http: HttpClient) {}

  getAllReminders(): Observable<Reminder[]> {
    return this.http.get<Reminder[]>(this.apiUrl);
  }

  getReminderById(id: number): Observable<Reminder> {
    return this.http.get<Reminder>(`${this.apiUrl}/${id}`);
  }

  createReminder(reminder: Reminder): Observable<Reminder> {
    return this.http.post<Reminder>(this.apiUrl, reminder);
  }

  updateReminder(id: number, reminder: Reminder): Observable<Reminder> {
    return this.http.put<Reminder>(`${this.apiUrl}/${id}`, reminder);
  }

  deleteReminder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  addComment(id: number, comment: ReminderComment): Observable<Reminder> {
    return this.http.post<Reminder>(`${this.apiUrl}/${id}/comments`, comment);
  }
}