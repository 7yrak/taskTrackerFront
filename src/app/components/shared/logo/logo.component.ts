import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="logo-wrap" [class.logo-on-dark]="onDark()" [style.gap.px]="showText() ? 10 : 0">

      <!-- ── Badge mark ─────────────────────────────────────────────── -->
      <svg [attr.width]="size()" [attr.height]="size()"
           viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"
           style="flex-shrink:0; display:block;">
        <defs>
          <linearGradient id="tt-grad" x1="0%" y1="0%" x2="100%" y2="100%"> /* Degradado naranja */
            <stop offset="0%"   stop-color="#EA580C"/>
            <stop offset="100%" stop-color="#FF8C00"/>
          </linearGradient>
        </defs>

        <!-- Rounded square badge -->
        <rect width="48" height="48" rx="12" fill="url(#tt-grad)"/> 

        <!-- Shared crossbar (the top bar of both T's) -->
        <rect x="9" y="11" width="30" height="5" rx="2.5" fill="white"/>

        <!-- Left T stem (blanco) -->
        <rect x="13" y="11" width="5" height="22" rx="2.5" fill="white"/>

        <!-- Right T stem -->
        <rect x="30" y="11" width="5" height="22" rx="2.5" fill="white"/>

        <!-- Teal milestone dot at base of right stem -->
        <circle cx="32.5" cy="37" r="4.5" fill="#00C4E8"/>
        <!-- Círculo de hito naranja -->
        <!-- Small white ring inside teal dot -->
        <circle cx="32.5" cy="37" r="2" fill="white" opacity="0.6"/>
      </svg>

      <!-- ── Logotype text ────────────────────────────────────────────── -->
      @if (showText()) {
        <div class="logo-text-wrap">
          <span class="logo-word-task">Task</span><span class="logo-word-tracker">Tracker</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .logo-wrap {
      display: flex;
      align-items: center;
      text-decoration: none;
      user-select: none;
    }

    .logo-text-wrap {
      font-family: 'Inter', Roboto, sans-serif;
      line-height: 1;
      letter-spacing: -0.4px;
    }

    .logo-word-task {
      font-weight: 800;
      font-size: inherit;
      color: var(--text-primary);
    }

    .logo-word-tracker {
      font-weight: 400;
      font-size: inherit;
      color: var(--accent);
    }

    /* On dark backgrounds: force white for "Task" */
    .logo-on-dark .logo-word-task    { color: #fb4300; }
    .logo-on-dark .logo-word-tracker { color: #00C4E8; }
  `]
})
export class LogoComponent {
  size     = input<number>(36);
  showText = input<boolean>(true);
  onDark   = input<boolean>(false);
}
