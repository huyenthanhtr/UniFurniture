import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductDetailData } from '../../services/product-data.service';

@Component({
  selector: 'app-product-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-info.html',
  styleUrl: './product-info.css',
})
export class ProductInfoComponent {
  @Input({ required: true }) product!: ProductDetailData;

  quantity = 1;

  increase(): void {
    this.quantity++;
  }

  decrease(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }
}
