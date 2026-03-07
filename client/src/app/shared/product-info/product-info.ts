import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductDetailData } from '../../services/product-data.service';
import { UiStateService } from '../ui-state.service';

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
  addMessage = '';

  constructor(private readonly ui: UiStateService) {}

  increase(): void {
    this.quantity++;
  }

  decrease(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  addToCart(): void {
    this.ui.addToCart(
      {
        productId: this.product.id,
        name: this.product.name,
        imageUrl: this.product.images[0] || '',
        price: this.product.price,
      },
      this.quantity,
    );
    this.addMessage = '\u0110\u00e3 th\u00eam v\u00e0o gi\u1ecf h\u00e0ng.';
    this.ui.openCart();
  }

  buyNow(): void {
    this.addToCart();
  }
}
