import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MemberService } from '../../services/member.service';
import { Member } from '../../models/member.model';
import { MemberDialogComponent } from '../shared/member-dialog/member-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-team',
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatChipsModule, MatSnackBarModule, MatTooltipModule
  ],
  templateUrl: './team.component.html',
  styleUrl: './team.component.scss'
})
export class TeamComponent {
  private memberService = inject(MemberService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  private refresh$ = new Subject<void>();

  members = toSignal(
    this.refresh$.pipe(
      startWith(undefined),
      switchMap(() => this.memberService.getAll())
    ),
    { initialValue: [] as Member[] }
  );

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
}
