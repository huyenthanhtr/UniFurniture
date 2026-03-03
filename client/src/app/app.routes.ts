import { Routes } from '@angular/router';
import { ArViewer } from './pages/ar-viewer/ar-viewer';
import { ProductComponent } from './pages/product/product';
import { ProductDetailComponent } from './pages/product-detail/product-detail';

export const routes: Routes = [
    { path: 'ar', component: ArViewer },
    { path: 'ar-viewer', component: ArViewer },
    // Listing
    { path: 'product', component: ProductComponent },

    // Detail
    { path: 'product/:id', component: ProductDetailComponent },
];
