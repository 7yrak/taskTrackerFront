import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { Task, TaskComment } from '../../../models/task.model';
import { TaskService } from '../../../services/task.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

export interface TaskCommentsDialogData {
  task: Task;
}

@Component({
  selector: 'app-task-comments-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-shell">
      <header class="dialog-header">
        <div class="header-copy">
          <div class="eyebrow">Comentarios de tarea</div>
          <h2 mat-dialog-title class="dialog-title">{{ data.task.title }}</h2>
          <p class="dialog-subtitle">
            {{ commentSummaryLabel() }} · añade notas claras para no perder contexto.
          </p>
        </div>

        <button mat-icon-button type="button" class="close-button" (click)="close()" matTooltip="Cerrar" aria-label="Cerrar comentarios">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <mat-dialog-content class="dialog-content">
        <div class="comments-list" #commentsList>
          @if (comments.length === 0) {
            <div class="empty-state">
              <mat-icon>forum</mat-icon>
              <div class="empty-title">Aún no hay comentarios</div>
              <div class="empty-text">Escribe el primero abajo para empezar la conversación.</div>
            </div>
          }

          @for (comment of comments; track comment.id ?? $index) {
            <article class="comment-card" [class.is-editing]="isEditingComment(comment)">
              <div class="comment-avatar" [matTooltip]="comment.author">
                {{ getAvatarLabel(comment.author) }}
              </div>

              <div class="comment-content">
                <div class="comment-meta">
                  <div class="comment-author">{{ comment.author }}</div>
                  <div class="comment-tools">
                    <div class="comment-date">{{ comment.date | date:'dd/MM/yy HH:mm' }}</div>
                    <div class="comment-actions" *ngIf="!isEditingComment(comment)">
                      <button
                        mat-icon-button
                        type="button"
                        class="comment-action-btn"
                        (click)="startEdit(comment, $event)"
                        [disabled]="saving || editingSaving || deletingCommentId === comment.id"
                        matTooltip="Editar comentario"
                        [attr.aria-label]="'Editar comentario'">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button
                        mat-icon-button
                        type="button"
                        class="comment-action-btn danger"
                        (click)="confirmDeleteComment(comment, $event)"
                        [disabled]="saving || editingSaving || deletingCommentId === comment.id"
                        matTooltip="Eliminar comentario"
                        [attr.aria-label]="'Eliminar comentario'">
                        @if (deletingCommentId === comment.id) {
                          <mat-icon class="spinning-icon">sync</mat-icon>
                        } @else {
                          <mat-icon>delete_outline</mat-icon>
                        }
                      </button>
                    </div>
                  </div>
                </div>

                @if (isEditingComment(comment)) {
                  <div class="comment-edit-box">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="comment-edit-field">
                      <mat-label>Editar comentario</mat-label>
                      <textarea
                        #editCommentTextarea
                        matInput
                        rows="3"
                        [formControl]="editTextControl"
                        placeholder="Actualiza el comentario"
                        (keydown)="onEditTextareaKeydown($event, comment)"
                        (input)="errorMessage = ''"></textarea>
                      @if (editTextControl.touched && editTextControl.hasError('required')) {
                        <mat-error>Escribe un comentario para guardarlo.</mat-error>
                      }
                      @if (editTextControl.touched && editTextControl.hasError('maxlength')) {
                        <mat-error>El comentario es demasiado largo.</mat-error>
                      }
                    </mat-form-field>

                    <div class="comment-edit-actions">
                      <button mat-stroked-button type="button" (click)="cancelEdit()" [disabled]="editingSaving">
                        Cancelar
                      </button>
                      <button mat-flat-button color="primary" type="button" (click)="saveEdit(comment)" [disabled]="editingSaving || editCommentForm.invalid">
                        <mat-icon [class.spinning-icon]="editingSaving">{{ editingSaving ? 'sync' : 'check' }}</mat-icon>
                        <span>{{ editingSaving ? 'Guardando...' : 'Guardar' }}</span>
                      </button>
                    </div>
                  </div>
                } @else {
                  <div class="comment-text">{{ comment.text }}</div>
                }
              </div>
            </article>
          }
        </div>
      </mat-dialog-content>

      <form class="composer" [formGroup]="commentForm" (ngSubmit)="sendComment()">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="composer-field">
          <mat-label>Nuevo comentario</mat-label>
          <textarea
            #commentTextarea
            matInput
            rows="3"
            [formControl]="textControl"
            placeholder="Escribe un comentario útil, claro y accionable"
            (keydown)="onTextareaKeydown($event)"
            (input)="errorMessage = ''"></textarea>
          <mat-hint>Ctrl + Enter para publicar</mat-hint>
          @if (textControl.touched && textControl.hasError('required')) {
            <mat-error>Escribe un comentario para publicarlo.</mat-error>
          }
          @if (textControl.touched && textControl.hasError('maxlength')) {
            <mat-error>El comentario es demasiado largo.</mat-error>
          }
        </mat-form-field>

        <div class="composer-actions">
          <button mat-stroked-button type="button" (click)="close()">Cerrar</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="saving || commentForm.invalid">
            <mat-icon [class.spinning-icon]="saving">{{ saving ? 'sync' : 'send' }}</mat-icon>
            <span>{{ saving ? 'Publicando...' : 'Publicar' }}</span>
          </button>
        </div>

        @if (errorMessage) {
          <div class="error-banner">{{ errorMessage }}</div>
        }
      </form>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: min(760px, calc(100vw - 32px));
      max-height: calc(90vh - 24px);
    }

    .dialog-shell {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
      max-height: calc(90vh - 24px);
      padding: 4px 2px 2px;
    }

    .dialog-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 0 2px;
    }

    .header-copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-secondary);
    }

    .dialog-title {
      margin: 0;
      padding: 0;
      font-size: 22px;
      line-height: 1.2;
      color: var(--text-primary);
      word-break: break-word;
    }

    .dialog-subtitle {
      margin: 0;
      color: var(--text-secondary);
      font-size: 13px;
      line-height: 1.45;
    }

    .close-button {
      flex-shrink: 0;
      color: var(--text-muted);
      margin-right: -6px;
      margin-top: -4px;
    }

    .dialog-content {
      padding: 0 !important;
      margin: 0 !important;
      overflow: hidden;
      flex: 1;
      min-height: 0;
    }

    .comments-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: min(44vh, 420px);
      overflow-y: auto;
      padding: 4px 2px 2px;
    }

    .comments-list::-webkit-scrollbar {
      width: 6px;
    }

    .comments-list::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 999px;
    }

    .comment-card {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      background: linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 82%, transparent), var(--bg-card));
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px 14px;
      box-shadow: var(--shadow-sm);
    }

    .comment-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: var(--accent-text);
      background: radial-gradient(circle at 30% 30%, var(--accent-dim), var(--accent));
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.16);
    }

    .comment-content {
      min-width: 0;
      flex: 1;
    }

    .comment-meta {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: baseline;
      margin-bottom: 6px;
    }

    .comment-author {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .comment-date {
      font-size: 11px;
      color: var(--text-secondary);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .comment-tools {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      margin-left: auto;
    }

    .comment-actions {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      opacity: 0.36;
      transition: opacity var(--transition);
    }

    .comment-card:hover .comment-actions,
    .comment-card.is-editing .comment-actions {
      opacity: 1;
    }

    .comment-action-btn {
      --mdc-icon-button-state-layer-size: 28px;
      width: 28px !important;
      height: 28px !important;
      padding: 0 !important;
      color: var(--text-muted);
      flex-shrink: 0;

      .mat-icon {
        font-size: 17px !important;
        width: 17px !important;
        height: 17px !important;
        line-height: 17px !important;
      }

      &:hover {
        color: var(--accent);
        background: var(--accent-dim);
      }

      &.danger:hover {
        color: var(--red);
        background: var(--red-soft);
      }
    }

    .comment-text {
      font-size: 13px;
      line-height: 1.55;
      color: var(--text-primary);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .comment-edit-box {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 2px;
    }

    .comment-edit-field {
      width: 100%;
      margin: 0;
    }

    .comment-edit-field textarea {
      min-height: 90px;
      resize: vertical;
    }

    .comment-edit-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 140px;
      border: 1px dashed var(--border);
      border-radius: 14px;
      background: color-mix(in srgb, var(--bg-surface) 72%, transparent);
      color: var(--text-secondary);
      text-align: center;
      padding: 24px;
    }

    .empty-state mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--accent);
    }

    .empty-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .empty-text {
      font-size: 12px;
      line-height: 1.45;
      max-width: 320px;
    }

    .composer {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: color-mix(in srgb, var(--bg-surface) 78%, var(--bg-card));
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
    }

    .composer-field {
      width: 100%;
      margin: 0;
    }

    .composer-field textarea {
      min-height: 92px;
      resize: vertical;
    }

    .composer-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }

    .spinning-icon {
      animation: spin 1s linear infinite;
    }

    .error-banner {
      border: 1px solid var(--red);
      background: var(--red-soft);
      color: var(--red);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 600;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 640px) {
      :host {
        width: calc(100vw - 24px);
      }

      .dialog-shell {
        gap: 12px;
      }

      .dialog-header {
        gap: 8px;
      }

      .dialog-title {
        font-size: 20px;
      }

      .comments-list {
        max-height: 40vh;
      }

      .comment-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }

      .comment-date {
        white-space: normal;
      }

      .composer {
        padding: 12px;
      }

      .composer-actions {
        justify-content: stretch;
      }

      .composer-actions button {
        flex: 1 1 100%;
      }
    }
  `]
})
export class TaskCommentsDialogComponent implements AfterViewInit {
  data: TaskCommentsDialogData = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<TaskCommentsDialogComponent>);
  private dialog = inject(MatDialog);
  private taskService = inject(TaskService);

  @ViewChild('commentTextarea') commentTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('editCommentTextarea') editCommentTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('commentsList') commentsList?: ElementRef<HTMLDivElement>;

  comments: TaskComment[] = [];
  saving = false;
  editingSaving = false;
  editingCommentId: number | null = null;
  deletingCommentId: number | null = null;
  errorMessage = '';

  commentForm = new FormGroup({
    text: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2000)]
    })
  });

  editCommentForm = new FormGroup({
    text: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2000)]
    })
  });

  get textControl(): FormControl<string> {
    return this.commentForm.controls.text;
  }

  get editTextControl(): FormControl<string> {
    return this.editCommentForm.controls.text;
  }

  commentSummaryLabel(): string {
    return this.comments.length === 1 ? '1 comentario' : `${this.comments.length} comentarios`;
  }

  ngAfterViewInit(): void {
    this.loadComments();
    setTimeout(() => this.focusComposer(), 0);
  }

  close(): void {
    this.dialogRef.close();
  }

  isEditingComment(comment: TaskComment): boolean {
    return this.editingCommentId === comment.id;
  }

  sendComment(): void {
    if (this.saving) {
      return;
    }

    this.commentForm.markAllAsTouched();
    if (this.commentForm.invalid) {
      return;
    }

    const text = this.textControl.value.trim();
    if (!text) {
      this.textControl.setErrors({ required: true });
      this.textControl.markAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    this.taskService.addComment(this.data.task.id, { text }).pipe(
      finalize(() => {
        this.saving = false;
      })
    ).subscribe({
      next: updatedTask => {
        this.applyComments(updatedTask.comments ?? []);
        this.commentForm.reset({ text: '' });
        setTimeout(() => this.focusComposer(), 0);
      },
      error: err => {
        this.errorMessage = err?.error?.message || 'No se pudo publicar el comentario. Intenta de nuevo.';
      }
    });
  }

  onTextareaKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.sendComment();
    }
  }

  startEdit(comment: TaskComment, event?: MouseEvent): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.errorMessage = '';
    this.editingCommentId = comment.id ?? null;
    this.editCommentForm.reset({ text: comment.text });
    this.editCommentForm.markAsPristine();
    this.editCommentForm.markAsUntouched();
    setTimeout(() => this.focusEditComposer(), 0);
  }

  cancelEdit(): void {
    this.editingCommentId = null;
    this.editingSaving = false;
    this.editCommentForm.reset({ text: '' });
    this.editCommentForm.markAsPristine();
    this.editCommentForm.markAsUntouched();
  }

  saveEdit(comment: TaskComment): void {
    if (this.editingSaving || comment.id == null) {
      return;
    }

    this.editCommentForm.markAllAsTouched();
    if (this.editCommentForm.invalid) {
      return;
    }

    const text = this.editTextControl.value.trim();
    if (!text) {
      this.editTextControl.setErrors({ required: true });
      this.editTextControl.markAsTouched();
      return;
    }

    if (text === comment.text.trim()) {
      this.cancelEdit();
      return;
    }

    this.editingSaving = true;
    this.errorMessage = '';

    this.taskService.updateComment(this.data.task.id, comment.id, { text }).pipe(
      finalize(() => {
        this.editingSaving = false;
      })
    ).subscribe({
      next: updatedTask => {
        this.applyComments(updatedTask.comments ?? [], false);
        this.cancelEdit();
      },
      error: err => {
        this.errorMessage = err?.error?.message || 'No se pudo actualizar el comentario.';
      }
    });
  }

  onEditTextareaKeydown(event: KeyboardEvent, comment: TaskComment): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEdit();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.saveEdit(comment);
    }
  }

  confirmDeleteComment(comment: TaskComment, event?: MouseEvent): void {
    event?.stopPropagation();
    event?.preventDefault();

    if (comment.id == null) {
      return;
    }

    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: { message: `¿Eliminar el comentario de "${comment.author}"? Esta acción no se puede deshacer.` }
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.deleteComment(comment);
      }
    });
  }

  deleteComment(comment: TaskComment): void {
    if (this.deletingCommentId != null || comment.id == null) {
      return;
    }

    this.deletingCommentId = comment.id;
    this.errorMessage = '';

    this.taskService.deleteComment(this.data.task.id, comment.id).pipe(
      finalize(() => {
        this.deletingCommentId = null;
      })
    ).subscribe({
      next: updatedTask => {
        this.applyComments(updatedTask.comments ?? [], false);
        if (this.editingCommentId === comment.id) {
          this.cancelEdit();
        }
      },
      error: err => {
        this.errorMessage = err?.error?.message || 'No se pudo eliminar el comentario.';
      }
    });
  }

  getAvatarLabel(author: string): string {
    const cleaned = (author || 'Tú').trim();
    if (!cleaned) {
      return 'TÚ';
    }

    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  private loadComments(): void {
    this.applyComments(this.data.task.comments ?? []);
  }

  private applyComments(comments: TaskComment[], scrollToBottom = true): void {
    this.comments = comments.map(comment => ({
      ...comment,
      date: comment.date ? new Date(comment.date) : new Date()
    }));
    this.data.task.comments = this.comments.map(comment => ({ ...comment }));
    if (scrollToBottom) {
      setTimeout(() => this.scrollToBottom(), 0);
    }
  }

  private focusComposer(): void {
    const textarea = this.commentTextarea?.nativeElement;
    if (!textarea) {
      return;
    }

    textarea.focus();
    const length = textarea.value.length;
    try {
      textarea.setSelectionRange(length, length);
    } catch {
      // Ignorar si el navegador no permite ajustar la selección.
    }
  }

  private focusEditComposer(): void {
    const textarea = this.editCommentTextarea?.nativeElement;
    if (!textarea) {
      return;
    }

    textarea.focus();
    const length = textarea.value.length;
    try {
      textarea.setSelectionRange(length, length);
    } catch {
      // Ignorar si el navegador no permite ajustar la selección.
    }
  }

  private scrollToBottom(): void {
    const list = this.commentsList?.nativeElement;
    if (!list) {
      return;
    }

    list.scrollTop = list.scrollHeight;
  }
}
