import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
  INCIDENT_STATUS_LABELS,
  INCIDENT_ACTIONS,
} from '../../models/incident.model';
import { Project } from '../../models/project.model';
import { Member } from '../../models/member.model';
import { Task, PRIORITY_LABELS } from '../../models/task.model';
@Component({
  selector: 'app-incidents',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, DragDropModule, A11yModule],
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
    this.load();
  }
  ngOnDestroy() {
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
    return this.incidents.filter(
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
  openEditor(i?: Incident) {
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
      };
      const result = await firstValueFrom(
        this.editingId ? this.api.update(this.editingId, request) : this.api.create(request),
      );
      this.replace(result);
      this.selected = result;
      this.editor = false;
      this.notice = 'Incidente guardado. Puedes agregar sus evidencias.';
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
