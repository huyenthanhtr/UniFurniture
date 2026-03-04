import { Routes } from '@angular/router';
import { ArViewer } from './pages/ar-viewer/ar-viewer';
import { ProductComponent } from './pages/product/product';
import { ProductDetailComponent } from './pages/product-detail/product-detail';
import { CategoryPageComponent } from './pages/category-page/category-page';

export const routes: Routes = [
    { path: 'ar', component: ArViewer },
    { path: 'ar-viewer', component: ArViewer },
    { path: 'product', component: ProductComponent },
    { path: 'product/:id', component: ProductDetailComponent },
    { path: 'danh-muc', component: CategoryPageComponent },
];

