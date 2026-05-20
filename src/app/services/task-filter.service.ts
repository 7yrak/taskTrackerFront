import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TaskFilterService {
  readonly filterProject  = signal<number[]>([]);
  readonly filterStatus   = signal<string[]>(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'STOPPED']); // 'STOPPED' añadido aquí
  readonly filterPriority = signal<string[]>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
  readonly filterAssignee = signal<number[]>([]);

  projectsInitialized = false;
  membersInitialized  = false;
}
