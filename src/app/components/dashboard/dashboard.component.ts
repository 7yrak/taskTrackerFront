import { Component, inject, computed, signal, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, catchError, of } from 'rxjs';
import { StatsService } from '../../services/stats.service';
import { TaskService } from '../../services/task.service';
import { ProjectService } from '../../services/project.service';
import { MemberService } from '../../services/member.service';
import { Task, TaskNode, STATUS_LABELS, PRIORITY_LABELS } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Member } from '../../models/member.model';
import { TaskDialogComponent } from '../shared/task-dialog/task-dialog.component';
import { LogoComponent } from '../shared/logo/logo.component';

export type Health = 'blocked' | 'behind' | 'at-risk' | 'on-track' | 'done';

export interface ProjectHealth {
  projectId?: number;
  projectName: string;
  projectColor: string;
  totalTasks: number;
  doneTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  behindTasks: number;
  atRiskTasks: number;
  avgActual: number;
  avgExpected: number | null;
  health: Health;
}

export interface MemberHealth {
  name: string;
  totalTasks: number;
  doneTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  behindTasks: number;
  atRiskTasks: number;
  avgActual: number;
  health: Health;
  worstTasks: Task[];
}

export interface CriticalTask {
  task: Task;
  reason?: 'blocked' | 'overdue' | 'behind' | 'at-risk';
  severity: number;
  lag: number;
  level?: number;
  isCritical?: boolean;
  childrenNodes?: CriticalTask[];
}

