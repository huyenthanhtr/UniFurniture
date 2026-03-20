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
  readonly defaultColor = computed<ColorSwatch | null>(() => {
    const colors = Array.isArray(this.product?.colors) ? this.product.colors : [];
    return colors.length > 0 ? colors[0] : null;
  });
  readonly activeColor = computed<ColorSwatch | null>(() => this.hoveredColor() ?? this.defaultColor());

  readonly displayImageUrl = computed(() => {
    const active = this.activeColor();
    return active?.imageUrl || this.product.imageUrl;
  });

  readonly displayPrice = computed(() => {
    const active = this.activeColor();
    const activePrice = this.toNumberOrNull(active?.price);
    if (activePrice !== null) {
      return activePrice;
    }
    return this.toNumberOrNull(this.product.price);
  });

  readonly displayOriginalPrice = computed(() => {
    const active = this.activeColor();
    const activeOriginal = this.toNumberOrNull(active?.originalPrice);
    if (activeOriginal !== null) {
      return activeOriginal;
    }
    return this.toNumberOrNull(this.product.originalPrice);
  });

  readonly discountedOriginalPrice = computed(() => {
    const salePrice = this.displayPrice();
    const originalPrice = this.displayOriginalPrice();

    if (typeof salePrice !== 'number' || typeof originalPrice !== 'number') {
      return null;
    }

    return originalPrice > salePrice ? originalPrice : null;
  });

  get detailLink(): string[] {
    const slug = String(this.product?.slug || '').trim();
    if (slug) {
      return ['/products', slug];
    }

    return ['/products', String(this.product?.id || '').trim()];
  }

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

  private toNumberOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
