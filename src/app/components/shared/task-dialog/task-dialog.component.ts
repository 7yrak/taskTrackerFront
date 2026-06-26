import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSliderModule } from '@angular/material/slider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, distinctUntilChanged, startWith } from 'rxjs';
import { Task, TaskComment, STATUS_LABELS, PRIORITY_LABELS } from '../../../models/task.model';
import { Project } from '../../../models/project.model';
import { Member } from '../../../models/member.model';

export interface TaskDialogData {
  task: Task | null;
  projects: Project[];
  members: Member[];
  allTasks: Task[];
  defaultParentId?: number | null;
}

@Component({
  selector: 'app-task-dialog',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule,
    MatDatepickerModule, MatSliderModule, MatIconModule, MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">{{ data.task ? 'Editar tarea' : 'Nueva tarea' }}</h2>
    <mat-dialog-content class="custom-dialog-content">
      <form [formGroup]="form" class="dialog-form">
        <div class="form-grid form-grid-2">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Proyecto *</mat-label>
            <mat-select formControlName="projectId">
              @for (p of data.projects; track p.id) {
                <mat-option [value]="p.id">{{ p.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Tarea padre (opcional)</mat-label>
            <mat-select formControlName="parentId" [disabled]="!form.get('projectId')?.value || parentOptions.length === 0">
              <mat-option [value]="null">Ninguna (tarea raíz)</mat-option>
              @for (t of parentOptions; track t.id) {
                <mat-option [value]="t.id">
                  {{ '·'.repeat(t['_level'] ?? 0) }} {{ t.title }}
                </mat-option>
              }
            </mat-select>
            <mat-icon matSuffix style="color:#94A3B8;font-size:18px">account_tree</mat-icon>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Título *</mat-label>
          <input matInput formControlName="title" placeholder="Nombre de la tarea" />
          @if (form.get('title')?.hasError('required')) {
            <mat-error>Requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
          <mat-label>Descripción</mat-label>
          <textarea matInput formControlName="description" rows="2" placeholder="Descripción opcional"></textarea>
        </mat-form-field>

        @if (isDerivedTask) {
          <div class="derived-note">
            <mat-icon style="font-size: 16px; width: 16px; height: 16px;">info</mat-icon>
            Esta tarea tiene subtareas: fechas, estado, asignados y avance real se calculan desde sus tareas hijas.
          </div>
        }

        <div class="form-grid form-grid-3">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Estado</mat-label>
            <mat-select formControlName="status">
              <mat-option value="TODO">Pendiente</mat-option>
              <mat-option value="IN_PROGRESS">En progreso</mat-option>
              <mat-option value="IN_REVIEW">En revisión</mat-option>
              <mat-option value="DONE">Completada</mat-option>
              <mat-option value="BLOCKED">Bloqueada</mat-option>
              <mat-option value="STOPPED">Detenido</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Prioridad</mat-label>
            <mat-select formControlName="priority">
              <mat-option value="LOW">Baja</mat-option>
              <mat-option value="MEDIUM">Media</mat-option>
              <mat-option value="HIGH">Alta</mat-option>
              <mat-option value="CRITICAL">Crítica</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>% Avance actual</mat-label>
            <input matInput type="number" min="0" max="100" formControlName="progressActual" />
          </mat-form-field>
        </div>

        <div class="form-grid form-grid-3 dates-row">
          <mat-form-field appearance="outline" class="assignee-field" subscriptSizing="dynamic">
            <mat-label>Asignado a *</mat-label>
            <mat-select formControlName="assigneeIds" multiple>
              @for (m of data.members; track m.id) {
                <mat-option [value]="m.id">{{ m.name }}</mat-option>
              }
            </mat-select>
            @if (form.get('assigneeIds')?.hasError('required')) {
              <mat-error>Requerido</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Inicio *</mat-label>
            <input matInput [matDatepicker]="pickerStart" formControlName="startDate" />
            <mat-datepicker-toggle matIconSuffix [for]="pickerStart"></mat-datepicker-toggle>
            <mat-datepicker #pickerStart></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Vencimiento *</mat-label>
            <input matInput [matDatepicker]="pickerDue" formControlName="dueDate" />
            <mat-datepicker-toggle matIconSuffix [for]="pickerDue"></mat-datepicker-toggle>
            <mat-datepicker #pickerDue></mat-datepicker>
          </mat-form-field>
        </div>

        <div class="comments-section">
          <div class="comments-title">
            <mat-icon style="font-size: 18px; width: 18px; height: 18px;">forum</mat-icon>
            Comentarios
          </div>

          <div class="comments-list">
            @if (comments.length === 0) {
              <p class="no-comments">No hay comentarios todavía.</p>
            }
            @for (c of comments; track $index) {
              <div class="comment-item">
                <div class="comment-header">
                  <span class="comment-author">
                    <mat-icon style="font-size: 16px; width: 16px; height: 16px; color: #94A3B8;">account_circle</mat-icon>
                    {{ c.author }}
                  </span>
                  <div class="comment-tools">
                    <input type="datetime-local"
                           class="comment-date-input"
                           [value]="formatCommentDate(c.date)"
                           (change)="updateCommentDate(c, $event)" />
                    <button mat-icon-button class="delete-comment-btn" (click)="deleteComment(c)" matTooltip="Eliminar comentario">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </div>
                <div class="comment-body">{{ c.text }}</div>
              </div>
            }
          </div>

          <div class="add-comment-row">
            <mat-form-field appearance="outline" class="comment-input" subscriptSizing="dynamic">
              <mat-label>Agregar un comentario...</mat-label>
              <textarea matInput [formControl]="newComment" rows="1" (keydown.enter)="$event.preventDefault(); addComment()" placeholder="Escribe aquí..."></textarea>
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="addComment()" type="button" class="comment-button">
              <mat-icon>send</mat-icon> Comentar
            </button>
          </div>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="form.invalid">
        {{ data.task ? 'Guardar Cambios' : 'Crear Tarea' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title { margin: 0; padding: 0 0 8px; }
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(960px, calc(100vw - 64px));
    }
    .full-width { width: 100%; }
    .form-grid { display: grid; gap: 12px; }
    .form-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .form-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .assignee-field { grid-column: span 1; }
    .dates-row { grid-template-columns: 1.3fr 1fr 1fr; }
    .custom-dialog-content { padding: 4px 4px 0 !important; max-height: none !important; overflow: visible !important; }
    .dialog-form mat-form-field { margin-bottom: 0; }
    .derived-note {
      margin: 0;
      color: #1E293B;
      font-size: 12px;
      line-height: 1.35;
      display: flex;
      align-items: center;
      gap: 6px;
      background: #E0F2FE;
      padding: 8px 12px;
      border-radius: 6px;
      border-left: 4px solid #3B82F6;
    }
    .comments-section {
      margin-top: 4px;
      border-top: 1px solid #E2E8F0;
      padding-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .comments-title {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .comments-list { display: flex; flex-direction: column; gap: 8px; }
    .comment-item {
      background: #F8FAFC;
      border-radius: 8px;
      padding: 10px 12px;
      border: 1px solid #E2E8F0;
      transition: background 0.2s;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .comment-item:hover { background: #F1F5F9; }
    .comment-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      align-items: center;
      gap: 8px;
    }
    .comment-author {
      font-weight: 600;
      font-size: 12px;
      color: #0F172A;
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .comment-tools { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .comment-date-input {
      border: 1px solid transparent;
      background: transparent;
      color: #64748B;
      font-size: 11px;
      font-family: inherit;
      padding: 2px 4px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .comment-date-input:hover, .comment-date-input:focus {
      border-color: #CBD5E1;
      background: #FFF;
      outline: none;
    }
    .delete-comment-btn {
      --mdc-icon-button-state-layer-size: 28px;
      width: 28px !important;
      height: 28px !important;
      padding: 0 !important;
      opacity: 0.4;
      transition: opacity 0.2s;
    }
    .comment-item:hover .delete-comment-btn { opacity: 1; }
    .delete-comment-btn mat-icon {
      font-size: 18px !important;
      width: 18px !important;
      height: 18px !important;
      line-height: 18px !important;
      color: #EF4444;
    }
    .comment-body { font-size: 13px; color: #334155; white-space: pre-wrap; line-height: 1.45; }
    .no-comments {
      font-size: 12px;
      color: #94A3B8;
      font-style: italic;
      margin: 0;
      text-align: center;
      padding: 12px;
      background: #F8FAFC;
      border-radius: 8px;
      border: 1px dashed #CBD5E1;
    }
    .add-comment-row {
      display: flex;
      gap: 10px;
      align-items: stretch;
      background: #F8FAFC;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #E2E8F0;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
    }
    .comment-input { flex: 1; }
    .comment-button { margin-top: 4px; white-space: nowrap; }
    .dialog-actions { padding-bottom: 8px; margin-top: 8px; }
    @media (max-width: 900px) {
      .dialog-form { width: calc(100vw - 48px); }
      .form-grid-2, .form-grid-3 { grid-template-columns: 1fr; }
      .assignee-field { grid-column: auto; }
      .dates-row { grid-template-columns: 1fr; }
      .add-comment-row { flex-direction: column; }
    }
  `]
})
export class TaskDialogComponent implements OnInit, OnDestroy {
  data: TaskDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<TaskDialogComponent>);
  private fb = inject(FormBuilder);
  private sub = new Subscription();
  private projectIdControl!: FormControl<number | null>;

  parentOptions: (Task & { _level?: number })[] = [];
  isDerivedTask = !!this.data.task?.hasChildren;

  form = this.fb.group({
    projectId: [null as number | null, Validators.required],
    parentId: [null as number | null],
    title: ['', Validators.required],
    description: [''],
    status: ['TODO'],
    priority: ['MEDIUM'],
    assigneeIds: [[] as number[], Validators.required],
    startDate: [null as Date | null, Validators.required],
    dueDate: [null as Date | null, Validators.required],
    progressActual: [0]
  });

  comments: TaskComment[] = [];
  newComment = new FormControl('');

  ngOnInit() {
    this.projectIdControl = this.form.get('projectId') as FormControl<number | null>;
    this.sub.add(this.projectIdControl.valueChanges
      .pipe(startWith(this.projectIdControl.value), distinctUntilChanged())
      .subscribe(projectId => {
        this.updateParentOptions(projectId);
      }));

    if (this.data.task) {
      const t = this.data.task;
      this.form.patchValue({
        projectId: t.projectId ?? null,
        parentId: t.parentId ?? null,
        title: t.title,
        description: t.description ?? '',
        status: t.status,
        priority: t.priority,
        assigneeIds: t.assigneeIds ?? [],
        startDate: this.parseLocalDate(t.startDate),
        dueDate: this.parseLocalDate(t.dueDate),
        progressActual: t.progressActual ?? 0
      });
      if (this.isDerivedTask) {
        this.form.get('status')?.disable({ emitEvent: false });
        this.form.get('priority')?.disable({ emitEvent: false });
        this.form.get('assigneeIds')?.disable({ emitEvent: false });
        this.form.get('startDate')?.disable({ emitEvent: false });
        this.form.get('dueDate')?.disable({ emitEvent: false });
        this.form.get('progressActual')?.disable({ emitEvent: false });
      }
      if (t.comments) {
        this.comments = t.comments.map((c: TaskComment) => ({
          author: c.author,
          text: c.text,
          date: new Date(c.date)
        }));
      }
    } else if (this.data.defaultParentId != null) {
      const defaultParent = this.data.allTasks.find(t => t.id === this.data.defaultParentId);
      if (defaultParent && defaultParent.projectId) {
        this.form.patchValue({ projectId: defaultParent.projectId });
      }
      this.form.patchValue({ parentId: this.data.defaultParentId });
    }

    this.updateParentOptions(this.form.get('projectId')?.value);
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  private updateParentOptions(projectId: number | null | undefined) {
    if (!projectId) {
      this.parentOptions = [];
      return;
    }

    const editingId = this.data.task?.id;
    const excludedIds = editingId != null ? this.getTaskAndDescendantIds(editingId) : new Set<number>();
    const projectTasks = this.data.allTasks.filter(t => t.projectId === projectId && !excludedIds.has(t.id));
    const childCounts = new Map<number, number>();

    for (const task of projectTasks) {
      childCounts.set(task.id, 0);
    }
    for (const task of projectTasks) {
      if (task.parentId != null && childCounts.has(task.parentId)) {
        childCounts.set(task.parentId, (childCounts.get(task.parentId) ?? 0) + 1);
      }
    }

    const eligible = projectTasks.filter(task =>
      task.parentId == null || (childCounts.get(task.id) ?? 0) > 0
    );

    const map = new Map<number, Task & { _level: number; _children: number[] }>();
    const roots: number[] = [];

    for (const task of eligible) {
      map.set(task.id, { ...task, _level: 0, _children: [] });
    }
    for (const node of map.values()) {
      if (node.parentId != null && map.has(node.parentId)) {
        map.get(node.parentId)!._children.push(node.id);
      } else {
        roots.push(node.id);
      }
    }

    const result: (Task & { _level: number })[] = [];
    const walk = (ids: number[], level: number) => {
      for (const id of ids) {
        const node = map.get(id)!;
        node._level = level;
        result.push(node);
        walk(node._children, level + 1);
      }
    };
    walk(roots, 0);
    this.parentOptions = result;

    const currentParentId = this.form.get('parentId')?.value;
    if (currentParentId != null && !this.parentOptions.some(p => p.id === currentParentId)) {
      this.form.patchValue({ parentId: null }, { emitEvent: false });
    }
  }

  private getTaskAndDescendantIds(taskId: number): Set<number> {
    const excluded = new Set<number>([taskId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const task of this.data.allTasks) {
        if (task.parentId != null && excluded.has(task.parentId) && !excluded.has(task.id)) {
          excluded.add(task.id);
          changed = true;
        }
      }
    }
    return excluded;
  }

  deleteComment(comment: TaskComment) {
    this.comments = this.comments.filter(c => c !== comment);
  }

  formatCommentDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  updateCommentDate(comment: TaskComment, event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      comment.date = new Date(input.value);
    }
  }

  addComment() {
    const text = this.newComment.value;
    if (text && text.trim()) {
      this.comments.push({
        author: 'Tú',
        text: text.trim(),
        date: new Date()
      });
      this.newComment.setValue('');
    }
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const startDate = this.formatLocalDate(v.startDate);
    const dueDate = this.formatLocalDate(v.dueDate);
    const progressActual = Number(v.progressActual ?? 0);
    this.ref.close({
      parentId: v.parentId ?? null,
      title: v.title,
      description: v.description || undefined,
      status: v.status,
      priority: v.priority,
      projectId: v.projectId || undefined,
      assigneeIds: (v.assigneeIds && v.assigneeIds.length > 0) ? v.assigneeIds : undefined,
      startDate,
      dueDate,
      progressActual: Math.max(0, Math.min(100, progressActual)),
      comments: this.comments
    });
  }

  private parseLocalDate(value?: string): Date | null {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  private formatLocalDate(value: Date | string | null | undefined): string | undefined {
    if (!value) return undefined;
    const date = value instanceof Date ? value : this.parseLocalDate(value);
    if (!date) return undefined;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