const HEALTH_ORDER: Record<Health, number> = { blocked: 0, behind: 1, 'at-risk': 2, 'on-track': 3, done: 4 };

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule,
    MatExpansionModule, MatProgressSpinnerModule,
    MatDialogModule, MatSnackBarModule,
    LogoComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private taskService  = inject(TaskService);
  private projectService = inject(ProjectService);
  private memberService  = inject(MemberService);
  private dialog         = inject(MatDialog);
  private snack          = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  today = new Date();
  filterHealthStatus = signal<Health | 'all'>('all');
  sortBy = signal<'risk' | 'name' | 'progress'>('risk');

  isLoading = signal(true);
  isExportingPdf = signal(false);
  allTasks = signal<Task[]>([]);

  projects = toSignal(this.projectService.getAll(), { initialValue: [] as Project[] });
  members  = toSignal(this.memberService.getAll(),  { initialValue: [] as Member[]  });

  ngOnInit() {
    this.refreshData();
  }

  refreshData() {
    this.isLoading.set(true);
    this.cdr.detectChanges();
    
    this.taskService.getAll().subscribe({
      next: (tasks) => {
        console.log('Tasks loaded successfully:', tasks.length);
        this.allTasks.set(tasks);
        this.isLoading.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Tasks request failed:', err);
        this.allTasks.set([]);
        this.isLoading.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  kpis = computed(() => {
    const leafTasks = this.allTasks().filter(t => !t.hasChildren);
    const active = leafTasks.filter(t => t.status !== 'DONE' && (t.progressActual ?? 0) < 100);
    let blocked = 0, overdue = 0, behind = 0, atRisk = 0, done = 0;
    for (const t of leafTasks) {
      if (t.status === 'DONE' || (t.progressActual ?? 0) >= 100) { done++; continue; }
      if (t.status === 'BLOCKED') { blocked++; }
      if (this.isOverdue(t)) overdue++;
      const ps = this.progressStatus(t);
      if (ps === 'behind') behind++;
      else if (ps === 'at-risk') atRisk++;
    }
    const projects = this.projectHealth();
    const projectsAtRisk = projects.filter(p => p.health === 'blocked' || p.health === 'behind' || p.health === 'at-risk').length;
    const globalHealth: Health = blocked > 0 ? 'blocked'
      : behind > 0 ? 'behind'
      : atRisk > 0 ? 'at-risk'
      : 'on-track';
    return { total: leafTasks.length, active: active.length, blocked, overdue, behind, atRisk, done, projectsAtRisk, globalHealth };
  });

  criticalProjects = computed((): ProjectHealth[] => {
    return this.projectHealth().filter(p => p.health === 'blocked' || p.health === 'behind').slice(0, 3);
  });

  projectDelayDays = computed((): Map<string, number> => {
    const map = new Map<string, number>();
    for (const p of this.projectHealth()) {
      const diff = (p.avgExpected ?? 0) - (p.avgActual ?? 0);
      const estimatedTotalDays = 45;
      const delayDays = Math.ceil(estimatedTotalDays * (diff / 100));
      map.set(p.projectName, Math.max(0, delayDays));
    }
    return map;
  });

  projectHealth = computed((): ProjectHealth[] => {
    const map = new Map<string, ProjectHealth & { actualSum: number; expectedSum: number; leafCount: number }>();

    for (const t of this.allTasks()) {
      const key = t.projectName ?? '(Sin proyecto)';
      if (!map.has(key)) {
        map.set(key, {
          projectId: t.projectId, projectName: key,
          projectColor: t.projectColor ?? '#94A3B8',
          totalTasks: 0, doneTasks: 0, blockedTasks: 0,
          overdueTasks: 0, behindTasks: 0, atRiskTasks: 0,
          avgActual: 0, avgExpected: null, health: 'on-track',
          actualSum: 0, expectedSum: 0, leafCount: 0
        });
      }

      if (t.hasChildren) continue; // Ignoramos tareas padres en todas las sumatorias

      const ph = map.get(key)!;
      ph.totalTasks++;
      
      ph.leafCount++;
      ph.actualSum += (t.progressActual ?? 0);
      
      if (t.progressExpected != null) {
        ph.expectedSum += Math.min(100, t.progressExpected);
      } else {
        ph.expectedSum += (t.progressActual ?? 0);
      }

      if (t.status === 'DONE' || (t.progressActual ?? 0) >= 100) { ph.doneTasks++; continue; }
      if (t.status === 'BLOCKED') ph.blockedTasks++;
      if (this.isOverdue(t)) ph.overdueTasks++;
      const ps = this.progressStatus(t);
      if (ps === 'behind') ph.behindTasks++;
      else if (ps === 'at-risk') ph.atRiskTasks++;
    }

    let projects = [...map.values()].map(ph => {
      const avgActual   = ph.leafCount > 0 ? Math.round(ph.actualSum / ph.leafCount) : 0;
      const avgExpected = ph.leafCount > 0 ? Math.round(ph.expectedSum / ph.leafCount) : null;
      const diff = avgExpected != null ? avgActual - avgExpected : 0;
      
      let health: Health = 'on-track';
      if (ph.blockedTasks > 0) {
        health = 'blocked';
      } else if (avgExpected != null && diff <= -15) {
        health = 'behind';
      } else if (avgExpected != null && diff < -2) {
        health = 'at-risk';
      } else {
        if (ph.overdueTasks > 0 || ph.behindTasks > 0) {
          health = 'at-risk';
        }
      }

      return { ...ph, avgActual, avgExpected, health } as ProjectHealth;
    });
    
    if (this.filterHealthStatus() !== 'all') {
      projects = projects.filter(p => p.health === this.filterHealthStatus());
    }
    
    switch (this.sortBy()) {
      case 'name':
        projects.sort((a, b) => a.projectName.localeCompare(b.projectName));
        break;
      case 'progress':
        projects.sort((a, b) => (b.avgActual ?? 0) - (a.avgActual ?? 0));
        break;
      case 'risk':
      default:
        projects.sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health]);
    }
    
    return projects;
  });

  memberHealth = computed((): MemberHealth[] => {
    const map = new Map<string, MemberHealth & { tasks: Task[], actualSum: number, leafCount: number }>();

    for (const t of this.allTasks()) {
      if (t.hasChildren) continue; // Solo consideramos las tareas finales para el desempeño

      const names = (t.assigneeNames && t.assigneeNames.length > 0) ? t.assigneeNames : ['Sin asignar'];
      for (const name of names) {
        if (!map.has(name)) {
          map.set(name, { name, totalTasks: 0, doneTasks: 0, blockedTasks: 0,
            overdueTasks: 0, behindTasks: 0, atRiskTasks: 0, avgActual: 0, health: 'on-track', worstTasks: [], tasks: [], actualSum: 0, leafCount: 0 });
        }
        const mh = map.get(name)!;
        mh.totalTasks++;
        mh.tasks.push(t);

        mh.leafCount++;
        mh.actualSum += (t.progressActual ?? 0);

        if (t.status === 'DONE' || (t.progressActual ?? 0) >= 100) { mh.doneTasks++; continue; }
        if (t.status === 'BLOCKED') mh.blockedTasks++;
        if (this.isOverdue(t)) mh.overdueTasks++;
        const ps = this.progressStatus(t);
        if (ps === 'behind') mh.behindTasks++;
        else if (ps === 'at-risk') mh.atRiskTasks++;
      }
    }

    return [...map.values()]
      .filter(m => m.name !== 'Sin asignar')
      .map(m => {
        const health: Health = m.blockedTasks > 0 ? 'blocked'
          : (m.behindTasks > 0 || m.overdueTasks > 0) ? 'behind'
          : m.atRiskTasks > 0 ? 'at-risk' : 'on-track';
        const worstTasks = m.tasks
          .filter(t => t.status !== 'DONE' && (t.progressActual ?? 0) < 100)
          .filter(t => t.status === 'BLOCKED' || this.isOverdue(t) || this.progressStatus(t) === 'behind')
          .slice(0, 3);
        const avgActual = m.leafCount > 0 ? Math.round(m.actualSum / m.leafCount) : 0;
        return { ...m, health, worstTasks, avgActual } as MemberHealth;
      })
      .sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health] ||
        (b.blockedTasks * 3 + b.overdueTasks * 2 + b.behindTasks) -
        (a.blockedTasks * 3 + a.overdueTasks * 2 + a.behindTasks));
  });

  criticalTasks = computed((): CriticalTask[] => {
    const criticalMap = new Map<number, { reason: 'blocked' | 'overdue' | 'behind' | 'at-risk', severity: number, lag: number }>();
    
    for (const t of this.allTasks()) {
      if (t.hasChildren) continue; // Las tareas padres heredan el riesgo visual en el árbol, pero no se evalúan solas

      if (t.status === 'DONE' || (t.progressActual ?? 0) >= 100) continue;
      const overdue = this.isOverdue(t);
      const ps = this.progressStatus(t);
      
      let expected = t.progressExpected != null ? Math.min(100, t.progressExpected) : (t.progressActual ?? 0);
      const lag = Math.round(expected) - Math.round(t.progressActual ?? 0);

      if (t.status === 'BLOCKED') {
        criticalMap.set(t.id, { reason: 'blocked', severity: 4, lag });
      } else if (overdue && ps === 'behind') {
        criticalMap.set(t.id, { reason: 'overdue', severity: 3, lag });
      } else if (overdue) {
        criticalMap.set(t.id, { reason: 'overdue', severity: 2, lag });
      } else if (ps === 'behind') {
        criticalMap.set(t.id, { reason: 'behind', severity: 1, lag });
      } else if (ps === 'at-risk') {
        criticalMap.set(t.id, { reason: 'at-risk', severity: 0, lag });
      }
    }

    const map = new Map<number, CriticalTask>();
    const roots: CriticalTask[] = [];

    for (const t of this.allTasks()) {
      const c = criticalMap.get(t.id);
      map.set(t.id, {
        task: t,
        reason: c?.reason,
        severity: c?.severity ?? -1,
        lag: c?.lag ?? 0,
        level: 0,
        isCritical: !!c,
        childrenNodes: []
      });
    }

    for (const node of map.values()) {
      if (node.task.parentId != null && map.has(node.task.parentId)) {
        map.get(node.task.parentId)!.childrenNodes!.push(node);
      } else {
        roots.push(node);
      }
    }

    const filterTree = (nodes: CriticalTask[]): CriticalTask[] => {
      const res: CriticalTask[] = [];
      for (const node of nodes) {
        const filteredChildren = filterTree(node.childrenNodes!);
        node.childrenNodes = filteredChildren;
        // Conservar el nodo si es crítico O si tiene hijos que lo son
        if (node.isCritical || filteredChildren.length > 0) {
          if (filteredChildren.length > 0) {
            node.severity = Math.max(node.severity, ...filteredChildren.map(c => c.severity));
            node.lag = Math.max(node.lag, ...filteredChildren.map(c => c.lag));
          }
          res.push(node);
        }
      }
      res.sort((a, b) => b.severity - a.severity || b.lag - a.lag);
      return res;
    };

    const flatten = (nodes: CriticalTask[], level: number): CriticalTask[] => {
      const flat: CriticalTask[] = [];
      for (const node of nodes) {
        node.level = level;
        flat.push(node);
        flat.push(...flatten(node.childrenNodes!, level + 1));
      }
      return flat;
    };

    return flatten(filterTree(roots), 0);
  });

  openEdit(task: Task) {
    this.dialog.open(TaskDialogComponent, {
      width: '1000px',
      maxWidth: '95vw',
      maxHeight: '95vh',
      data: { task, projects: this.projects(), members: this.members(), allTasks: this.allTasks() }
    }).afterClosed().subscribe(result => {
      if (result) {
        this.taskService.update(task.id, result).subscribe({
          next:  () => { this.refreshData(); this.snack.open('Tarea actualizada', 'OK', { duration: 2500 }); },
          error: (e) => this.snack.open(e?.error?.message || 'Error al actualizar', 'OK', { duration: 3000 })
        });
      }
    });
  }

  collapsedIds = signal(new Set<number>());
  treeRoots    = computed(() => this.buildTree(this.allTasks()));
  visibleRows  = computed(() => this.flatten(this.treeRoots(), this.collapsedIds()));

  toggleTreeNode(node: TaskNode) {
    this.collapsedIds.update(s => { const n = new Set(s); n.has(node.id) ? n.delete(node.id) : n.add(node.id); return n; });
  }
  isCollapsed(n: TaskNode) { return this.collapsedIds().has(n.id); }
  collapseAll() { this.collapsedIds.set(new Set(this.treeRoots().map(n => n.id))); }
  expandAll()   { this.collapsedIds.set(new Set()); }

  private buildTree(tasks: Task[]): TaskNode[] {
    const map = new Map<number, TaskNode>();
    const roots: TaskNode[] = [];
    for (const t of tasks) map.set(t.id, { ...t, level: 0, expanded: true, childrenNodes: [] });
    for (const n of map.values()) {
      if (n.parentId != null && map.has(n.parentId)) map.get(n.parentId)!.childrenNodes.push(n);
      else roots.push(n);
    }
    const setLvl = (ns: TaskNode[], l: number) => ns.forEach(n => { n.level = l; setLvl(n.childrenNodes, l + 1); });
    setLvl(roots, 0);
    return roots;
  }
  
  private flatten(nodes: TaskNode[], collapsed: Set<number>): TaskNode[] {
    const r: TaskNode[] = [];
    for (const n of nodes) {
      r.push(n);
      if (!collapsed.has(n.id) && n.childrenNodes.length) r.push(...this.flatten(n.childrenNodes, collapsed));
    }
    return r;
  }

  statusLabels   = STATUS_LABELS;
  priorityLabels = PRIORITY_LABELS;

  private parseDate(dateRaw: any): Date | null {
    if (!dateRaw) return null;
    let dateStr = dateRaw;
    if (typeof dateStr === 'string') {
      dateStr = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
    } else if (Array.isArray(dateStr) && dateStr.length >= 3) {
      dateStr = `${dateStr[0]}-${String(dateStr[1]).padStart(2, '0')}-${String(dateStr[2]).padStart(2, '0')}T00:00:00`;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  isOverdue(t: Task) { 
    if (!t.dueDate || t.status === 'DONE' || (t.progressActual ?? 0) >= 100) return false;
    
    const due = this.parseDate(t.dueDate);
    if (!due) return false;
    
    // Ajustamos la fecha de vencimiento al final del día
    due.setHours(23, 59, 59, 999);
    return due < new Date(); 
  }

  progressStatus(t: Task): 'on-track' | 'at-risk' | 'behind' | 'done' | 'no-date' {
    if (t.status === 'DONE' || (t.progressActual ?? 0) >= 100) return 'done';

    // Si la tarea empieza en el futuro, no debe marcarse como atrasada
    if (t.startDate) {
      const start = this.parseDate(t.startDate);
      if (start) {
        start.setHours(0, 0, 0, 0);
        if (start > new Date()) return 'on-track';
      }
    }

    if (t.progressExpected == null) return 'no-date';
    
    const actual = Math.round(t.progressActual ?? 0);
    const expected = Math.round(Math.min(100, t.progressExpected));
    const d = actual - expected;
    
    // Tolerancia de margen (-2) y corrección de métricas
    return d >= -2 ? 'on-track' : d > -15 ? 'at-risk' : 'behind';
  }

  healthLabel(h: Health) {
    return h === 'blocked' ? 'Bloqueado' : h === 'behind' ? 'Atrasado'
      : h === 'at-risk' ? 'En riesgo' : 'Al día';
  }
  healthIcon(h: Health) {
    return h === 'blocked' ? 'block' : h === 'behind' ? 'trending_down'
      : h === 'at-risk' ? 'warning' : 'check_circle';
  }

  reasonLabel(r?: CriticalTask['reason']) {
    if (!r) return 'Estructura';
    return r === 'blocked' ? 'Bloqueada' : r === 'overdue' ? 'Vencida'
      : r === 'behind' ? 'Atrasada' : 'En riesgo';
  }
  reasonIcon(r?: CriticalTask['reason']) {
    if (!r) return 'account_tree';
    return r === 'blocked' ? 'block' : r === 'overdue' ? 'schedule'
      : r === 'behind' ? 'trending_down' : 'warning';
  }

  initials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  getProgress(done: number, total: number) {
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  progressIcon(t: Task) {
    const s = this.progressStatus(t);
    return s === 'done' ? 'verified' : s === 'on-track' ? 'check_circle'
      : s === 'at-risk' ? 'warning' : s === 'behind' ? 'error' : '';
  }
  progressTooltip(t: Task) {
    const s = this.progressStatus(t);
    return s === 'behind' ? 'Atrasado' : s === 'at-risk' ? 'En riesgo'
      : s === 'on-track' ? 'Al día' : 'Sin fechas';
  }

  async exportDashboardPdf() {
    const element = document.getElementById('dashboard-content');
    if (!element) {
      this.snack.open('No se encontró el contenedor del dashboard', 'OK', { duration: 2500 });
      return;
    }

    this.isExportingPdf.set(true);
    this.snack.open('Generando PDF, por favor espere...', 'OK', { duration: 5000 });

    try {
      // @ts-ignore
      const { default: html2canvas } = await import('html2canvas');
      // @ts-ignore
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfPageHeight;

      while (heightLeft > 0) {
        position -= pdfPageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfPageHeight;
      }
      
      const today = new Date().toISOString().split('T')[0];
      pdf.save(`dashboard_reporte_${today}.pdf`);
    } catch (error) {
      console.error('Error al generar el PDF del dashboard:', error);
      this.snack.open('Error al generar el PDF', 'OK', { duration: 3000 });
    } finally {
      this.isExportingPdf.set(false);
    }
  }
}
