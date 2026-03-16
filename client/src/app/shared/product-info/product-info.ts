import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
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
  @Input() averageRating = 0;
  @Input() reviewsCount = 0;
  @Output() colorChange = new EventEmitter<ColorSwatch>();
  @Output() variantChange = new EventEmitter<ProductVariantDocument | null>();

  quantity = 1;
  quantityInput = '1';
  addMessage = '';
  addMessageTone: 'success' | 'error' = 'success';
  selectedColor: ColorSwatch | null = null;
  selectedVariant: ProductVariantDocument | null = null;
  readonly starValues = [1, 2, 3, 4, 5];

  constructor(private readonly ui: UiStateService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['product']) {
      return;
    }

    this.selectedColor = this.product.colors?.[0] ?? null;
    this.selectedVariant = null;
    this.addMessage = '';
    this.addMessageTone = 'success';

    if (this.selectedColor) {
      this.colorChange.emit(this.selectedColor);
    }

    this.variantChange.emit(null);
  }

  selectColor(color: ColorSwatch): void {
    this.selectedColor = color;
    this.selectedVariant = null;
    this.addMessage = '';
    this.colorChange.emit(color);
    this.variantChange.emit(null);
  }

  selectVariant(variant: ProductVariantDocument): void {
    if (this.isVariantUnavailable(variant)) {
      return;
    }

    this.selectedVariant = variant;
    this.addMessage = '';
    this.variantChange.emit(variant);
  }

  increase(): void {
    this.quantity += 1;
    this.quantityInput = String(this.quantity);
  }

  decrease(): void {
    if (this.quantity <= 1) {
      return;
    }

    this.quantity -= 1;
    this.quantityInput = String(this.quantity);
  }

  onQuantityInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.quantityInput = target.value;

    const parsed = Number.parseInt(target.value, 10);
    if (!Number.isNaN(parsed)) {
      this.quantity = this.normalizeQuantity(parsed);
    }
  }

  onQuantityBlur(): void {
    const parsed = Number.parseInt(this.quantityInput, 10);
    this.quantity = this.normalizeQuantity(parsed);
    this.quantityInput = String(this.quantity);
  }

  addToCart(): void {
    this.onQuantityBlur();

    if (this.requiresVariantSelection() && !this.selectedVariant) {
      this.addMessageTone = 'error';
      this.addMessage = 'Vui lòng chọn kích thước trước khi thêm vào giỏ hàng.';
      return;
    }

    const selectedPrice = this.selectedVariant?.price ?? this.selectedColor?.price ?? this.product.price;
    const selectedImage = this.selectedColor?.imageUrl ?? this.product.images[0]?.url ?? '';
    const selectedVariantLabel = this.selectedVariant ? this.getVariantLabel(this.selectedVariant) : '';
    const cartKey = this.selectedVariant?._id || this.product.id;

    this.ui.addToCart(
      {
        cartKey,
        productId: this.product.id,
        variantId: this.selectedVariant?._id || '',
        variantLabel: selectedVariantLabel,
        colorName: this.selectedColor?.name || '',
        name: this.product.name,
        imageUrl: selectedImage,
        price: selectedPrice,
        maxStock: this.selectedVariant?.stock_quantity ?? this.product.stock_quantity ?? 999
      },
      this.quantity,
    );

    this.addMessageTone = 'success';
    this.addMessage = 'Đã thêm vào giỏ hàng.';
    this.ui.openCart();
  }

  buyNow(): void {
    this.addToCart();
  }

  get sizeVariants(): ProductVariantDocument[] {
    const colorVariants = this.selectedColor?.variants ?? [];
    if (colorVariants.length > 0) {
      return this.toSizeVariants(colorVariants, this.selectedColor?.name || '');
    }

    return this.toSizeVariants(this.product.variants || []);
  }

  get hasSizeSelection(): boolean {
    return this.sizeVariants.length > 1;
  }

  get displaySizeText(): string {
    const firstVariant = this.sizeVariants[0];
    if (firstVariant) {
      return this.getVariantLabel(firstVariant);
    }

    return this.product.sizeText || 'Đang cập nhật';
  }

  get formattedSizeDescription(): string {
    return String(this.product.sizeText || '')
      .split('|')
      .map((part) => part.trim())
      .filter((part) => Boolean(part))
      .join('\n');
  }

  getVariantLabel(variant: ProductVariantDocument): string {
    return this.extractVariantSizeLabel(variant, this.selectedColor?.name || '') || this.product.sizeText || 'Kích thước';
  }

  isVariantUnavailable(variant: ProductVariantDocument): boolean {
    if ((variant.stock_quantity ?? 0) <= 0 && variant.stock_quantity !== undefined) {
      return true;
    }

    return variant.status === 'unavailable' || variant.variant_status === 'inactive';
  }

  get roundedAverageRating(): number {
    return Math.round(this.averageRating);
  }

  private normalizeQuantity(value: number): number {
    if (!Number.isFinite(value)) {
      return 1;
    }

    return Math.max(1, Math.floor(value));
  }

  private requiresVariantSelection(): boolean {
    return this.hasSizeSelection;
  }

  private toSizeVariants(variants: ProductVariantDocument[], colorName = ''): ProductVariantDocument[] {
    const seenLabels = new Set<string>();

    return variants.filter((variant) => {
      const label = this.extractVariantSizeLabel(variant, colorName);
      if (!label) {
        return false;
      }

      const key = label.toLowerCase();
      if (seenLabels.has(key)) {
        return false;
      }

      seenLabels.add(key);
      return true;
    });
  }

  private extractVariantSizeLabel(variant: ProductVariantDocument, colorName = ''): string {
    const rawLabel = variant.variant_name?.trim() || variant.name?.trim() || '';
    if (!rawLabel) {
      return '';
    }

    const normalizedColorName = this.normalizeText(colorName);
    const normalizedLabel = this.normalizeText(rawLabel);
    if (normalizedColorName && normalizedLabel === normalizedColorName) {
      return '';
    }

    let label = rawLabel;
    if (colorName) {
      const escapedColor = colorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      label = label.replace(new RegExp(escapedColor, 'gi'), ' ');
    }

    label = label
      .replace(/[-_/|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!label) {
      return '';
    }

    const cleanedLabel = this.normalizeText(label);
    if (!cleanedLabel || cleanedLabel === normalizedColorName) {
      return '';
    }

    return label;
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
