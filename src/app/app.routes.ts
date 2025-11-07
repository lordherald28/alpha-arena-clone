import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';

export const routes: Routes = [
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
    { path: 'dashboard', component: DashboardComponent },
    {
        path: 'backtesting', title: 'Back Testing IA',
        loadComponent: () => import('./shared/components/test/test.component').then(c => c.TestComponent)
    },
    { path: '**', redirectTo: '/dashboard' } // Ruta comodín
];