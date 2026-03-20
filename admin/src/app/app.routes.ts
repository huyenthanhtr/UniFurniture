import { Routes, CanDeactivateFn } from '@angular/router';
import { AdminLayout } from './admin-layout/admin-layout';
import { AdminCoupons } from './pages/admin-coupons/admin-coupons';
import { AdminCategoryList } from './pages/admin-category-list/admin-category-list';
import { AdminProducts } from './pages/admin-products/admin-products';
import { AdminProductDetail } from './pages/admin-product-detail/admin-product-detail';
import { AdminProductForm } from './pages/admin-product-form/admin-product-form';
import { AdminVariantDetail } from './pages/admin-variant-detail/admin-variant-detail';
import { AdminOrders } from './pages/admin-orders/admin-orders';
import { AdminOrderDetail } from './pages/admin-order-detail/admin-order-detail';
import { AdminCustomers } from './pages/admin-customers/admin-customers';
import { AdminCustomerDetail } from './pages/admin-customer-detail/admin-customer-detail';
import { AdminCustomerAddressDetail } from './pages/admin-customer-address-detail/admin-customer-address-detail';
import { AdminCollections } from './pages/admin-collections/admin-collections';
import { AdminReview } from './pages/admin-review/admin-review';
import { AdminDashboard } from './pages/admin-dashboard/admin-dashboard';
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
      { path: 'categories', component: AdminCategoryList},
      { path: 'collections', component: AdminCollections},
      { path: 'reviews', component: AdminReview },
      { path: 'dashboard', component: AdminDashboard},
      { path: 'products', component: AdminProducts },
      { path: 'products/new', component: AdminProductForm, canDeactivate: [pendingChangesGuard] },
      { path: 'products/:slug', component: AdminProductDetail },
      { path: 'products/:slug/edit', component: AdminProductForm, canDeactivate: [pendingChangesGuard] },
      { path: 'variants/:id', component: AdminVariantDetail, canDeactivate: [pendingChangesGuard] },

      { path: 'orders', component: AdminOrders },
      { path: 'orders/:id', component: AdminOrderDetail },

      { path: 'customers', component: AdminCustomers },
      { path: 'customers/:id', component: AdminCustomerDetail },
      { path: 'customers/:id/addresses/:addressId', component: AdminCustomerAddressDetail },
    ],
  },
  { path: '', redirectTo: '/admin/products', pathMatch: 'full' },
];
