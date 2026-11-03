import { Component, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProjectService } from '../../services/project.service';
import { MemberService } from '../../services/member.service';
import { TaskService } from '../../services/task.service';
import { ProjectDetail } from '../../models/project.model';
import { Member } from '../../models/member.model';
import { Task, STATUS_LABELS, PRIORITY_LABELS } from '../../models/task.model';
import { INCIDENT_STATUS_LABELS } from '../../models/incident.model';
import { PROJECT_STATUS_LABELS, formatDateYmd } from '../../shared/task-ui-utils';
import { TaskBulkDialogComponent } from '../shared/task-bulk-dialog/task-bulk-dialog.component';
import { ProjectDialogComponent } from '../shared/project-dialog/project-dialog.component';
import { TaskDialogComponent } from '../shared/task-dialog/task-dialog.component';

@Component({
  selector:'app-project-detail',
  imports:[CommonModule, RouterLink, MatButtonModule, MatIconModule, MatTabsModule,
    MatCheckboxModule, MatProgressBarModule],
  templateUrl:'./project-detail.component.html', styleUrl:'./project-detail.component.scss',
})
export class ProjectDetailComponent {
  private api = inject(ProjectService);
  private membersApi = inject(MemberService);
  private tasksApi = inject(TaskService);
  private route = inject(ActivatedRoute);
  private destroy = inject(DestroyRef);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  data = signal<ProjectDetail | null>(null);
  roster = signal<Member[]>([]);
  loading = signal(true);
  error = signal('');
  selected = signal<Set<number>>(new Set());
  tab = signal(0);
  readonly statusLabels = STATUS_LABELS;
  readonly priorityLabels = PRIORITY_LABELS;
  readonly projectStatusLabels = PROJECT_STATUS_LABELS;
  readonly incidentStatusLabels = INCIDENT_STATUS_LABELS;
  readonly today = formatDateYmd(new Date());
  private id = 0;
  private loadSequence = 0;

  constructor() {
    this.route.paramMap.pipe(map(params => Number(params.get('id'))), takeUntilDestroyed(this.destroy))
      .subscribe(id => { this.id = id; this.tab.set(0); this.data.set(null); this.load(); });
  }
  load() {
    const sequence = ++this.loadSequence;
    this.loading.set(true); this.error.set(''); this.selected.set(new Set());
    if (!Number.isSafeInteger(this.id) || this.id < 1) { this.error.set('El proyecto solicitado no es válido.'); this.loading.set(false); return; }
    forkJoin({ detail:this.api.detail(this.id), roster:this.membersApi.getAll() })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => { if (sequence !== this.loadSequence) return; this.data.set(result.detail); this.roster.set(result.roster); this.loading.set(false); },
        error: error => { if (sequence !== this.loadSequence) return; this.error.set(error.status === 404 ? 'El proyecto ya no existe.' : 'No se pudo cargar la ficha del proyecto.'); this.loading.set(false); },
      });
  }
  leaves = computed(() => this.data()?.tasks.filter(t => !t.hasChildren) ?? []);
  done(task:Task) { return task.status === 'DONE' || task.progressActual >= 100; }
  overdue(task:Task) { return !this.done(task) && task.status !== 'STOPPED' && !!task.dueDate && task.dueDate < this.today; }
  summary = computed(() => {
    const tasks = this.leaves();
    const starts = tasks.map(t => t.startDate).filter((d):d is string => !!d).sort();
    const ends = tasks.map(t => t.dueDate).filter((d):d is string => !!d).sort();
    const overtime = this.data()?.overtime ?? [];
    return { total:tasks.length, done:tasks.filter(t => this.done(t)).length,
      blocked:tasks.filter(t => !this.done(t) && t.status === 'BLOCKED').length,
      overdue:tasks.filter(t => this.overdue(t)).length,
      progress:tasks.length ? Math.round(tasks.reduce((sum,t) => sum + (this.done(t) ? 100 : t.progressActual || 0),0)/tasks.length) : 0,
      start:starts[0], end:ends.at(-1),
      hours:Math.round(overtime.reduce((sum,e) => sum + e.hours,0)*100)/100,
      openIncidents:this.data()?.incidents.filter(i => i.status !== 'CLOSED' && i.status !== 'CANCELLED').length ?? 0 };
  });
  nextTasks = computed(() => this.leaves().filter(t => !this.done(t) && t.status !== 'STOPPED')
    .sort((a,b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')).slice(0,5));
  taskRows = computed(() => {
    const tasks = this.data()?.tasks ?? [];
    const byParent = new Map<number | null,Task[]>();
    const ids = new Set(tasks.map(t => t.id));
    for (const task of tasks) { const key = task.parentId && ids.has(task.parentId) ? task.parentId : null; byParent.set(key,[...(byParent.get(key) ?? []),task]); }
    const rows: {task:Task; level:number}[] = [];
    const visit = (parent:number|null,level:number) => { for (const task of byParent.get(parent) ?? []) { rows.push({task,level}); visit(task.id,level+1); } };
    visit(null,0); return rows;
  });
  toggle(id:number,checked:boolean) { this.selected.update(old => { const next = new Set(old); checked ? next.add(id) : next.delete(id); return next; }); }
  allSelected = computed(() => this.leaves().length > 0 && this.leaves().every(t => this.selected().has(t.id)));
  selectAll(checked:boolean) { this.selected.set(new Set(checked ? this.leaves().slice(0,500).map(t => t.id) : [])); }
  memberTasks(id:number) { return this.leaves().filter(t => t.assigneeIds?.includes(id)).length; }
  editBatch() {
    const tasks = this.leaves().filter(t => this.selected().has(t.id));
    if (!tasks.length || tasks.length > 500) return;
    this.dialog.open(TaskBulkDialogComponent,{width:'760px',maxWidth:'96vw',maxHeight:'94vh',data:{tasks,members:this.roster()}})
      .afterClosed().pipe(takeUntilDestroyed(this.destroy)).subscribe(result => {
        if (result) { this.snack.open(`${result.length} ${result.length === 1 ? 'tarea actualizada' : 'tareas actualizadas'}`,'OK',{duration:3000}); this.load(); }
      });
  }
  editProject() {
    this.dialog.open(ProjectDialogComponent,{width:'560px',maxWidth:'96vw',data:this.data()!.project})
      .afterClosed().pipe(takeUntilDestroyed(this.destroy)).subscribe(result => {
        if (result) this.api.update(this.id,result).subscribe({next:() => this.load(),error:e => this.snack.open(e.error?.message || 'No se pudo guardar el proyecto','OK',{duration:4000})});
      });
  }
  editTask(task:Task) {
    this.dialog.open(TaskDialogComponent,{width:'1000px',maxWidth:'96vw',maxHeight:'94vh',
      data:{task,projects:[this.data()!.project],members:this.roster(),allTasks:this.data()!.tasks}})
      .afterClosed().pipe(takeUntilDestroyed(this.destroy)).subscribe(result => {
        if (result) this.tasksApi.update(task.id,result).subscribe({next:() => this.load(),error:e => this.snack.open(e.error?.message || 'No se pudo guardar la tarea','OK',{duration:4000})});
      });
  }
}
