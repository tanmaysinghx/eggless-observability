import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { EgglessSidebarComponent } from '../sidebar/eggless-sidebar.component';
import { EgglessTopbarComponent } from '../topbar/eggless-topbar.component';

@Component({
  selector: 'app-eggless-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, EgglessSidebarComponent, EgglessTopbarComponent],
  template: `
    <div class="flex h-screen w-screen bg-[#0b0e14] text-[#e6edf3] overflow-hidden font-sans">
      <!-- Left Navigation Sidebar -->
      <app-eggless-sidebar
        [isCollapsed]="isSidebarCollapsed"
        (toggleCollapse)="isSidebarCollapsed = !isSidebarCollapsed"
      ></app-eggless-sidebar>

      <!-- Main App Body -->
      <div class="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0b0e14]">
        <!-- Topbar Header -->
        <app-eggless-topbar></app-eggless-topbar>

        <!-- Main View Router Container -->
        <main class="flex-1 overflow-auto bg-[#0b0e14] relative">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `
})
export class EgglessShellComponent {
  isSidebarCollapsed = false;
  private router = inject(Router);

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent) {
    // Ctrl+B or Cmd+B to toggle sidebar
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }
  }
}
