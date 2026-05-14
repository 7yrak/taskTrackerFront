import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { Project, ProjectStatus } from '../../../models/project.model';

const PROJECT_COLORS = [
  '#3f51b5', '#e91e63', '#009688', '#ff9800', '#9c27b0',
  '#2196f3', '#4caf50', '#f44336', '#795548', '#607d8b'
];

@Component({
  selector: 'app-project-dialog',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Editar proyecto' : 'Nuevo proyecto' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nombre *</mat-label>
          <input matInput formControlName="name" placeholder="Nombre del proyecto" />
          @if (form.get('name')?.hasError('required')) {
            <mat-error>El nombre es requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Descripción</mat-label>
          <textarea matInput formControlName="description" rows="3"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Estado</mat-label>
          <mat-select formControlName="status">
            <mat-option value="INITIATED">Iniciado</mat-option>
            <mat-option value="PLANNING">Planificación</mat-option>
            <mat-option value="IN_PROGRESS">En Ejecución</mat-option>
            <mat-option value="ON_HOLD">Detenido</mat-option>
            <mat-option value="MONITORING">Seguimiento y Control</mat-option>
            <mat-option value="COMPLETED">Finalizado</mat-option>
            <mat-option value="CLOSED">Cerrado</mat-option>
          </mat-select>
        </mat-form-field>

        <div class="color-section">
          <label class="color-label">Color del proyecto</label>
          <div class="color-grid">
            @for (color of colors; track color) {
              <div class="color-swatch"
                   [style.background-color]="color"
                   [class.selected]="form.get('color')?.value === color"
                   (click)="form.get('color')?.setValue(color)">
                @if (form.get('color')?.value === color) {
                  <span class="check">✓</span>
                }
              </div>
            }
          </div>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="form.invalid">
        {{ data ? 'Guardar' : 'Crear' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; min-width: 400px; }
    .full-width { width: 100%; }
    .color-label { font-size: 14px; color: #555; margin-bottom: 8px; display: block; }
    .color-section { margin-top: 4px; }
    .color-grid { display: flex; flex-wrap: wrap; gap: 10px; }
    .color-swatch {
      width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.1s;
      &:hover { transform: scale(1.15); }
      &.selected { outline: 3px solid rgba(0,0,0,0.4); transform: scale(1.15); }
      .check { color: white; font-weight: bold; font-size: 14px; }
    }
  `]
})
export class ProjectDialogComponent implements OnInit {
  data: Project | null = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ProjectDialogComponent>);
  private fb = inject(FormBuilder);

  colors = PROJECT_COLORS;

  form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    color: [PROJECT_COLORS[0]],
    status: [ProjectStatus.INITIATED]
  });

  ngOnInit() {
    if (this.data) {
      this.form.patchValue({
        name: this.data.name,
        description: this.data.description ?? '',
        color: this.data.color,
        status: this.data.status || ProjectStatus.INITIATED
      });
    }
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.value;
    this.ref.close({ name: v.name, description: v.description || undefined, color: v.color, status: v.status });
  }
}
