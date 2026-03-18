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

        let userId: string | undefined;
        try {
          const profile = localStorage.getItem('user_profile');
          if (profile) {
            const userData = JSON.parse(profile);
            userId = userData._id || userData.id;
          }
        } catch (e) {}

        this.productService.getProductRecommendations(slug, userId).subscribe((items) => {
          this.recommendations.set(items);
          this.loading.set(false);
        });
      }
    });
  }
}
