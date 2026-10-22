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
  client: string;
  hours: number;
  sentToManagement: boolean;
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
  columns = ['date', 'person', 'hours', 'topic', 'client', 'project', 'status', 'actions'];
  projectFilter: number | null = null;
  personFilter = '';
  from = '';
  to = '';
  search = '';
  pendingOnly = false;
  loading = true;
  busy = false;
  error = '';
  success = '';
  modal = false;
  form: Entry = this.empty();
  editingId: number | null = null;
  inlineId: number | null = null;
  empty(): Entry {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return {
      projectId: this.projectFilter ?? null,
      date,
      person: '',
      topic: '',
      client: 'Por confirmar',
      hours: 1,
      sentToManagement: false,
    };
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
  private personKey(value: string) {
    // Preserve ñ as a distinct letter while ignoring accents on vowels.
    return this.cleanPerson(value).toLocaleLowerCase('es').normalize('NFD')
      .replace(/ñ/g, 'ñ').replace(/[̀-ͯ]/g, '');
  }
  private cleanPerson(value: string) {
    return (value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  }
  private get personNames() {
    const names = new Map<string, string>();
    // Prefer the official team name, then retain historical people.
    for (const name of [...this.members.map((m) => m.name), ...this.entries.map((e) => e.person)]) {
      const key = this.personKey(name);
      if (key && !names.has(key)) names.set(key, this.cleanPerson(name));
    }
    return names;
  }
  personName(value: string) {
    return this.personNames.get(this.personKey(value)) ?? this.cleanPerson(value);
  }
  get people() {
    return [...this.personNames.values()].sort((a, b) => a.localeCompare(b, 'es'));
  }
  private currentMonthRange() {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')!.value;
    const month = parts.find((part) => part.type === 'month')!.value;
    const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
    return { from: `${year}-${month}-01`, to: `${year}-${month}-${lastDay}` };
  }
  get thisMonthActive() {
    const range = this.currentMonthRange();
    return this.from === range.from && this.to === range.to;
  }
  toggleThisMonth() {
    const range = this.currentMonthRange();
    if (this.thisMonthActive) {
      this.from = '';
      this.to = '';
    } else {
      this.from = range.from;
      this.to = range.to;
    }
  }
  clearFilters() {
    this.projectFilter = null;
    this.personFilter = '';
    this.from = '';
    this.to = '';
    this.search = '';
    this.pendingOnly = false;
  }
  private isPending(entry: Entry) {
    return [entry.topic, entry.client].some((value) => {
      const text = (value ?? '').trim().toLocaleLowerCase('es');
      return !text || text === 'por confirmar';
    });
  }
  get filtered() {
    const q = this.search.trim().toLocaleLowerCase();
    return this.entries.filter(
      (e) =>
        (!this.projectFilter || e.projectId === this.projectFilter) &&
        (!this.personFilter || this.personKey(e.person) === this.personKey(this.personFilter)) &&
        (!this.pendingOnly || this.isPending(e)) &&
        (!this.from || e.date >= this.from) &&
        (!this.to || e.date <= this.to) &&
        (!q ||
          `${e.topic} ${e.person} ${e.projectName} ${e.client}`.toLocaleLowerCase().includes(q)),
    );
  }
  get total() {
    return Math.round(this.filtered.reduce((sum, e) => sum + Number(e.hours), 0) * 100) / 100;
  }
  get summary() {
    const people = new Map<string, number>();
    for (const e of this.filtered) {
      const person = this.personName(e.person);
      people.set(person, (people.get(person) ?? 0) + Number(e.hours));
    }
    return [...people].map(([person, hours]) => ({ person, hours: Math.round(hours * 100) / 100 }));
  }
  open(entry?: Entry, inline = false) {
    if (this.busy) return;
    this.error = '';
    this.form = entry ? { ...entry, person: this.personName(entry.person) } : this.empty();
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
      !!this.form.client.trim() &&
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
        person: this.personName(this.form.person),
        topic: this.form.topic.trim(),
        client: this.form.client.trim(),
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
  async downloadExcel() {
    if (this.exporting || this.busy || !this.entries.length) return;
    this.exporting = true;
    this.error = '';
    try {
      const file = await firstValueFrom(
        this.http.post(
          `${this.base}/export/excel`,
          this.entries.map((e) => e.id),
          { responseType: 'blob' },
        ),
      );
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'horas-extras.xlsx';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.error = 'No se pudo exportar a Excel';
    } finally {
      this.exporting = false;
      this.change.markForCheck();
    }
  }
  exporting = false;
  async importExcel(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.busy || this.exporting) return;
    this.busy = true;
    this.error = '';
    this.success = '';
    try {
      const data = new FormData();
      data.append('file', file);
      this.entries = await firstValueFrom(
        this.http.post<Entry[]>(`${this.base}/import/excel`, data),
      );
      this.clearFilters();
      this.success = `Carga completa: ${this.entries.length} registros. Se reemplazaron todas las horas anteriores.`;
    } catch (e: any) {
      this.error = e.error?.message || 'No se pudo cargar el Excel. Se conservaron las horas anteriores.';
    } finally {
      this.busy = false;
      this.change.markForCheck();
    }
  }
  async downloadPdf() {
    if (this.exporting || this.busy || !this.filtered.length) return;
    const rows = this.filtered.map((e) => [
      e.date,
      this.personName(e.person),
      String(e.hours),
      e.topic,
      e.client,
      e.projectName ?? '',
    ]);
    const total = this.total;
    this.exporting = true;
    this.error = '';
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(16);
      doc.text('Horas extras', 14, 16);
      doc.setFontSize(10);
      doc.text(`${rows.length} registros | Total: ${total} horas`, 14, 24);
      autoTable(doc, {
        startY: 30,
        head: [['Fecha', 'Persona', 'Horas', 'Tema/Motivo', 'Cliente', 'Proyecto']],
        body: rows,
        styles: { fontSize: 9, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 25 }, 2: { cellWidth: 18 }, 3: { cellWidth: 85 } },
        didDrawPage: () => {
          doc.text(`Página ${doc.getNumberOfPages()}`, 14, doc.internal.pageSize.height - 8);
        },
      });
      doc.save('horas-extras.pdf');
    } catch {
      this.error = 'No se pudo exportar a PDF';
    } finally {
      this.exporting = false;
      this.change.markForCheck();
    }
  }
}
