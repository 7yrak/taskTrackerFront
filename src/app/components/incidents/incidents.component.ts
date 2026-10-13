import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { forkJoin, firstValueFrom } from 'rxjs';
import { IncidentService } from '../../services/incident.service';
import { ProjectService } from '../../services/project.service';
import { MemberService } from '../../services/member.service';
import { TaskService } from '../../services/task.service';
import {
  Incident,
  IncidentRequest,
  IncidentStatus,
  IncidentAttachment,
  IncidentImportPreview,
  INCIDENT_STATUS_LABELS,
  INCIDENT_ACTIONS,
} from '../../models/incident.model';
import { Project } from '../../models/project.model';
import { Member } from '../../models/member.model';
import { Task, PRIORITY_LABELS } from '../../models/task.model';
@Component({
  selector: 'app-incidents',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    DragDropModule,
    A11yModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    MatMenuModule,
  ],
  templateUrl: './incidents.component.html',
  styleUrl: './incidents.component.scss',
})
export class IncidentsComponent implements OnInit, OnDestroy {
  private change = inject(ChangeDetectorRef);
  private destroy = inject(DestroyRef);
  private api = inject(IncidentService);
  private projectsApi = inject(ProjectService);
  private membersApi = inject(MemberService);
  private tasksApi = inject(TaskService);
  incidents: Incident[] = [];
  projects: Project[] = [];
  members: Member[] = [];
  tasks: Task[] = [];
  inlineEditingId: number | null = null;
  inlineForm: IncidentRequest = this.emptyForm();
  titleEditingId: number | null = null;
  titleDraft = '';
  sorts: { column: string; direction: 'asc' | 'desc' }[] = [];
  columnWidths: Record<string, number> = {
    incident: 420,
    project: 130,
    environment: 85,
    status: 170,
    priority: 90,
    responsibles: 160,
    dueDate: 120,
    actions: 112,
  };
  private resizeCleanup: (() => void) | null = null;
  get tableWidth() {
    return Object.values(this.columnWidths).reduce((sum, width) => sum + width, 0);
  }
  sortDirection(column: string) {
    return this.sorts.find((sort) => sort.column === column)?.direction ?? '';
  }
  sortOrder(column: string) {
    const index = this.sorts.findIndex((sort) => sort.column === column);
    return this.sorts.length > 1 && index >= 0 ? index + 1 : null;
  }
  handleSort(column: string, event: MouseEvent) {
    const existing = this.sorts.find((sort) => sort.column === column);
    if (event.shiftKey) {
      if (existing?.direction === 'asc')
        this.sorts = this.sorts.map((sort) =>
          sort.column === column ? { ...sort, direction: 'desc' } : sort,
        );
      else if (existing) this.sorts = this.sorts.filter((sort) => sort.column !== column);
      else this.sorts = [...this.sorts, { column, direction: 'asc' }];
    } else {
      this.sorts = [
        {
          column,
          direction: this.sorts.length === 1 && existing?.direction === 'asc' ? 'desc' : 'asc',
        },
      ];
    }
  }
  startColumnResize(column: string, event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.resizeCleanup?.();
    const start = event.clientX,
      width = this.columnWidths[column];
    const minimum = column === 'incident' ? 260 : column === 'actions' ? 100 : 80;
    const move = (pointer: PointerEvent) => {
      this.columnWidths = {
        ...this.columnWidths,
        [column]: Math.max(minimum, width + pointer.clientX - start),
      };
      this.change.markForCheck();
    };
    const end = () => {
      this.resizeCleanup?.();
      try {
        localStorage.setItem('incidents.tableColumnWidths.v1', JSON.stringify(this.columnWidths));
      } catch {}
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
    window.addEventListener('pointercancel', end, { once: true });
    this.resizeCleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      this.resizeCleanup = null;
    };
  }
  displayedColumns = [
    'incident',
    'project',
    'environment',
    'status',
    'priority',
    'responsibles',
    'dueDate',
    'actions',
  ];
  statusTones: Record<IncidentStatus, string> = {
    REGISTERED: 'TODO',
    DEVELOPMENT: 'IN_PROGRESS',
    CERT: 'IN_REVIEW',
    QA_APPROVED: 'DONE',
    UAT: 'IN_REVIEW',
    CLIENT_APPROVED: 'DONE',
    CLOSED: 'DONE',
    CANCELLED: 'BLOCKED',
  };
  statusTone(status: IncidentStatus) {
    return this.statusTones[status];
  }
  statusLabel(status: IncidentStatus) {
    return this.labels[status];
  }
  priorityLabel(priority: Incident['priority']) {
    return this.priorityLabels[priority];
  }
  projectColor(id: number | null) {
    return this.projects.find((project) => project.id === id)?.color ?? 'var(--gray)';
  }
  trackIncident(index: number, incident: Incident) {
    return incident.id;
  }
  statuses = Object.keys(INCIDENT_STATUS_LABELS) as IncidentStatus[];
  labels = INCIDENT_STATUS_LABELS;
  actionLabels = INCIDENT_ACTIONS;
  priorityLabels = PRIORITY_LABELS;
  environments = ['DESA', 'CERT', 'UAT', 'PROD'];
  priorities = Object.keys(PRIORITY_LABELS);
  view: 'table' | 'board' = 'table';
  search = '';
  projectFilter = '';
  statusFilter = '';
  environmentFilter = '';
  priorityFilter = '';
  memberFilter = '';
  loading = true;
  busy = false;
  error = '';
  notice = '';
  selected: Incident | null = null;
  editor = false;
  editingId: number | null = null;
  form = this.emptyForm();
  action = '';
  actor = '';
  observation = '';
  evidenceUrl = '';
  commentAuthor = '';
  commentText = '';
  category = 'INCIDENT';
  previewUrl = '';
  previewName = '';
  excelOpen = false;
  excelProjectId: number | null = null;
  excelFile: File | null = null;
  excelEnvironment = '';
  excelReporter = '';
  excelPreview: IncidentImportPreview | null = null;
  excelConfirmed = false;
  private urls: string[] = [];
  emptyForm(): IncidentRequest {
    return {
      title: '',
      description: '',
      reporter: '',
      projectId: null,
      taskId: null,
      detectedEnvironment: 'DESA',
      priority: 'MEDIUM',
      developerId: null,
      qaId: null,
      reproductionSteps: '',
      expectedResult: '',
      actualResult: '',
      dueDate: null,
    };
  }
  ngOnInit() {
    try {
      const saved = JSON.parse(localStorage.getItem('incidents.tableColumnWidths.v1') ?? '{}');
      for (const key of Object.keys(this.columnWidths))
        if (Number.isFinite(saved[key]))
          this.columnWidths[key] = Math.max(
            key === 'incident' ? 260 : key === 'actions' ? 100 : 80,
            saved[key],
          );
    } catch {}
    this.load();
  }
  ngOnDestroy() {
    this.resizeCleanup?.();
    this.urls.forEach((url) => URL.revokeObjectURL(url));
  }
  load() {
    this.loading = true;
    this.error = '';
    forkJoin({
      incidents: this.api.all(),
      projects: this.projectsApi.getAll(),
      members: this.membersApi.getAll(),
      tasks: this.tasksApi.getAll(),
    })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (data) => {
          Object.assign(this, data);
          this.loading = false;
          this.change.markForCheck();
        },
        error: (e) => {
          this.fail(e);
          this.loading = false;
          this.change.markForCheck();
        },
      });
  }
  get filtered() {
    const q = this.search.trim().toLocaleLowerCase();
    const result = this.incidents.filter(
      (i) =>
        (!q ||
          `${i.id} ${i.title} ${i.description} ${i.reporter}`.toLocaleLowerCase().includes(q)) &&
        (!this.projectFilter || String(i.projectId) === this.projectFilter) &&
        (!this.statusFilter || i.status === this.statusFilter) &&
        (!this.environmentFilter || i.detectedEnvironment === this.environmentFilter) &&
        (!this.priorityFilter || i.priority === this.priorityFilter) &&
        (!this.memberFilter ||
          String(i.developerId) === this.memberFilter ||
          String(i.qaId) === this.memberFilter),
    );
    const text = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
    return result.sort((a, b) => {
      for (const sort of this.sorts) {
        const value = (i: Incident): string | number => {
          switch (sort.column) {
            case 'incident':
              return i.title;
            case 'project':
              return i.projectName;
            case 'environment':
              return i.detectedEnvironment;
            case 'status':
              return this.labels[i.status];
            case 'priority':
              return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(i.priority);
            case 'responsibles':
              return `${i.developerName ?? ''} ${i.qaName ?? ''}`;
            case 'dueDate':
              return i.dueDate ?? '';
            default:
              return '';
          }
        };
        const left = value(a),
          right = value(b);
        const compared =
          typeof left === 'number' && typeof right === 'number'
            ? left - right
            : text.compare(String(left), String(right));
        if (compared) return sort.direction === 'asc' ? compared : -compared;
      }
      return 0;
    });
  }
  column(status: IncidentStatus) {
    return this.filtered.filter((i) => i.status === status);
  }
  get taskOptions() {
    return this.tasks.filter((t) => t.projectId === this.form.projectId);
  }
  resetFilters() {
    this.search =
      this.projectFilter =
      this.statusFilter =
      this.environmentFilter =
      this.priorityFilter =
      this.memberFilter =
        '';
  }
  editable(i: Incident) {
    return i.status === 'REGISTERED' || i.status === 'DEVELOPMENT';
  }
  private request(value: IncidentRequest): IncidentRequest {
    return {
      title: value.title.trim(),
      description: value.description,
      projectId: value.projectId,
      taskId: value.taskId,
      detectedEnvironment: value.detectedEnvironment,
      priority: value.priority,
      reporter: value.reporter.trim(),
      developerId: value.developerId,
      qaId: value.qaId,
      reproductionSteps: value.reproductionSteps,
      expectedResult: value.expectedResult,
      actualResult: value.actualResult,
      dueDate: value.dueDate || null,
      reportedStatus: value.reportedStatus,
      qaDeliveryDate: value.qaDeliveryDate || null,
      importNotes: value.importNotes,
    };
  }
  startInlineEdit(i: Incident) {
    if (this.busy || !this.editable(i)) return;
    this.cancelTitleEdit();
    this.inlineEditingId = i.id;
    this.inlineForm = { ...i };
    this.error = '';
    setTimeout(() => {
      const input = document.getElementById(`inline-title-${i.id}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }
  cancelInlineEdit() {
    if (this.busy) return;
    this.inlineEditingId = null;
    this.inlineForm = this.emptyForm();
  }
  inlineProjectChanged() {
    this.inlineForm.taskId = null;
  }
  async saveInlineEdit(i: Incident) {
    if (this.busy || this.inlineEditingId !== i.id) return;
    if (
      !this.inlineForm.title.trim() ||
      !this.inlineForm.reporter.trim() ||
      !this.inlineForm.projectId
    ) {
      this.error = 'Completa título, reportante y proyecto.';
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      this.replace(await firstValueFrom(this.api.update(i.id, this.request(this.inlineForm))));
      this.inlineEditingId = null;
      this.notice = 'Incidente actualizado';
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
      this.change.markForCheck();
    }
  }
  startTitleEdit(i: Incident, event: MouseEvent) {
    event.stopPropagation();
    if (this.busy || !this.editable(i)) return;
    this.cancelInlineEdit();
    this.titleEditingId = i.id;
    this.titleDraft = i.title;
    this.error = '';
    setTimeout(() => {
      const input = document.getElementById(`title-input-${i.id}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }
  cancelTitleEdit() {
    if (!this.busy) this.titleEditingId = null;
  }
  async saveTitle(i: Incident) {
    if (this.busy || this.titleEditingId !== i.id) return;
    const title = this.titleDraft.trim();
    if (!title) {
      this.error = 'El título es obligatorio.';
      return;
    }
    if (title === i.title) {
      this.cancelTitleEdit();
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      this.replace(await firstValueFrom(this.api.update(i.id, this.request({ ...i, title }))));
      this.titleEditingId = null;
      this.notice = 'Título actualizado';
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
      this.change.markForCheck();
    }
  }
  startTableAction(i: Incident, action: string) {
    this.cancelInlineEdit();
    this.cancelTitleEdit();
    this.selected = i;
    this.choose(action);
  }
  openEditor(i?: Incident) {
    this.cancelInlineEdit();
    this.cancelTitleEdit();
    this.editingId = i?.id ?? null;
    this.form = i ? { ...i } : this.emptyForm();
    this.editor = true;
    this.error = '';
  }
  async save() {
    if (
      !this.form.title.trim() ||
      !this.form.description.trim() ||
      !this.form.reporter.trim() ||
      !this.form.projectId
    ) {
      this.error = 'Completa título, descripción, reportante y proyecto.';
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      const {
        title,
        description,
        reporter,
        projectId,
        taskId,
        detectedEnvironment,
        priority,
        developerId,
        qaId,
        reproductionSteps,
        expectedResult,
        actualResult,
        dueDate,
        reportedStatus,
        qaDeliveryDate,
        importNotes,
      } = this.form;
      const request = {
        title,
        description,
        reporter,
        projectId,
        taskId,
        detectedEnvironment,
        priority,
        developerId,
        qaId,
        reproductionSteps,
        expectedResult,
        actualResult,
        dueDate: dueDate || null,
        reportedStatus,
        qaDeliveryDate: qaDeliveryDate || null,
        importNotes,
      };
      const result = await firstValueFrom(
        this.editingId ? this.api.update(this.editingId, request) : this.api.create(request),
      );
      this.replace(result);
      if (this.editingId === null || this.selected?.id === result.id) this.selected = result;
      this.editor = false;
      this.notice =
        this.editingId === null
          ? 'Incidente guardado. Puedes agregar sus evidencias.'
          : 'Incidente actualizado';
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
      this.change.markForCheck();
    }
  }
  open(i: Incident) {
    this.selected = i;
    this.error = '';
    this.action = '';
    this.api
      .get(i.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (result) => this.replace(result), error: (e) => this.fail(e) });
  }
  actions(i: Incident): string[] {
    const map: Record<IncidentStatus, string[]> = {
      REGISTERED: ['START'],
      DEVELOPMENT: ['SEND_CERT'],
      CERT: ['APPROVE_QA', 'REJECT'],
      QA_APPROVED: ['SEND_UAT'],
      UAT: ['APPROVE_CLIENT', 'REJECT'],
      CLIENT_APPROVED: ['DEPLOY'],
      CLOSED: ['REOPEN'],
      CANCELLED: [],
    };
    return [...map[i.status], ...(!['CLOSED', 'CANCELLED'].includes(i.status) ? ['CANCEL'] : [])];
  }
  choose(action: string) {
    if (!this.selected) return;
    this.action = action;
    this.observation = '';
    this.evidenceUrl = '';
    this.error = '';
    this.actor =
      ['APPROVE_QA', 'SEND_UAT'].includes(action) ||
      (action === 'REJECT' && this.selected.status === 'CERT')
        ? (this.selected.qaName ?? '')
        : ['START', 'SEND_CERT'].includes(action)
          ? (this.selected.developerName ?? '')
          : '';
  }
  reasonRequired() {
    return ['APPROVE_QA', 'APPROVE_CLIENT', 'REJECT', 'REOPEN', 'CANCEL', 'DEPLOY'].includes(
      this.action,
    );
  }
  actorFixed() {
    return (
      ['START', 'SEND_CERT', 'APPROVE_QA', 'SEND_UAT'].includes(this.action) ||
      (this.action === 'REJECT' && this.selected?.status === 'CERT')
    );
  }
  async transition() {
    if (!this.selected || !this.action) return;
    if (!this.actor.trim() || (this.reasonRequired() && !this.observation.trim())) {
      this.error = 'Completa el responsable y la observación requerida.';
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      this.replace(
        await firstValueFrom(
          this.api.transition(
            this.selected.id,
            this.action,
            this.actor,
            this.observation,
            this.evidenceUrl,
          ),
        ),
      );
      this.action = '';
      this.notice = 'Etapa registrada en el historial.';
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
      this.change.markForCheck();
    }
  }
  drop(event: CdkDragDrop<Incident[]>, target: IncidentStatus) {
    const i: Incident = event.item.data;
    if (i.status === target) return;
    const targets: Record<string, IncidentStatus> = {
      START: 'DEVELOPMENT',
      SEND_CERT: 'CERT',
      APPROVE_QA: 'QA_APPROVED',
      SEND_UAT: 'UAT',
      APPROVE_CLIENT: 'CLIENT_APPROVED',
      DEPLOY: 'CLOSED',
      REJECT: 'DEVELOPMENT',
      REOPEN: 'DEVELOPMENT',
      CANCEL: 'CANCELLED',
    };
    const action = this.actions(i).find((a) => targets[a] === target);
    if (!action) {
      this.error = 'Completa las etapas previas. QA y cliente deben aprobar antes de avanzar.';
      return;
    }
    this.selected = i;
    this.choose(action);
  }
  async addComment() {
    if (!this.selected || !this.commentAuthor.trim() || !this.commentText.trim()) {
      this.error = 'Escribe autor y comentario.';
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      this.replace(
        await firstValueFrom(
          this.api.comment(this.selected.id, this.commentAuthor, this.commentText),
        ),
      );
      this.commentText = '';
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
      this.change.markForCheck();
    }
  }
  async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!this.selected || !files.length) return;
    if (
      files.some(
        (f) =>
          f.size === 0 || f.size > 10 * 1024 * 1024 || !/\.(png|jpe?g|webp|pdf)$/i.test(f.name),
      )
    ) {
      this.error = 'Usa PNG, JPG, WebP o PDF de hasta 10 MB por archivo.';
      return;
    }
    this.busy = true;
    this.error = '';
    let uploaded = 0;
    try {
      for (const file of files) {
        this.replace(await firstValueFrom(this.api.upload(this.selected.id, this.category, file)));
        uploaded++;
      }
      this.notice = `${uploaded} evidencia(s) adjuntada(s).`;
    } catch (e) {
      this.fail(e);
      this.notice = uploaded ? `${uploaded} archivo(s) guardado(s) antes del error.` : '';
    } finally {
      this.busy = false;
      this.change.markForCheck();
    }
  }
  async evidence(a: IncidentAttachment) {
    if (!this.selected) return;
    try {
      const blob = await firstValueFrom(this.api.download(this.selected.id, a.id));
      const url = URL.createObjectURL(blob);
      this.urls.push(url);
      if (a.contentType.startsWith('image/')) {
        this.previewUrl = url;
        this.previewName = a.filename;
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = a.filename;
        link.click();
      }
    } catch (e) {
      this.fail(e);
    } finally {
      this.change.markForCheck();
    }
  }
  replace(i: Incident) {
    this.incidents = [i, ...this.incidents.filter((item) => item.id !== i.id)].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    if (this.selected?.id === i.id) this.selected = i;
    this.change.markForCheck();
  }
  fail(e: any) {
    this.error =
      e?.error?.message ??
      'No se pudo completar la operación. Revisa la conexión e intenta nuevamente.';
    this.change.markForCheck();
  }
  openExcel() {
    this.excelProjectId = Number(this.projectFilter) || null;
    this.excelFile = null;
    this.excelPreview = null;
    this.excelConfirmed = false;
    this.excelEnvironment = '';
    this.excelReporter = '';
    this.error = '';
    this.notice = '';
    this.excelOpen = true;
  }
  get excelProjectName() {
    return this.projects.find((p) => p.id === this.excelProjectId)?.name ?? '';
  }
  invalidateExcelPreview() {
    this.excelPreview = null;
    this.excelConfirmed = false;
  }
  selectExcelFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.excelFile = input.files?.[0] ?? null;
    this.invalidateExcelPreview();
    this.error = '';
    if (
      this.excelFile &&
      (!this.excelFile.name.toLowerCase().endsWith('.xlsx') ||
        this.excelFile.size > 10 * 1024 * 1024 ||
        !this.excelFile.size)
    ) {
      this.error = 'Selecciona un archivo Excel .xlsx de hasta 10 MB.';
      this.excelFile = null;
      input.value = '';
    }
  }
  async previewExcel() {
    if (!this.excelFile || !this.excelProjectId) return;
    this.busy = true;
    this.error = '';
    this.invalidateExcelPreview();
    try {
      this.excelPreview = await firstValueFrom(
        this.api.preview(
          this.excelFile,
          this.excelProjectId,
          this.excelEnvironment,
          this.excelReporter,
        ),
      );
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
      this.change.markForCheck();
    }
  }
  async importExcel() {
    if (
      !this.excelFile ||
      !this.excelProjectId ||
      !this.excelPreview ||
      this.excelPreview.errors.length ||
      !this.excelConfirmed ||
      this.busy
    )
      return;
    this.busy = true;
    this.error = '';
    try {
      const result = await firstValueFrom(
        this.api.replaceFromExcel(
          this.excelFile,
          this.excelProjectId,
          this.excelEnvironment,
          this.excelReporter,
          this.excelPreview.fingerprint,
        ),
      );
      this.incidents = this.incidents.filter((i) => i.projectId !== this.excelProjectId);
      this.selected = null;
      this.excelOpen = false;
      this.resetFilters();
      this.projectFilter = String(this.excelProjectId);
      this.notice = `Se cargaron ${result.imported} incidentes en Registrado y se reemplazaron ${result.replaced} del proyecto ${result.projectName}.`;
      try {
        this.incidents = await firstValueFrom(this.api.all());
      } catch {
        this.error =
          'La carga se completó, pero no se pudo actualizar el listado. Usa Actualizar para volver a consultarlo.';
      }
    } catch (e) {
      this.fail(e);
      this.invalidateExcelPreview();
    } finally {
      this.busy = false;
      this.change.markForCheck();
    }
  }
  async downloadExcel(template: boolean) {
    const projectId = Number(this.projectFilter);
    if (!projectId) {
      this.error = 'Selecciona un proyecto para descargar su Excel.';
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      const blob = await firstValueFrom(
        template ? this.api.template(projectId) : this.api.export(projectId),
      );
      const url = URL.createObjectURL(blob);
      this.urls.push(url);
      const link = document.createElement('a');
      link.href = url;
      link.download = template
        ? 'plantilla-incidentes.xlsx'
        : `incidentes-proyecto-${projectId}.xlsx`;
      link.click();
    } catch (e) {
      const failure = e as { error?: Blob };
      if (failure.error instanceof Blob) {
        try {
          this.error = JSON.parse(await failure.error.text()).message;
        } catch {
          this.fail(e);
        }
      } else this.fail(e);
    } finally {
      this.busy = false;
      this.change.markForCheck();
    }
  }
  eventLabel(type: string) {
    return (
      this.actionLabels[type] ??
      (
        {
          CREATED: 'Registro',
          UPDATED: 'Edición',
          COMMENT: 'Comentario',
          ATTACHMENT: 'Evidencia',
        } as Record<string, string>
      )[type] ??
      type
    );
  }
}
