import { Component, inject, signal, ViewChild, ElementRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { filter, startWith, switchMap, take } from 'rxjs/operators';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CdkDragDrop, moveItemInArray, transferArrayItem, CdkDropList, CdkDrag, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { jsPDF } from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';
import { TaskService, ImportResult } from '../../services/task.service';
import { TaskFilterService, TaskViewPreset, PersistedSortState } from '../../services/task-filter.service';
import { ProjectService } from '../../services/project.service';
import { MemberService } from '../../services/member.service';
import { Task, TaskNode, TaskStatus, STATUS_LABELS, PRIORITY_LABELS } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Member } from '../../models/member.model';
import { TaskDialogComponent } from '../shared/task-dialog/task-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';


@Component({
  selector: 'app-tasks',
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatSortModule,
    MatButtonModule, MatIconModule,
    MatDialogModule, MatSelectModule, MatFormFieldModule,
    MatSnackBarModule, MatTooltipModule, MatMenuModule, MatButtonToggleModule,
    CdkDropListGroup, CdkDropList, CdkDrag
  ],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss'
})
export class TasksComponent {
  @ViewChild('fileInput')  fileInputRef!: ElementRef<HTMLInputElement>;

  private taskService    = inject(TaskService);
  private filterService  = inject(TaskFilterService);
  private projectService = inject(ProjectService);
  private memberService  = inject(MemberService);
  private dialog         = inject(MatDialog);
  private snack          = inject(MatSnackBar);
  private destroyRef     = inject(DestroyRef);

