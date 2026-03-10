import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ColorSwatch, ProductDetailData, ProductVariantDocument } from '../../services/product-data.service';
import { UiStateService } from '../ui-state.service';

@Component({
  selector: 'app-product-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-info.html',
  styleUrl: './product-info.css',
})
export class ProductInfoComponent implements OnChanges {
  @Input({ required: true }) product!: ProductDetailData;
  @Output() colorChange = new EventEmitter<ColorSwatch>();
  @Output() variantChange = new EventEmitter<ProductVariantDocument>();

  quantity = 1;
  quantityInput = '1';
  addMessage = '';
  selectedColor: ColorSwatch | null = null;
  selectedVariant: ProductVariantDocument | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product']) {
      this.selectedColor = this.product.colors?.[0] ?? null;
      this.selectedVariant = this.selectedColor?.variants?.[0] ?? null;
      if (this.selectedVariant) {
        this.variantChange.emit(this.selectedVariant);
      }
    }
  }

  selectColor(color: ColorSwatch): void {
    if (this.selectedColor?.name !== color.name) {
      this.selectedColor = color;
      this.selectedVariant = color.variants?.[0] ?? null;
      this.colorChange.emit(color);
      if (this.selectedVariant) {
        this.variantChange.emit(this.selectedVariant);
      }
    }
  }

  selectVariant(variant: ProductVariantDocument): void {
    this.selectedVariant = variant;
    this.variantChange.emit(variant);
  }

  constructor(private readonly ui: UiStateService) { }

  increase(): void {
    this.quantity++;
    this.quantityInput = String(this.quantity);
  }

  decrease(): void {
    if (this.quantity > 1) {
      this.quantity--;
      this.quantityInput = String(this.quantity);
    }
  }

  onQuantityInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.quantityInput = target.value;

    const parsed = Number.parseInt(target.value, 10);
    if (Number.isNaN(parsed)) {
      return;
    }

    this.quantity = this.normalizeQuantity(parsed);
  }

  onQuantityBlur(): void {
    const parsed = Number.parseInt(this.quantityInput, 10);
    this.quantity = this.normalizeQuantity(parsed);
    this.quantityInput = String(this.quantity);
  }

  addToCart(): void {
    this.onQuantityBlur();
    const selectedPrice = this.selectedVariant?.price ?? this.selectedColor?.price ?? this.product.price;
    const selectedImage = this.selectedColor?.imageUrl ?? this.product.images[0]?.url ?? '';

    this.ui.addToCart(
      {
        productId: this.product.id,
        name: this.product.name,
        imageUrl: selectedImage,
        price: selectedPrice,
      },
      this.quantity,
    );
    this.addMessage = '\u0110\u00e3 th\u00eam v\u00e0o gi\u1ecf h\u00e0ng.';
    this.ui.openCart();
  }

  buyNow(): void {
    this.addToCart();
  }

  private normalizeQuantity(value: number): number {
    if (!Number.isFinite(value)) {
      return 1;
    }

    return Math.max(1, Math.floor(value));
  }
}
