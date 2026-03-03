import { Routes } from '@angular/router';
import { ArViewer } from './pages/ar-viewer/ar-viewer';
import { ProductComponent } from './pages/product/product';

export const routes: Routes = [
    { path: 'ar', component: ArViewer },
    { path: 'ar-viewer', component: ArViewer },
    { path: 'product', component: ProductComponent },
];
