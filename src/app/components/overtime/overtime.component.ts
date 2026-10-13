import { Component, inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { A11yModule } from '@angular/cdk/a11y';
import { firstValueFrom, forkJoin } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';
import { ProjectService } from '../../services/project.service';
import { MemberService } from '../../services/member.service';
import { Project } from '../../models/project.model';
import { Member } from '../../models/member.model';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';
interface Entry {
  id?: number;
  projectId: number | null;
  projectName?: string;
  date: string;
  person: string;
  topic: string;
  hours: number;
}
@Component({
  selector: 'app-overtime',
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    A11yModule,
  ],
  templateUrl: './overtime.component.html',
  styleUrl: './overtime.component.scss',
})
export class OvertimeComponent implements OnInit {
  private http = inject(HttpClient);
  private projectsApi = inject(ProjectService);
  private membersApi = inject(MemberService);
  private change = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  private base = `${API_BASE_URL}/overtime`;
  entries: Entry[] = [];
  projects: Project[] = [];
  members: Member[] = [];
  columns = ['date', 'project', 'person', 'topic', 'hours', 'actions'];
  projectFilter: number | null = null;
  personFilter = '';
  from = '';
  to = '';
  search = '';
  loading = true;
  busy = false;
  error = '';
  modal = false;
  form: Entry = this.empty();
  editingId: number | null = null;
  inlineId: number | null = null;
  empty(): Entry {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return { projectId: this.projectFilter ?? null, date, person: '', topic: '', hours: 1 };
  }
  ngOnInit() {
    this.load();
  }
  load() {
    this.loading = true;
    forkJoin({
      entries: this.http.get<Entry[]>(this.base),
      projects: this.projectsApi.getAll(),
      members: this.membersApi.getAll(),
    }).subscribe({
      next: (r) => {
        Object.assign(this, r);
        this.loading = false;
        this.change.markForCheck();
      },
      error: (e) => {
        this.error = e.error?.message || 'No se pudieron cargar las horas extras';
        this.loading = false;
        this.change.markForCheck();
      },
    });
  }
  get people() {
    return [
      ...new Set([...this.entries.map((e) => e.person), ...this.members.map((m) => m.name)]),
    ].sort();
  }
  get filtered() {
    const q = this.search.trim().toLocaleLowerCase();
    return this.entries.filter(
      (e) =>
        (!this.projectFilter || e.projectId === this.projectFilter) &&
        (!this.personFilter || e.person === this.personFilter) &&
        (!this.from || e.date >= this.from) &&
        (!this.to || e.date <= this.to) &&
        (!q || `${e.topic} ${e.person} ${e.projectName}`.toLocaleLowerCase().includes(q)),
    );
  }
  get total() {
    return Math.round(this.filtered.reduce((sum, e) => sum + Number(e.hours), 0) * 100) / 100;
  }
  get summary() {
    const people = new Map<string, number>();
    for (const e of this.filtered)
      people.set(e.person, (people.get(e.person) ?? 0) + Number(e.hours));
    return [...people].map(([person, hours]) => ({ person, hours: Math.round(hours * 100) / 100 }));
  }
  open(entry?: Entry, inline = false) {
    if (this.busy) return;
    this.error = '';
    this.form = entry ? { ...entry } : this.empty();
    this.editingId = entry?.id ?? null;
    this.inlineId = inline ? this.editingId : null;
    this.modal = !inline;
  }
  cancel() {
    if (this.busy) return;
    this.modal = false;
    this.inlineId = null;
    this.editingId = null;
  }
  get valid() {
    return (
      !!this.form.projectId &&
      !!this.form.date &&
      !!this.form.person.trim() &&
      !!this.form.topic.trim() &&
      Number(this.form.hours) > 0 &&
      Number(this.form.hours) <= 24
    );
  }
  async save() {
    if (!this.valid || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const request = {
        ...this.form,
        person: this.form.person.trim(),
        topic: this.form.topic.trim(),
        hours: Number(this.form.hours),
      };
      const saved = await firstValueFrom(
        this.editingId
          ? this.http.put<Entry>(`${this.base}/${this.editingId}`, request)
          : this.http.post<Entry>(this.base, request),
      );
      this.entries = [saved, ...this.entries.filter((e) => e.id !== saved.id)].sort(
        (a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0),
      );
      this.modal = false;
      this.inlineId = null;
      this.editingId = null;
    } catch (e: any) {
      this.error = e.error?.message || 'No se pudo guardar';
    } finally {
      this.busy = false;
      this.change.markForCheck();
    }
  }
  remove(e: Entry) {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Eliminar horas extras',
          message: `¿Eliminar el registro de ${e.person} (${e.hours} horas)?`,
        },
      })
      .afterClosed()
      .subscribe(async (confirmed) => {
        if (!confirmed) return;
        this.busy = true;
        try {
          await firstValueFrom(this.http.delete(`${this.base}/${e.id}`));
          this.entries = this.entries.filter((row) => row.id !== e.id);
        } catch (error: any) {
          this.error = error.error?.message || 'No se pudo eliminar';
        } finally {
          this.busy = false;
          this.change.markForCheck();
        }
      });
  }
  download() {
    const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['Fecha', 'Proyecto', 'Persona', 'Tema / actividad', 'Horas'],
      ...this.filtered.map((e) => [e.date, e.projectName, e.person, e.topic, e.hours]),
    ];
    const csv =
      '\uFEFF' +
      rows
        .map((row) =>
          row
            .map((value) =>
              cell(typeof value === 'string' && /^[=+@-]/.test(value) ? `'${value}` : value),
            )
            .join(';'),
        )
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'horas-extras.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
