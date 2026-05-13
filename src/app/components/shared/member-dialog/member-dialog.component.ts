import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Member } from '../../../models/member.model';

@Component({
  selector: 'app-member-dialog',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Editar miembro' : 'Nuevo miembro' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nombre *</mat-label>
          <input matInput formControlName="name" />
          @if (form.get('name')?.hasError('required')) {
            <mat-error>El nombre es requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email *</mat-label>
          <input matInput formControlName="email" type="email" />
          @if (form.get('email')?.hasError('required')) {
            <mat-error>El email es requerido</mat-error>
          }
          @if (form.get('email')?.hasError('email')) {
            <mat-error>Email inválido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Rol</mat-label>
          <input matInput formControlName="role" placeholder="ej: Backend Dev, Frontend Dev, QA..." />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="form.invalid">
        {{ data ? 'Guardar' : 'Agregar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; min-width: 360px; }
    .full-width { width: 100%; }
  `]
})
export class MemberDialogComponent implements OnInit {
  data: Member | null = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<MemberDialogComponent>);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['']
  });

  ngOnInit() {
    if (this.data) {
      this.form.patchValue({
        name: this.data.name,
        email: this.data.email,
        role: this.data.role ?? ''
      });
    }
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.value;
    this.ref.close({ name: v.name, email: v.email, role: v.role || undefined });
  }
}
