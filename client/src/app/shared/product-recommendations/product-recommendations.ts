import { Component, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductListItem, ProductDataService } from '../../services/product-data.service';
import { ProductCardComponent } from '../product-card/product-card';

@Component({
  selector: 'app-product-recommendations',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './product-recommendations.html',
  styleUrl: './product-recommendations.css',
})
export class ProductRecommendations {
  productSlug = input.required<string>();
  private productService = inject(ProductDataService);

  readonly recommendations = signal<ProductListItem[]>([]);
  readonly loading = signal(false);

  constructor() {
    effect(() => {
      const slug = this.productSlug();
      if (slug) {
        this.loading.set(true);
        this.productService.getProductRecommendations(slug).subscribe((items) => {
          this.recommendations.set(items);
          this.loading.set(false);
        });
      }
    });
  }
}
