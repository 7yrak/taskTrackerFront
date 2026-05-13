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
import { TaskService, ImportResult } from '../../services/task.service';
import { TaskFilterService } from '../../services/task-filter.service';
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
    MatSnackBarModule, MatTooltipModule, MatMenuModule
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
  statuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];
  activeSort: Sort = { active: 'startDate', direction: 'asc' };

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

  buildAndFilter() {
    this.rootNodes = this.buildTree(this.allTasks);
    this.sortTree(this.rootNodes);
    const filtered = this.filterTree(this.rootNodes);
    const visible  = this.flatten(filtered);
    this.dataSource.data = visible;
    this.taskCount.set(this.countLeaves(filtered));
  }

  applySort(sort: Sort) {
    this.activeSort = sort.direction ? sort : { active: 'startDate', direction: 'asc' };
    this.sortTree(this.rootNodes);
    const filtered = this.filterTree(this.rootNodes);
    this.dataSource.data = this.flatten(filtered);
  }

  private sortTree(nodes: TaskNode[]) {
    const { active, direction } = this.activeSort;
    if (!active || !direction) return;
    const multiplier = direction === 'asc' ? 1 : -1;

    nodes.sort((a, b) => this.compareSortValues(this.sortValue(a, active), this.sortValue(b, active)) * multiplier);
    for (const node of nodes) this.sortTree(node.childrenNodes);
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
    this.filterStatus.set(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED']);
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
          next:  () => { this.refresh$.next(); this.snack.open('Tarea creada', 'OK', { duration: 2500 }); },
          error: (e) => this.snack.open(e.error?.message || 'Error', 'OK', { duration: 3000 })
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
          next:  () => { this.refresh$.next(); this.snack.open('Tarea actualizada', 'OK', { duration: 2500 }); },
          error: (e) => this.snack.open(e.error?.message || 'Error', 'OK', { duration: 3000 })
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
      parentId: node.parentId ?? undefined
    };

    this.taskService.update(node.id, req).subscribe({
      next:  () => { this.refresh$.next(); this.snack.open('Título actualizado', 'OK', { duration: 2000 }); },
      error: (e) => this.snack.open(e.error?.message || 'Error al actualizar', 'OK', { duration: 3000 })
    });
  }

  changeStatus(task: Task, status: TaskStatus) {
    this.taskService.updateStatus(task.id, status).subscribe({
      next:  () => { this.refresh$.next(); this.snack.open('Estado actualizado', 'OK', { duration: 2000 }); },
      error: (e) => this.snack.open(e.error?.message || 'Error', 'OK', { duration: 3000 })
    });
  }

  confirmDelete(task: Task) {
    this.dialog.open(ConfirmDialogComponent, {
      data: { message: `¿Eliminar la tarea "${task.title}"?` +
        (task.hasChildren ? '\n\nLas subtareas quedarán como tareas raíz.' : '') }
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.taskService.delete(task.id).subscribe({
          next:  () => { this.refresh$.next(); this.snack.open('Tarea eliminada', 'OK', { duration: 2500 }); },
          error: (e) => this.snack.open(e.error?.message || 'Error', 'OK', { duration: 3000 })
        });
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === 'DONE' || task.progressActual >= 100) return false;
    const dueDate = this.parseLocalDate(task.dueDate);
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
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
            this.snack.open('Todas las tareas fueron eliminadas', 'OK', { duration: 3000 });
          },
          error: (e) => this.snack.open(e.error?.message || 'Error al eliminar', 'OK', { duration: 3000 })
        });
      });
    });
  }

  exportTasks() {
    const visibleTasks = this.dataSource.data;
    if (visibleTasks.length === 0) {
      this.snack.open('No hay tareas para exportar', 'OK', { duration: 2500 });
      return;
    }

    const headers = ['Título', 'Proyecto', 'Asignado', 'Estado', 'Prioridad', 'Inicio', 'Vencimiento', '% Real', '% Esperado'];
    const rows = visibleTasks.map(t => {
      // Sangría visual para subtareas
      const prefix = '  '.repeat(t.level || 0);
      
      const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
      
      const title = escapeCsv(`${prefix}${t.title}`);
      const project = escapeCsv(t.projectName || '');
      const assignee = escapeCsv(t.assigneeNames?.join(', ') || '');
      const status = escapeCsv(this.statusLabels[t.status] || t.status);
      const priority = escapeCsv(this.priorityLabels[t.priority] || t.priority);
      
      const formatStringDate = (val?: string) => {
        if (!val) return '""';
        const d = this.parseLocalDate(val);
        return d ? `"${d.toLocaleDateString('es-AR')}"` : `"${val}"`;
      };
      
      const startDate = formatStringDate(t.startDate);
      const dueDate = formatStringDate(t.dueDate);
      const progressReal = t.progressActual != null ? `"${t.progressActual}%"` : '""';
      const progressExpected = t.progressExpected != null ? `"${t.progressExpected}%"` : '""';

      return [title, project, assignee, status, priority, startDate, dueDate, progressReal, progressExpected].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const today = this.formatLocalDate(new Date());
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = `tareas_vista_${today}.csv`; 
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Excel ─────────────────────────────────────────────────────────────────

  downloadTemplate() {
    this.taskService.downloadTemplate().subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'plantilla_tareas.xlsx'; a.click();
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
        this.snack.open(msg, 'OK', { duration: 4000 });
        if (result.warnings.length > 0) {
          this.dialog.open(ImportWarningsDialogComponent, { width: '520px', data: result.warnings });
        }
      },
      error: (e) => this.snack.open(e.error?.message || 'Error al importar', 'OK', { duration: 4000 })
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
