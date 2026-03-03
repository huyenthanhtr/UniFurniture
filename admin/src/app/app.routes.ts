// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { AdminLayout } from './admin-layout/admin-layout';
import { AdminCoupons } from './pages/admin-coupons/admin-coupons';

export const routes: Routes = [
  {
    path: 'admin',
    component: AdminLayout,
    children: [
      { path: 'promotions', component: AdminCoupons }, // Đường dẫn khớp với routerLink trong sidebar
      // các route khác như products, orders...
    ]
  },
  { path: '', redirectTo: '/admin/promotions', pathMatch: 'full' }
];