  viewMode: 'table' | 'kanban' = this.filterService.loadViewMode('table');
  savedViews = signal<TaskViewPreset[]>(this.filterService.loadSavedViews());
  selectedViewId = signal<string>('');
  recentlyUpdatedTaskIds = signal<Set<number>>(new Set());
  kanbanColumns = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'STOPPED'] as TaskStatus[];
  kanbanTasks: Record<TaskStatus, TaskNode[]> = {
    TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [], BLOCKED: [], STOPPED: []
  };

  filterProject  = this.filterService.filterProject;
  filterStatus   = this.filterService.filterStatus;
  filterPriority = this.filterService.filterPriority;
  filterAssignee = this.filterService.filterAssignee;

  private refresh$ = new Subject<void>();
  private allTasks: Task[] = [];
  private rootNodes: TaskNode[] = [];

  dataSource = new MatTableDataSource<TaskNode>([]);
  taskCount  = signal(0);

  projects = toSignal(this.projectService.getAll(), { initialValue: [] as Project[] });
  members  = toSignal(this.memberService.getAll(),  { initialValue: [] as Member[]  });

  displayedColumns = ['title', 'project', 'assignee', 'status', 'priority', 'startDate', 'dueDate', 'progressActual', 'progressExpected', 'actions'];
  statusLabels: Record<string, string>   = STATUS_LABELS;
  priorityLabels: Record<string, string> = PRIORITY_LABELS;
  statuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'STOPPED'];
  sorts: Sort[] = this.filterService.loadSortState([{ active: 'startDate', direction: 'asc' }]);

  editingTitleId = signal<number | null>(null);

  constructor() {
    toObservable(this.projects).pipe(
      filter(p => p.length > 0), take(1), takeUntilDestroyed(this.destroyRef)
    ).subscribe(p => {
      if (!this.filterService.projectsInitialized) {
        this.filterService.projectsInitialized = true;
        this.filterProject.set(p.map(x => x.id));
      }
    });

    toObservable(this.members).pipe(
      filter(m => m.length > 0), take(1), takeUntilDestroyed(this.destroyRef)
    ).subscribe(m => {
      if (!this.filterService.membersInitialized) {
        this.filterService.membersInitialized = true;
        this.filterAssignee.set(m.map(x => x.id));
      }
    });

    // Always load all tasks — filtering is done client-side to preserve tree structure
    this.refresh$.pipe(
      startWith(undefined as void),
      switchMap(() => this.taskService.getAll()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(tasks => {
      this.allTasks = tasks;
      this.buildAndFilter();
    });
  }

  setViewMode(mode: 'table' | 'kanban') {
    this.viewMode = mode;
    this.filterService.saveViewMode(mode);
  }

  saveCurrentView() {
    const name = prompt('Nombre para la vista guardada:', `Vista ${new Date().toLocaleDateString('es-AR')}`);
    if (!name?.trim()) return;

    const preset: TaskViewPreset = {
      id: crypto.randomUUID(),
      name: name.trim(),
      filterProject: [...this.filterProject()],
      filterStatus: [...this.filterStatus()],
      filterPriority: [...this.filterPriority()],
      filterAssignee: [...this.filterAssignee()],
      viewMode: this.viewMode,
      sortState: this.sorts.map(s => ({ active: s.active, direction: s.direction as PersistedSortState['direction'] }))
    };

    this.savedViews.update(list => {
      const next = [preset, ...list].slice(0, 10);
      this.filterService.saveSavedViews(next);
      return next;
    });
    this.selectedViewId.set(preset.id);
    this.openInfoSnack(`Vista "${preset.name}" guardada`, 'success');
  }

  applySavedView(presetId: string) {
    const preset = this.savedViews().find(v => v.id === presetId);
    if (!preset) {
      this.selectedViewId.set('');
      return;
    }
    this.filterProject.set([...preset.filterProject]);
    this.filterStatus.set([...preset.filterStatus]);
    this.filterPriority.set([...preset.filterPriority]);
    this.filterAssignee.set([...preset.filterAssignee]);
    this.sorts = preset.sortState.map(s => ({ active: s.active, direction: s.direction }));
    this.viewMode = preset.viewMode;
    this.selectedViewId.set(presetId);
    this.filterService.saveViewMode(preset.viewMode);
    this.filterService.saveSortState(this.sorts.map(s => ({ active: s.active, direction: s.direction })));
    this.buildAndFilter();
    this.openInfoSnack(`Vista "${preset.name}" aplicada`, 'info');
  }

  deleteSavedView(presetId: string) {
    const next = this.savedViews().filter(v => v.id !== presetId);
    this.savedViews.set(next);
    this.filterService.saveSavedViews(next);
    if (this.selectedViewId() === presetId) {
      this.selectedViewId.set('');
    }
    this.openInfoSnack('Vista eliminada', 'warning');
  }

  private openInfoSnack(message: string, tone: 'success' | 'warning' | 'error' | 'info' = 'info') {
    this.snack.open(message, 'OK', {
      duration: 2500,
      panelClass: [`snack-${tone}`]
    });
  }

  private flashTaskUpdate(taskId: number) {
    this.recentlyUpdatedTaskIds.update(set => {
      const next = new Set(set);
      next.add(taskId);
      return next;
    });
    setTimeout(() => {
      this.recentlyUpdatedTaskIds.update(set => {
        const next = new Set(set);
        next.delete(taskId);
        return next;
      });
    }, 1600);
  }

  isRecentlyUpdated(taskId: number): boolean {
    return this.recentlyUpdatedTaskIds().has(taskId);
  }

  // ── Tree building ──────────────────────────────────────────────────────────

  private buildTree(tasks: Task[]): TaskNode[] {
    const map = new Map<number, TaskNode>();
    const roots: TaskNode[] = [];

    for (const task of tasks) {
      map.set(task.id, { ...task, level: 0, expanded: false, childrenNodes: [] });
    }

    for (const node of map.values()) {
      if (node.parentId != null && map.has(node.parentId)) {
        map.get(node.parentId)!.childrenNodes.push(node);
      } else {
        roots.push(node);
      }
    }

    const assignLevels = (nodes: TaskNode[], level: number) => {
      for (const n of nodes) { n.level = level; assignLevels(n.childrenNodes, level + 1); }
    };
    assignLevels(roots, 0);
    return roots;
  }

  private filterTree(nodes: TaskNode[]): TaskNode[] {
    const result: TaskNode[] = [];
    for (const node of nodes) {
      const filteredChildren = this.filterTree(node.childrenNodes);
      if (this.nodePassesFilter(node) || filteredChildren.length > 0) {
        result.push({ ...node, childrenNodes: filteredChildren });
      }
    }
    return result;
  }

  private nodePassesFilter(node: TaskNode): boolean {
    const fp = this.filterProject();
    const fs = this.filterStatus();
    const fpr = this.filterPriority();
    const fa = this.filterAssignee();

    // Si están seleccionados todos los proyectos/miembros, no filtramos por ese campo (mostrando también los no asignados)
    const allProjectsSelected = fp.length === 0 || fp.length === this.projects().length;
    const allAssigneesSelected = fa.length === 0 || fa.length === this.members().length;

    const projectOk  = allProjectsSelected || (node.projectId != null && fp.includes(node.projectId));
    const statusOk   = fs.length === 0 || fs.includes(node.status);
    const priorityOk = fpr.length === 0 || fpr.includes(node.priority);
    const assigneeOk = allAssigneesSelected ||
      (node.assigneeIds != null && node.assigneeIds.some(id => fa.includes(id)));

    return projectOk && statusOk && priorityOk && assigneeOk;
  }

  private flatten(nodes: TaskNode[]): TaskNode[] {
    const result: TaskNode[] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.expanded && node.childrenNodes.length > 0) {
        result.push(...this.flatten(node.childrenNodes));
      }
    }
    return result;
  }

  private countLeaves(nodes: TaskNode[]): number {
    let count = 0;
    for (const node of nodes) {
      if (!node.hasChildren) count++;
      if (node.childrenNodes.length > 0) count += this.countLeaves(node.childrenNodes);
    }
    return count;
  }

  private flattenAll(nodes: TaskNode[]): TaskNode[] {
    const result: TaskNode[] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.childrenNodes.length > 0) {
        result.push(...this.flattenAll(node.childrenNodes));
      }
    }
    return result;
  }

  buildAndFilter() {
    this.rootNodes = this.buildTree(this.allTasks);
    this.sortTree(this.rootNodes);
    const filtered = this.filterTree(this.rootNodes);
    const visible  = this.flatten(filtered);
    this.dataSource.data = visible;
    this.taskCount.set(this.countLeaves(filtered));

    this.kanbanTasks = { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [], BLOCKED: [], STOPPED: [] };
    const allFiltered = this.flattenAll(filtered);
    for (const task of allFiltered) {
      // Solo mostrar las tareas "hojas" en el Kanban (las que no tienen subtareas)
      if (!task.hasChildren) {
        this.kanbanTasks[task.status].push(task);
      }
    }
  }

  drop(event: CdkDragDrop<TaskNode[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );

      const task = event.container.data[event.currentIndex];
      const newStatus = event.container.id as TaskStatus;

      task.status = newStatus;
      this.taskService.update(task.id, { ...task, status: newStatus }).subscribe({
        next: () => {
          this.flashTaskUpdate(task.id);
          this.openInfoSnack('Estado actualizado', 'success');
          this.refresh$.next();
        },
        error: (e) => {
          this.openInfoSnack(e.error?.message || 'Error al actualizar', 'error');
          this.refresh$.next();
        },
      });
    }
  }

  handleSort(columnId: string, event: MouseEvent): void {
    const existingSort = this.sorts.find(s => s.active === columnId);

    if (event.shiftKey) {
      // ---- ORDENAMIENTO MÚLTIPLE (con Shift) ----
      if (existingSort) {
        // La columna ya está en el sort, ciclar dirección o quitarla
        if (existingSort.direction === 'asc') {
          existingSort.direction = 'desc';
        } else {
          // Si era 'desc', la quitamos del array
          this.sorts = this.sorts.filter(s => s.active !== columnId);
        }
      } else {
        // No estaba, la añadimos al final con dirección 'asc'
        this.sorts.push({ active: columnId, direction: 'asc' });
      }
    } else {
      // ---- ORDENAMIENTO SIMPLE (sin Shift) ----
      if (existingSort) {
        // Si es la única columna, invertimos dirección. Si no, la establecemos como única.
        const newDirection = this.sorts.length === 1 && existingSort.direction === 'asc' ? 'desc' : 'asc';
        this.sorts = [{ active: columnId, direction: newDirection }];
      } else {
        // Si no existía, se convierte en el único criterio
        this.sorts = [{ active: columnId, direction: 'asc' }];
      }
    }

    // Si el usuario quita todos los criterios, volvemos al orden por defecto
    if (this.sorts.length === 0) {
      this.sorts = [{ active: 'startDate', direction: 'asc' }];
    }

    this.filterService.saveSortState(this.sorts.map(s => ({ active: s.active, direction: s.direction })));
    this.buildAndFilter();
  }

  clearSorting(): void {
    this.sorts = [{ active: 'startDate', direction: 'asc' }];
    this.filterService.saveSortState(this.sorts);
    this.buildAndFilter();
  }

  private sortTree(nodes: TaskNode[]) {
    if (this.sorts.length === 0) return;

    nodes.sort((a, b) => {
      for (const sort of this.sorts) {
        const { active, direction } = sort;
        const multiplier = direction === 'asc' ? 1 : -1;
        const valueA = this.sortValue(a, active);
        const valueB = this.sortValue(b, active);
        const comparison = this.compareSortValues(valueA, valueB);
        if (comparison !== 0) {
          return comparison * multiplier;
        }
      }
      return 0;
    });

    for (const node of nodes) {
      this.sortTree(node.childrenNodes);
    }
  }

  private sortValue(node: TaskNode, column: string): string | number | null {
    switch (column) {
      case 'title': return node.title;
      case 'project': return node.projectName ?? '';
      case 'assignee': return node.assigneeNames?.join(', ') ?? '';
      case 'status': return this.statusLabels[node.status] ?? node.status;
      case 'priority': return this.priorityLabels[node.priority] ?? node.priority;
      case 'startDate': return this.dateSortValue(node.startDate);
      case 'dueDate': return this.dateSortValue(node.dueDate);
      case 'progressActual': return node.progressActual ?? 0;
      case 'progressExpected': return node.progressExpected ?? null;
      default: return '';
    }
  }

  private compareSortValues(a: string | number | null, b: string | number | null): number {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), 'es', { sensitivity: 'base', numeric: true });
  }

  private dateSortValue(value?: string): number | null {
    const date = this.parseLocalDate(value);
    return date ? date.getTime() : null;
  }

  // --- Funciones de ayuda para la UI del ordenamiento ---

  getSortDirection(columnId: string): 'asc' | 'desc' | '' {
    const sort = this.sorts.find(s => s.active === columnId);
    return sort ? sort.direction : '';
  }

  getSortOrder(columnId: string): number | null {
    if (this.sorts.length <= 1) {
      return null;
    }
    const index = this.sorts.findIndex(s => s.active === columnId);
    return index !== -1 ? index + 1 : null;
  }

  // ── Expand / collapse ──────────────────────────────────────────────────────

  toggleExpand(node: TaskNode) {
    // Find the node in the actual tree (not the filtered copy) and toggle
    const toggle = (nodes: TaskNode[]): boolean => {
      for (const n of nodes) {
        if (n.id === node.id) { n.expanded = !n.expanded; return true; }
        if (toggle(n.childrenNodes)) return true;
      }
      return false;
    };
    toggle(this.rootNodes);
    // Volvemos a filtrar y aplanar para mantener el filtro y recalcular hijos
    const filtered = this.filterTree(this.rootNodes);
    this.dataSource.data = this.flatten(filtered);
  }

  hasExpandableTasks(): boolean {
    return this.rootNodes.some(node => this.hasChildrenRecursive(node));
  }

  areAllExpanded(): boolean {
    const expandable = this.getExpandableNodes(this.rootNodes);
    return expandable.length > 0 && expandable.every(node => node.expanded);
  }

  toggleExpandAll() {
    const expand = !this.areAllExpanded();
    this.setExpandedRecursive(this.rootNodes, expand);
    const filtered = this.filterTree(this.rootNodes);
    this.dataSource.data = this.flatten(filtered);
  }

  private hasChildrenRecursive(node: TaskNode): boolean {
    return node.childrenNodes.length > 0 || node.childrenNodes.some(child => this.hasChildrenRecursive(child));
  }

  private getExpandableNodes(nodes: TaskNode[]): TaskNode[] {
    const result: TaskNode[] = [];
    for (const node of nodes) {
      if (node.childrenNodes.length > 0) result.push(node);
      result.push(...this.getExpandableNodes(node.childrenNodes));
    }
    return result;
  }

  private setExpandedRecursive(nodes: TaskNode[], expanded: boolean) {
    for (const node of nodes) {
      node.expanded = expanded;
      this.setExpandedRecursive(node.childrenNodes, expanded);
    }
  }

  // ── Filters ────────────────────────────────────────────────────────────────

  applyFilter() { this.buildAndFilter(); }

  clearFilters() {
    this.filterStatus.set(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'STOPPED']);
    this.filterPriority.set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    this.filterProject.set(this.projects().map(p => p.id));
    this.filterAssignee.set(this.members().map(m => m.id));
    this.buildAndFilter();
  }

  trackById(index: number, node: TaskNode): number {
    return node.id;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  openCreate(defaultParentId?: number) {
    this.dialog.open(TaskDialogComponent, {
      width: '1000px',
      maxWidth: '95vw',
      maxHeight: '95vh',
      data: { task: null, projects: this.projects(), members: this.members(),
              allTasks: this.allTasks, defaultParentId: defaultParentId ?? null }
    }).afterClosed().subscribe(result => {
      if (result) {
        this.taskService.create(result).subscribe({
          next:  () => { this.refresh$.next(); this.openInfoSnack('Tarea creada', 'success'); },
          error: (e) => this.openInfoSnack(e.error?.message || 'Error', 'error')
        });
      }
    });
  }

  openEdit(task: Task) {
    this.dialog.open(TaskDialogComponent, {
      width: '1000px',
      maxWidth: '95vw',
      maxHeight: '95vh',
      data: { task, projects: this.projects(), members: this.members(), allTasks: this.allTasks }
    }).afterClosed().subscribe(result => {
      if (result) {
        this.taskService.update(task.id, result).subscribe({
          next:  () => { this.refresh$.next(); this.flashTaskUpdate(task.id); this.openInfoSnack('Tarea actualizada', 'success'); },
          error: (e) => this.openInfoSnack(e.error?.message || 'Error', 'error')
        });
      }
    });
  }

  updateProgress(node: TaskNode, event: Event) {
    const input = event.target as HTMLInputElement;
    const newProgress = parseInt(input.value, 10);
    if (isNaN(newProgress)) {
      input.value = String(node.progressActual);
      return;
    }
    const progressActual = Math.max(0, Math.min(100, newProgress));
    if (node.progressActual === progressActual) {
      input.value = String(progressActual);
      return;
    }

    const startDateRaw = node.startDate ? this.parseLocalDate(node.startDate) : null;
    const dueDateRaw = node.dueDate ? this.parseLocalDate(node.dueDate) : null;

    const req: any = {
      title: node.title,
      description: node.description,
      status: node.status,
      priority: node.priority,
      projectId: node.projectId ?? undefined,
      assigneeIds: node.assigneeIds && node.assigneeIds.length > 0 ? node.assigneeIds : undefined,
      startDate: startDateRaw ? this.formatLocalDate(startDateRaw) : undefined,
      dueDate: dueDateRaw ? this.formatLocalDate(dueDateRaw) : undefined,
      progressActual: progressActual,
      parentId: node.parentId ?? undefined
    };

    this.taskService.update(node.id, req).subscribe({
      next:  () => { this.refresh$.next(); this.snack.open('Avance actualizado', 'OK', { duration: 2000 }); },
      error: (e) => {
        input.value = String(node.progressActual);
        this.snack.open(e.error?.message || 'Error al actualizar', 'OK', { duration: 3000 });
      }
    });
  }

  startEditingTitle(node: TaskNode, event: MouseEvent) {
    event.stopPropagation();
    this.editingTitleId.set(node.id);
    // Forzar foco en el input al siguiente ciclo del navegador
    setTimeout(() => {
      const input = document.getElementById(`title-input-${node.id}`) as HTMLInputElement;
      if (input) {
        input.focus();
        input.select(); // Selecciona todo el texto automáticamente
      }
    });
  }

  cancelTitleEdit() {
    this.editingTitleId.set(null);
  }

  updateTitle(node: TaskNode, event: Event) {
    const input = event.target as HTMLInputElement;
    const newTitle = input.value.trim();

    if (this.editingTitleId() !== node.id) return; // Prevenir guardados duplicados
    this.editingTitleId.set(null);

    if (!newTitle || newTitle === node.title) return;

    const startDateRaw = node.startDate ? this.parseLocalDate(node.startDate) : null;
    const dueDateRaw = node.dueDate ? this.parseLocalDate(node.dueDate) : null;

    const req: any = {
      title: newTitle,
      description: node.description,
      status: node.status,
      priority: node.priority,
      projectId: node.projectId ?? undefined,
      assigneeIds: node.assigneeIds && node.assigneeIds.length > 0 ? node.assigneeIds : undefined,
      startDate: startDateRaw ? this.formatLocalDate(startDateRaw) : undefined,
      dueDate: dueDateRaw ? this.formatLocalDate(dueDateRaw) : undefined,
      progressActual: node.progressActual ?? 0,
      parentId: node.parentId ?? undefined,
    };

    this.taskService.update(node.id, req).subscribe({
      next:  () => {
        this.refresh$.next();
        this.flashTaskUpdate(node.id);
        this.openInfoSnack('Título actualizado', 'success');
      },
      error: (e) => this.openInfoSnack(e.error?.message || 'Error al actualizar', 'error')
    });
  }

  changeStatus(task: Task, status: TaskStatus) {
    this.taskService.update(task.id, { ...task, status }).subscribe({
      next:  () => {
        this.refresh$.next();
        this.flashTaskUpdate(task.id);
        this.openInfoSnack('Estado actualizado', 'success');
      },
      error: (e) => this.openInfoSnack(e.error?.message || 'Error', 'error')
    });
  }

  confirmDelete(task: Task) {
    this.dialog.open(ConfirmDialogComponent, {
      data: { message: `¿Eliminar la tarea "${task.title}"?` +
        (task.hasChildren ? '\n\nLas subtareas quedarán como tareas raíz.' : '') }
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.taskService.delete(task.id).subscribe({
          next:  () => { this.refresh$.next(); this.openInfoSnack('Tarea eliminada', 'success'); },
          error: (e) => this.openInfoSnack(e.error?.message || 'Error', 'error')
        });
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  isTaskOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === 'DONE' || task.progressActual >= 100) return false;
    const dueDate = this.parseLocalDate(task.dueDate);
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }

  // Determina si la fila de una tarea debe resaltarse como crítica (rojo)
  // Esto incluye tareas bloqueadas o vencidas, o si alguna de sus subtareas lo está.
  isRowCritical(node: TaskNode): boolean {
    // Si la tarea está COMPLETED, no se considera crítica para el resaltado de fila
    if (node.status === 'DONE') {
      return false;
    }

    // Si la tarea está BLOQUEADA, es crítica
    if (node.status === 'BLOCKED') {
      return true;
    }

    // Si la tarea está vencida, es crítica
    if (this.isTaskOverdue(node)) {
      return true;
    }

    // Recursivamente, si alguna subtarea es crítica, entonces esta tarea padre también lo es
    return node.childrenNodes?.some(child => this.isRowCritical(child)) ?? false;
  }


  progressStatus(task: Task): 'on-track' | 'at-risk' | 'behind' | 'done' | 'no-date' {
    if (task.status === 'DONE') return 'done';
    if (task.progressExpected === null || task.progressExpected === undefined) return 'no-date';
    const diff = (task.progressActual ?? 0) - task.progressExpected;
    if (diff >= 0)   return 'on-track';
    if (diff >= -15) return 'at-risk';
    return 'behind';
  }

  progressIcon(task: Task): string {
    const s = this.progressStatus(task);
    if (s === 'done')     return 'check_circle';
    if (s === 'on-track') return 'check_circle';
    if (s === 'at-risk')  return 'warning';
    if (s === 'behind')   return 'error';
    return '';
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  private parseLocalDate(value?: string): Date | null {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  confirmDeleteAll() {
    this.dialog.open(ConfirmDialogComponent, {
      data: { message: '⚠ Esta acción eliminará TODAS las tareas del sistema sin excepción.\n\nEsto es irreversible. ¿Desea continuar?' }
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      // Second confirmation for extra safety
      this.dialog.open(ConfirmDialogComponent, {
        data: { message: '¿Está completamente seguro? Se borrarán todas las tareas y sus subtareas.' }
      }).afterClosed().subscribe(confirmed2 => {
        if (!confirmed2) return;
        this.taskService.deleteAll().subscribe({
          next: () => {
            this.allTasks = [];
            this.rootNodes = [];
            this.dataSource.data = [];
            this.taskCount.set(0);
            this.openInfoSnack('Todas las tareas fueron eliminadas', 'warning');
          },
          error: (e) => this.openInfoSnack(e.error?.message || 'Error al eliminar', 'error')
        });
      });
    });
  }

  exportView() {
    const visibleTasks = this.dataSource.data;
    if (visibleTasks.length === 0) {
      this.openInfoSnack('No hay tareas en la vista actual para exportar', 'warning');
      return;
    }

    const headers = ['Título', 'Proyecto', 'Asignado a', 'Estado', 'Prioridad', 'Inicio', 'Vencimiento', '% Real', '% Esperado'];

    const rows = visibleTasks.map(node => {
      const prefix = '  '.repeat(node.level || 0);

      const title = `${prefix}${node.title}`;
      const project = node.projectName ?? '';
      const assignee = node.assigneeNames?.join(', ') ?? '';
      const status = this.statusLabels[node.status] ?? node.status;
      const priority = this.priorityLabels[node.priority] ?? node.priority;

      const startDate = node.startDate ? this.parseLocalDate(node.startDate)?.toLocaleDateString('es-ES') : '';
      const dueDate = node.dueDate ? this.parseLocalDate(node.dueDate)?.toLocaleDateString('es-ES') : '';

      const progressActual = node.progressActual != null ? `${node.progressActual}%` : '';
      const progressExpected = node.progressExpected != null ? `${node.progressExpected}%` : '';

      const rowData = [title, project, assignee, status, priority, startDate, dueDate, progressActual, progressExpected];

      const escapeCsv = (val: string | undefined) => {
        const strVal = String(val ?? '');
        if (/[";\n\r]/.test(strVal)) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      };

      return rowData.map(escapeCsv).join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const today = this.formatLocalDate(new Date());
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasktracker_tasks_view_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.openInfoSnack(`Exportando ${visibleTasks.length} tareas de la vista...`, 'info');
  }

  exportPdf() {
    const visibleTasks = this.dataSource.data;
    if (visibleTasks.length === 0) {
      this.openInfoSnack('No hay tareas en la vista actual para exportar a PDF', 'warning');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    const head = [['Título', 'Proyecto', 'Asignado', 'Estado', 'Prioridad', 'Inicio', 'Venc.', '% Real', '% Esp.']];

    const body = visibleTasks.map(node => {
      const prefix = '  '.repeat(node.level || 0);
      const title = `${prefix}${node.title}`;
      const project = node.projectName ?? '';
      const assignee = node.assigneeNames?.join(', ') ?? '';
      const status = this.statusLabels[node.status] ?? node.status;
      const priority = this.priorityLabels[node.priority] ?? node.priority;
      const startDate = node.startDate ? (this.parseLocalDate(node.startDate)?.toLocaleDateString('es-ES') || '') : '';
      const dueDate = node.dueDate ? (this.parseLocalDate(node.dueDate)?.toLocaleDateString('es-ES') || '') : '';
      const progressActual = node.progressActual != null ? `${node.progressActual}%` : '';
      const progressExpected = node.progressExpected != null ? `${node.progressExpected}%` : '';

      return [title, project, assignee, status, priority, startDate, dueDate, progressActual, progressExpected];
    });

    autoTable(doc, {
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 25 }, 2: { cellWidth: 30 } },
      didDrawPage: (data: any) => {
        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text('Vista de Tareas', data.settings.margin.left, 15);
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(10);
        doc.text(`Página ${data.pageNumber} de ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.getHeight() - 10);
      },
      margin: { top: 20 },
    });

    const today = this.formatLocalDate(new Date());
    doc.save(`tasktracker_tasks_view_${today}.pdf`);
  }

  exportTasks() {
    // Export ALL tasks for backup purposes, not just the visible ones.
    const tasksToExport = this.allTasks;

    if (tasksToExport.length === 0) {
      this.openInfoSnack('No hay tareas para exportar', 'warning');
      return;
    }

    // Create maps for quick lookup of project names and member emails
    const projectMap = new Map<number, string>(this.projects().map(p => [p.id, p.name]));
    const memberMap = new Map<number, string>();
    this.members().forEach(m => {
      if (m.email) { // Ensure email exists
        memberMap.set(m.id, m.email);
      }
    });

    // Headers that match the import template format
    const headers = [
      'ID', 'Parent_ID', 'Title', 'Description', 'Project',
      'Assignees (emails)', 'Status', 'Priority', 'Start_Date',
      'Due_Date', 'Progress_Actual'
    ];

    const rows = tasksToExport.map(task => {
      const escapeCsv = (val: string | number | null | undefined) => {
        const str = String(val ?? '');
        // Si el string contiene el separador (|), una comilla, o un salto de línea, lo encerramos entre comillas.
        if (/[|\",\n\r]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const id = task.id;
      const parentId = task.parentId ?? '';
      const title = escapeCsv(task.title);
      const description = escapeCsv(task.description);
      const project = escapeCsv(task.projectId ? projectMap.get(task.projectId) : '');
      const assignees = escapeCsv(task.assigneeIds?.map(id => memberMap.get(id)).filter(Boolean).join(';') ?? '');
      const status = task.status;
      const priority = task.priority;
      const startDate = task.startDate ?? '';
      const dueDate = task.dueDate ?? '';
      const progressActual = task.progressActual ?? 0;

      return [id, parentId, title, description, project, assignees, status, priority, startDate, dueDate, progressActual].join('|');
    });

    const csvContent = '\uFEFF' + [headers.join('|'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const today = this.formatLocalDate(new Date());
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasktracker_tasks_backup_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.openInfoSnack(`Exportando ${tasksToExport.length} tareas para respaldo...`, 'info');
  }

  // ── Excel ─────────────────────────────────────────────────────────────────

  downloadTemplate() {
    this.taskService.downloadTemplate().subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'plantilla_tareas.csv'; a.click();
      URL.revokeObjectURL(url);
    });
  }

  triggerImport() { this.fileInputRef.nativeElement.click(); }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    input.value = '';

    this.taskService.importExcel(file).subscribe({
      next: (result: ImportResult) => {
        this.refresh$.next();
        const msg = `${result.imported} tarea(s) importada(s)` +
          (result.skipped ? `, ${result.skipped} omitida(s)` : '');
        this.openInfoSnack(msg, 'success');
        if (result.warnings.length > 0) {
          this.dialog.open(ImportWarningsDialogComponent, { width: '520px', data: result.warnings });
        }
      },
      error: (e) => this.openInfoSnack(e.error?.message || 'Error al importar', 'error')
    });
  }
}

@Component({
  selector: 'app-import-warnings-dialog',
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Advertencias de importación</h2>
    <mat-dialog-content>
      <ul style="margin:0;padding-left:18px;line-height:1.8">
        @for (w of data; track w) { <li style="font-size:13px;color:#475569">{{ w }}</li> }
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" mat-dialog-close>Entendido</button>
    </mat-dialog-actions>
  `
})
export class ImportWarningsDialogComponent {
  data: string[] = inject(MAT_DIALOG_DATA);
}
