import { Routes } from '@angular/router';
import { EgglessShellComponent } from './layout/shell/eggless-shell.component';
import { LoginComponent } from './features/auth/login.component';
import { OverviewComponent } from './features/overview/overview.component';
import { LogsExplorerComponent } from './features/logs/logs-explorer.component';
import { ApplicationsComponent } from './features/applications/applications.component';
import { DashboardsComponent } from './features/dashboards/dashboards.component';
import { AlertsComponent } from './features/alerts/alerts.component';
import { SettingsComponent } from './features/settings/settings.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: EgglessShellComponent,
    children: [
      { path: '', redirectTo: 'logs', pathMatch: 'full' },
      { path: 'overview', component: OverviewComponent },
      { path: 'logs', component: LogsExplorerComponent },
      { path: 'applications', component: ApplicationsComponent },
      { path: 'dashboards', component: DashboardsComponent },
      { path: 'alerts', component: AlertsComponent },
      { path: 'settings', component: SettingsComponent }
    ]
  },
  { path: '**', redirectTo: 'logs' }
];
