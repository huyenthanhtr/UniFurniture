import { Routes } from '@angular/router';
import { AdminLayout } from './admin-layout/admin-layout';
import { AdminCoupons } from './pages/admin-coupons/admin-coupons';

import { AdminProducts } from './pages/admin-products/admin-products';
import { AdminProductDetail } from './pages/admin-product-detail/admin-product-detail';
import { AdminProductForm } from './pages/admin-product-form/admin-product-form';
import { AdminVariantDetail } from './pages/admin-variant-detail/admin-variant-detail';

export const routes: Routes = [
  {
    path: 'admin',
    component: AdminLayout,
    children: [
      { path: 'promotions', component: AdminCoupons },

      // products
      { path: 'products', component: AdminProducts },
      { path: 'products/new', component: AdminProductForm },
      { path: 'products/:id', component: AdminProductDetail },
      { path: 'products/:id/edit', component: AdminProductForm },

      // variant detail
      { path: 'variants/:id', component: AdminVariantDetail },
    ]
  },
  { path: '', redirectTo: '/admin/products', pathMatch: 'full' }
];