import { Injectable, effect, signal } from '@angular/core';

export type PersistedSortState = { active: string; direction: 'asc' | 'desc' | '' };

interface SavedTaskFilters {
  filterProject: number[];
  filterStatus: string[];
  filterPriority: string[];
  filterAssignee: number[];
  viewMode?: 'table' | 'kanban';
  sortState?: PersistedSortState[];
}

@Injectable({ providedIn: 'root' })
export class TaskFilterService {
  readonly filterProject  = signal<number[]>(this.load('filterProject', []));
  readonly filterStatus    = signal<string[]>(this.load('filterStatus', ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'STOPPED']));
  readonly filterPriority  = signal<string[]>(this.load('filterPriority', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']));
  readonly filterAssignee  = signal<number[]>(this.load('filterAssignee', []));

  projectsInitialized = false;
  membersInitialized  = false;

  constructor() {
    effect(() => {
      this.writeJson('tasks.filterProject', this.filterProject());
    });
    effect(() => {
      this.writeJson('tasks.filterStatus', this.filterStatus());
    });
    effect(() => {
      this.writeJson('tasks.filterPriority', this.filterPriority());
    });
    effect(() => {
      this.writeJson('tasks.filterAssignee', this.filterAssignee());
    });
  }

  loadViewMode(defaultValue: 'table' | 'kanban' = 'table'): 'table' | 'kanban' {
    const saved = this.readStorage('tasks.viewMode');
    return saved === 'kanban' ? 'kanban' : defaultValue;
  }

  saveViewMode(viewMode: 'table' | 'kanban'): void {
    this.writeStorage('tasks.viewMode', viewMode);
  }

  loadSavedViews(): TaskViewPreset[] {
    return this.readJson<TaskViewPreset[]>('tasks.savedViews') ?? [];
  }

  saveSavedViews(views: TaskViewPreset[]): void {
    this.writeJson('tasks.savedViews', views);
  }

  loadSortState(defaultValue: PersistedSortState[] = [{ active: 'startDate', direction: 'asc' }]): PersistedSortState[] {
    return this.readJson('tasks.sortState') ?? defaultValue;
  }

  saveSortState(sortState: PersistedSortState[]): void {
    this.writeJson('tasks.sortState', sortState);
  }

  private load<T>(key: keyof Pick<SavedTaskFilters, 'filterProject' | 'filterStatus' | 'filterPriority' | 'filterAssignee'>, fallback: T): T {
    return this.readJson<T>(`tasks.${String(key)}`) ?? fallback;
  }

  private readStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignorar errores de almacenamiento en entornos restringidos.
    }
  }

  private readJson<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : null;
    } catch {
      return null;
    }
  }

  private writeJson(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignorar errores de almacenamiento en entornos restringidos.
    }
  }
}

export interface TaskViewPreset {
  id: string;
  name: string;
  filterProject: number[];
  filterStatus: string[];
  filterPriority: string[];
  filterAssignee: number[];
  viewMode: 'table' | 'kanban';
  sortState: PersistedSortState[];
}
