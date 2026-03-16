import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductListItem, ColorSwatch } from '../../services/product-data.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ProductListItem;
  readonly starValues = [1, 2, 3, 4, 5];

  readonly hoveredColor = signal<ColorSwatch | null>(null);

  readonly displayImageUrl = computed(() => {
    const hovered = this.hoveredColor();
    return hovered?.imageUrl || this.product.imageUrl;
  });

  readonly displayPrice = computed(() => {
    const hovered = this.hoveredColor();
    return hovered?.price ?? this.product.price;
  });

  readonly displayOriginalPrice = computed(() => {
    const hovered = this.hoveredColor();
    return hovered?.originalPrice ?? this.product.originalPrice;
  });

  get roundedAverageRating(): number {
    return Math.round(Number(this.product?.averageRating || 0));
  }

  get reviewsCount(): number {
    return Number(this.product?.reviewsCount || 0);
  }

  onColorEnter(color: ColorSwatch): void {
    this.hoveredColor.set(color);
  }

  onColorLeave(): void {
    this.hoveredColor.set(null);
  }
}
