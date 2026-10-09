import { inject } from '@angular/core';
import { type Routes } from '@angular/router';
import { DesktopService } from './core/services/desktop.service';

export const routes: Routes = [
  {
    path: 'dashboard',
    canMatch: [() => inject(DesktopService).role === 'dashboard'],
    loadComponent: () => import('./features/dashboard/dashboard-shell.component').then((module) => module.DashboardShellComponent),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/dashboard/dashboard.component').then((module) => module.DashboardComponent) },
      { path: 'history', loadComponent: () => import('./features/history/history.component').then((module) => module.HistoryComponent) },
      { path: 'settings', loadComponent: () => import('./features/settings/settings.component').then((module) => module.SettingsComponent) },
    ],
  },
  {
    path: 'companion',
    canMatch: [() => inject(DesktopService).role === 'companion'],
    loadComponent: () => import('./features/companion/companion.component').then((module) => module.CompanionComponent),
  },
  { path: '**', redirectTo: () => `/${inject(DesktopService).role}` },
];
