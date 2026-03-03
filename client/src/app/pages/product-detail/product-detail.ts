import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductGalleryComponent } from '../../shared/product-gallery/product-gallery';
import { ProductInfoComponent } from '../../shared/product-info/product-info';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    ProductGalleryComponent,
    ProductInfoComponent
  ],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
})
export class ProductDetailComponent {

  // 🔹 Thêm activeTab (bị thiếu)
  activeTab: string = 'desc';

  // 🔹 Thêm description (bị thiếu)
  product = {
    name: 'Ghế Sofa Dalumd 301',
    price: 9490000,
    oldPrice: 12990000,
    description: 'Ghế sofa cao cấp, thiết kế hiện đại, chất liệu vải chống thấm nước.'
  };

}