import { Routes, CanDeactivateFn } from '@angular/router';
import { AdminLayout } from './admin-layout/admin-layout';
import { AdminCoupons } from './pages/admin-coupons/admin-coupons';

import { AdminProducts } from './pages/admin-products/admin-products';
import { AdminProductDetail } from './pages/admin-product-detail/admin-product-detail';
import { AdminProductForm } from './pages/admin-product-form/admin-product-form';
import { AdminVariantDetail } from './pages/admin-variant-detail/admin-variant-detail';
import { AdminOrders } from './pages/admin-orders/admin-orders';
import { AdminOrderDetail } from './pages/admin-order-detail/admin-order-detail';

type PendingChangesComponent = {
  canDeactivate: () => boolean | Promise<boolean>;
};

const pendingChangesGuard: CanDeactivateFn<PendingChangesComponent> = (component) => {
  if (component && typeof component.canDeactivate === 'function') {
    return component.canDeactivate();
  }
  return true;
};

export const routes: Routes = [
  {
    path: 'admin',
    component: AdminLayout,
    children: [
      { path: 'promotions', component: AdminCoupons },

      { path: 'products', component: AdminProducts },
      { path: 'products/new', component: AdminProductForm, canDeactivate: [pendingChangesGuard] },
      { path: 'products/:id', component: AdminProductDetail },
      { path: 'products/:id/edit', component: AdminProductForm, canDeactivate: [pendingChangesGuard] },
      { path: 'variants/:id', component: AdminVariantDetail, canDeactivate: [pendingChangesGuard] },

      { path: 'orders', component: AdminOrders },
      { path: 'orders/:id', component: AdminOrderDetail },
    ],
  },
  { path: '', redirectTo: '/admin/products', pathMatch: 'full' },
];
