import { Routes } from '@angular/router';
import { ArViewer } from './pages/ar-viewer/ar-viewer';
import { ProductComponent } from './pages/product/product';
import { ProductDetailComponent } from './pages/product-detail/product-detail';
import { CategoryPageComponent } from './pages/category-page/category-page';
import { NewsPageComponent } from './pages/news/news';
import { NewsDetailComponent } from './pages/news-detail/news-detail';
import { PromotionsPageComponent } from './pages/promotions/promotions';
import { PolicyPageComponent } from './pages/policy/policy';
import { AboutPageComponent } from './pages/about/about';
import { CommunityPageComponent } from './pages/community/community';
import { OrderTrackingComponent } from './pages/order-tracking/order-tracking';

export const routes: Routes = [
  { path: 'ar', component: ArViewer },
  { path: 'ar-viewer', component: ArViewer },
  { path: 'products', component: ProductComponent },
  { path: 'products/:id', component: ProductDetailComponent },
  { path: 'danh-muc', component: CategoryPageComponent },
  { path: 'khuyen-mai', component: PromotionsPageComponent },
  { path: 'tin-tuc', component: NewsPageComponent },
  { path: 'tin-tuc/:slug', component: NewsDetailComponent },
  { path: 'chinh-sach/:slug', component: PolicyPageComponent },
  { path: 've-unifurniture', component: AboutPageComponent },
  { path: 'cong-dong', component: CommunityPageComponent },
  { path: 'cua-hang', redirectTo: 'cong-dong', pathMatch: 'full' },
  { path: 'tra-cuu-van-don', component: OrderTrackingComponent },
];
