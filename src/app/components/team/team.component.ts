import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MemberService } from '../../services/member.service';
import { Member } from '../../models/member.model';
import { MemberDialogComponent } from '../shared/member-dialog/member-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

const ROLE_STYLES: Record<string, { bg: string; fg: string; border: string }> = {
  'LIDER': { bg: '#DBEAFE', fg: '#1D4ED8', border: '#93C5FD' },
  'LEAD': { bg: '#DBEAFE', fg: '#1D4ED8', border: '#93C5FD' },
  'PM': { bg: '#EDE9FE', fg: '#6D28D9', border: '#C4B5FD' },
  'PROJECT MANAGER': { bg: '#EDE9FE', fg: '#6D28D9', border: '#C4B5FD' },
  'DESARROLLADOR': { bg: '#DCFCE7', fg: '#166534', border: '#86EFAC' },
  'DEV': { bg: '#DCFCE7', fg: '#166534', border: '#86EFAC' },
  'QA': { bg: '#FEF3C7', fg: '#92400E', border: '#FCD34D' },
  'ANALISTA': { bg: '#E0F2FE', fg: '#075985', border: '#7DD3FC' },
  'DISEÑO': { bg: '#FCE7F3', fg: '#BE185D', border: '#F9A8D4' },
  'UX': { bg: '#FCE7F3', fg: '#BE185D', border: '#F9A8D4' },
  'OPS': { bg: '#E2E8F0', fg: '#334155', border: '#CBD5E1' }
};

const ROLE_PALETTE = [
  { bg: '#E0F2FE', fg: '#075985', border: '#7DD3FC' },
  { bg: '#DCFCE7', fg: '#166534', border: '#86EFAC' },
  { bg: '#FEF3C7', fg: '#92400E', border: '#FCD34D' },
  { bg: '#FCE7F3', fg: '#BE185D', border: '#F9A8D4' },
  { bg: '#EDE9FE', fg: '#6D28D9', border: '#C4B5FD' },
  { bg: '#E2E8F0', fg: '#334155', border: '#CBD5E1' }
];

@Component({
  selector: 'app-team',
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatChipsModule, MatSnackBarModule, MatTooltipModule,
    MatTableModule, MatSortModule, MatPaginatorModule, MatFormFieldModule, MatInputModule
  ],
  templateUrl: './team.component.html',
  styleUrl: './team.component.scss'
})
export class TeamComponent {
  private memberService = inject(MemberService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  private refresh$ = new Subject<void>();
  searchTerm = signal('');
  pageIndex = signal(0);
  pageSize = signal(8);
  sortState = signal<Sort>({ active: 'member', direction: 'asc' });
  pageSizeOptions = [5, 8, 12, 20];

  members = toSignal(
    this.refresh$.pipe(
      startWith(undefined),
      switchMap(() => this.memberService.getAll())
    ),
    { initialValue: [] as Member[] }
  );

  filteredMembers = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const list = this.members();
    if (!query) return list;
    return list.filter(member => {
      const haystack = [
        member.name,
        member.email,
        member.role ?? '',
        ...(member.projectNames ?? [])
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  });

  sortedMembers = computed(() => {
    const list = [...this.filteredMembers()];
    const { active, direction } = this.sortState();
    if (!direction) return list;

    const multiplier = direction === 'asc' ? 1 : -1;
    return list.sort((a, b) => this.compareSortValues(
      this.sortValue(a, active),
      this.sortValue(b, active)
    ) * multiplier);
  });

  pagedMembers = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedMembers().slice(start, start + this.pageSize());
  });

  displayedColumns = ['member', 'role', 'projects', 'tasks', 'actions'];

  openCreate() {
    this.dialog.open(MemberDialogComponent, { width: '440px', data: null })
      .afterClosed().subscribe(result => {
        if (result) {
          this.memberService.create(result).subscribe({
            next: () => { this.refresh$.next(); this.snack.open('Miembro agregado', 'OK', { duration: 2500 }); },
            error: (e) => this.snack.open(e.error?.message || 'Error', 'OK', { duration: 3000 })
          });
        }
      });
  }

  openEdit(member: Member) {
    this.dialog.open(MemberDialogComponent, { width: '440px', data: member })
      .afterClosed().subscribe(result => {
        if (result) {
          this.memberService.update(member.id, result).subscribe({
            next: () => { this.refresh$.next(); this.snack.open('Miembro actualizado', 'OK', { duration: 2500 }); },
            error: (e) => this.snack.open(e.error?.message || 'Error', 'OK', { duration: 3000 })
          });
        }
      });
  }

  confirmDelete(member: Member) {
    this.dialog.open(ConfirmDialogComponent, {
      data: { message: `¿Eliminar a "${member.name}" del equipo?` }
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.memberService.delete(member.id).subscribe({
          next: () => { this.refresh$.next(); this.snack.open('Miembro eliminado', 'OK', { duration: 2500 }); },
          error: (e) => this.snack.open(e.error?.message || 'Error', 'OK', { duration: 3000 })
        });
      }
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  setSearchTerm(value: string) {
    this.searchTerm.set(value);
    this.pageIndex.set(0);
  }

  onSortChange(sort: Sort) {
    this.sortState.set(sort);
    this.pageIndex.set(0);
  }

  onPageChange(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  private sortValue(member: Member, active: string): string | number {
    switch (active) {
      case 'member':
        return member.name ?? '';
      case 'role':
        return member.role ?? '';
      case 'projects':
        return member.projectNames?.length ?? 0;
      case 'tasks':
        return member.taskCount ?? 0;
      default:
        return member.name ?? '';
    }
  }

  private compareSortValues(a: string | number, b: string | number): number {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), 'es', { sensitivity: 'base', numeric: true });
  }

  roleTone(role?: string): { bg: string; fg: string; border: string } {
    const normalized = (role ?? 'SIN ROL').trim().toUpperCase();
    if (ROLE_STYLES[normalized]) {
      return ROLE_STYLES[normalized];
    }
    const index = Array.from(normalized).reduce((acc, char) => acc + char.charCodeAt(0), 0) % ROLE_PALETTE.length;
    return ROLE_PALETTE[index];
  }

  clearSearch() {
    this.setSearchTerm('');
  }
}
