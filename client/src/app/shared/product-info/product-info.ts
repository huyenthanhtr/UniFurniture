import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import {
  ColorSwatch,
  ProductDataService,
  ProductDetailData,
  ProductVariantDocument,
} from '../../services/product-data.service';
import { UiStateService } from '../ui-state.service';
import { WishlistService } from '../wishlist.service';

@Component({
  selector: 'app-product-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-info.html',
  styleUrl: './product-info.css',
})
export class ProductInfoComponent implements OnChanges {
  private readonly reachedStockLimitMessage = 'Đạt giới hạn số lượng sản phẩm còn hàng';
  private readonly stockLimitMessage = 'Đã vượt quá số lượng tồn kho';
  private readonly outOfStockMessage = 'Sản phẩm đã hết hàng';
  private readonly addSuccessMessage = 'Đã thêm vào giỏ hàng.';
  private latestStockRequestKey = '';
  private stockFromApi?: number;

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

  constructor(
    private readonly ui: UiStateService,
    private readonly wishlist: WishlistService,
    private readonly productDataService: ProductDataService,
    private readonly router: Router,
  ) {}

  isWishlisted(): boolean {
    return this.wishlist.isInWishlist(String(this.product?.id || ''));
  }

  async toggleWishlist(): Promise<void> {
    if (!this.wishlist.isLoggedIn()) {
      this.ui.openAuth('login');
      return;
    }

    const salePrice = this.selectedVariant?.price ?? this.selectedColor?.price ?? this.product?.price ?? 0;
    const originalPrice =
      this.selectedVariant?.compare_at_price ?? this.selectedColor?.originalPrice ?? this.product?.originalPrice ?? salePrice;
    const selectedImage = this.selectedColor?.imageUrl ?? this.product?.images?.[0]?.url ?? '';

    await this.wishlist.toggle({
      product_id: String(this.product?.id || '').trim(),
      product_slug: String(this.product?.slug || '').trim(),
      name: String(this.product?.name || '').trim() || 'Sản phẩm',
      image_url: String(selectedImage || '').trim(),
      sale_price: Math.max(0, Number(salePrice || 0)),
      price: Math.max(0, Number(originalPrice || salePrice || 0)),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['product']) {
      return;
    }

    this.selectedColor = this.product.colors?.[0] ?? null;
    this.selectedVariant = null;
    this.stockFromApi = undefined;
    this.addMessage = '';
    this.addMessageTone = 'success';
    this.syncQuantityWithRemainingStock();
    this.refreshStockFromApi(true);

    if (this.selectedColor) {
      this.colorChange.emit(this.selectedColor);
    }

    this.variantChange.emit(null);
  }

  selectColor(color: ColorSwatch): void {
    this.selectedColor = color;
    this.selectedVariant = null;
    this.stockFromApi = undefined;
    this.addMessage = '';
    this.syncQuantityWithRemainingStock();
    this.refreshStockFromApi(true);
    this.colorChange.emit(color);
    this.variantChange.emit(null);
  }

  selectVariant(variant: ProductVariantDocument): void {
    if (this.isVariantUnavailable(variant)) {
      return;
    }

    this.selectedVariant = variant;
    this.stockFromApi = undefined;
    this.addMessage = '';
    this.syncQuantityWithRemainingStock();
    this.refreshStockFromApi(true);
    this.variantChange.emit(variant);
  }

  increase(): void {
    if (!this.canIncreaseQuantity) {
      this.showStockLimitMessage();
      return;
    }

    this.quantity += 1;
    this.quantityInput = String(this.quantity);
    this.clearTransientMessage();
  }

  decrease(): void {
    if (this.quantity <= this.quantityInputMin) {
      return;
    }

    this.quantity -= 1;
    this.quantityInput = String(this.quantity);
    this.clearTransientMessage();
  }

  onQuantityInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.quantityInput = target.value;

    const parsed = Number.parseInt(target.value, 10);
    if (!Number.isNaN(parsed)) {
      this.quantity = this.normalizeQuantity(parsed);
    }

    this.clearTransientMessage();
  }

  onQuantityBlur(): void {
    const parsed = Number.parseInt(this.quantityInput, 10);
    this.quantity = this.normalizeQuantity(parsed);
    this.quantityInput = String(this.quantity);
    this.clearTransientMessage();
  }

  addToCart(): void {
    this.processCartAction(false);
  }

  buyNow(): void {
    this.processCartAction(true);
  }

  get canIncreaseQuantity(): boolean {
    const remainingStock = this.remainingStock;
    if (remainingStock === undefined) {
      return true;
    }

    return this.quantity < remainingStock;
  }

  get isBuyNowDisabled(): boolean {
    return this.quantity <= 0 || this.isQuantityOverStock;
  }

  get displayMessage(): string {
    if (this.addMessage) {
      return this.addMessage;
    }

    if (this.isOutOfStock) {
      return this.outOfStockMessage;
    }

    if (this.quantity <= 0) {
      return '';
    }

    if (this.isQuantityOverStock) {
      return this.stockLimitMessage;
    }

    if (this.hasReachedSelectableLimit) {
      return this.reachedStockLimitMessage;
    }

    return '';
  }

  get isDisplayMessageError(): boolean {
    if (this.addMessage) {
      return this.addMessageTone === 'error';
    }

    if (this.isOutOfStock) {
      return true;
    }

    if (this.quantity <= 0) {
      return false;
    }

    return this.isQuantityOverStock || this.hasReachedSelectableLimit;
  }

  get quantityInputMin(): number {
    return 0;
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
    if (String(variant.variant_status || '').toLowerCase() === 'inactive') {
      return true;
    }

    const stock = variant.stock_quantity;
    if (typeof stock === 'number') {
      return stock <= 0;
    }

    return false;
  }

  get roundedAverageRating(): number {
    return Math.round(this.averageRating);
  }

  get isQuantityOverStock(): boolean {
    const remainingStock = this.remainingStock;
    if (remainingStock === undefined || this.quantity <= 0) {
      return false;
    }

    return this.quantity > remainingStock;
  }

  get isOutOfStock(): boolean {
    return typeof this.remainingStock === 'number' && this.remainingStock <= 0;
  }

  private processCartAction(redirectToCheckout: boolean): void {
    this.onQuantityBlur();

    if (this.requiresVariantSelection() && !this.selectedVariant) {
      this.addMessageTone = 'error';
      this.addMessage = 'Vui lòng chọn kích thước trước khi thêm vào giỏ hàng.';
      return;
    }

    if (this.quantity <= 0) {
      this.addMessageTone = 'error';
      this.addMessage = this.isOutOfStock ? this.outOfStockMessage : 'Vui lòng chọn số lượng sản phẩm.';
      return;
    }

    this.refreshStockFromApi(false, () => {
      if (this.isQuantityOverStock || (typeof this.remainingStock === 'number' && this.remainingStock <= 0)) {
        this.showStockLimitMessage();
        return;
      }

      if (redirectToCheckout) {
        const checkoutItem = this.buildBuyNowCheckoutItem();
        this.resetQuantityAfterCartAction();
        this.addMessage = '';
        void this.router.navigate(['/checkout'], { state: { buyNowItem: checkoutItem } });
        return;
      }

      const isAdded = this.commitAddToCart();
      if (!isAdded) {
        return;
      }

      this.resetQuantityAfterCartAction();
      this.addMessageTone = 'success';
      this.addMessage = this.addSuccessMessage;
    });
  }

  private buildBuyNowCheckoutItem() {
    const variant = this.effectiveVariant;
    const selectedPrice = variant?.price ?? this.selectedColor?.price ?? this.product.price;
    const selectedImage = this.selectedColor?.imageUrl ?? this.product.images[0]?.url ?? '';
    const selectedVariantLabel = variant ? this.getVariantLabel(variant) : '';
    const selectedOriginalPrice =
      variant?.compare_at_price ?? this.selectedColor?.originalPrice ?? this.product.originalPrice;
    const variantParts = [this.selectedColor?.name || '', selectedVariantLabel].filter(Boolean);

    return {
      cartKey: variant?._id || this.product.id,
      productId: this.product.id,
      variantId: variant?._id || '',
      name: this.product.name,
      imageUrl: selectedImage,
      variant: variantParts.length ? variantParts.join(' / ') : 'Mặc định',
      quantity: this.quantity,
      originalPrice: Math.max(
        typeof selectedOriginalPrice === 'number' ? selectedOriginalPrice : 0,
        typeof selectedPrice === 'number' ? selectedPrice : 0,
      ),
      salePrice: typeof selectedPrice === 'number' ? selectedPrice : 0,
      maxStock: this.selectedMaxStock,
    };
  }

  private commitAddToCart(): boolean {
    const variant = this.effectiveVariant;
    const selectedPrice = variant?.price ?? this.selectedColor?.price ?? this.product.price;
    const selectedImage = this.selectedColor?.imageUrl ?? this.product.images[0]?.url ?? '';
    const selectedVariantLabel = variant ? this.getVariantLabel(variant) : '';
    const selectedOriginalPrice =
      variant?.compare_at_price ?? this.selectedColor?.originalPrice ?? this.product.originalPrice;
    const cartKey = variant?._id || this.product.id;
    const maxStock = this.selectedMaxStock;

    if (this.isQuantityOverStock || (typeof this.remainingStock === 'number' && this.remainingStock <= 0)) {
      this.showStockLimitMessage();
      return false;
    }

    const result = this.ui.addToCart(
      {
        cartKey,
        productId: this.product.id,
        variantId: variant?._id || '',
        variantLabel: selectedVariantLabel,
        colorName: this.selectedColor?.name || '',
        name: this.product.name,
        imageUrl: selectedImage,
        price: selectedPrice,
        originalPrice: selectedOriginalPrice,
        maxStock,
      },
      this.quantity,
    );

    if (result.exceededStock) {
      this.addMessageTone = 'error';
      this.addMessage = this.stockLimitMessage;
      return false;
    }

    return true;
  }

  private refreshStockFromApi(syncQuantityAfterLoad: boolean, done?: () => void): void {
    const productId = String(this.product?.id || '').trim();
    if (!productId) {
      done?.();
      return;
    }

    const variantId = this.effectiveVariant?._id;
    const requestKey = `${productId}:${variantId || 'product'}`;
    this.latestStockRequestKey = requestKey;

    this.productDataService.getProductStockFromApi(productId, variantId).subscribe((stock) => {
      if (this.latestStockRequestKey !== requestKey) {
        return;
      }

      this.stockFromApi = typeof stock === 'number' ? stock : undefined;
      if (syncQuantityAfterLoad) {
        this.syncQuantityWithRemainingStock();
      }
      done?.();
    });
  }

  private get selectedMaxStock(): number | undefined {
    if (typeof this.stockFromApi === 'number') {
      return this.stockFromApi;
    }

    return this.effectiveVariant?.stock_quantity ?? this.product.stock_quantity;
  }

  private get currentCartQuantity(): number {
    const cartKey = this.effectiveVariant?._id || this.product.id;
    return this.ui.getCartItemQuantity(cartKey);
  }

  private get remainingStock(): number | undefined {
    if (typeof this.selectedMaxStock !== 'number') {
      return undefined;
    }

    return Math.max(0, this.selectedMaxStock - this.currentCartQuantity);
  }

  private get hasReachedSelectableLimit(): boolean {
    if (this.quantity <= 0) {
      return false;
    }

    const remainingStock = this.remainingStock;
    if (remainingStock === undefined) {
      return false;
    }

    if (remainingStock === 0) {
      return true;
    }

    return this.quantity >= remainingStock;
  }

  private get effectiveVariant(): ProductVariantDocument | null {
    if (this.selectedVariant) {
      return this.selectedVariant;
    }

    const allVariants = this.product.variants || [];
    const defaultVariant = allVariants.find(v => this.isDefaultVariant(v));

    if (this.sizeVariants.length === 0 && defaultVariant) {
      return defaultVariant;
    }

    return this.sizeVariants.length === 1 ? this.sizeVariants[0] : null;
  }

  private normalizeQuantity(value: number): number {
    if (!Number.isFinite(value)) {
      return this.quantityInputMin;
    }

    return Math.max(this.quantityInputMin, Math.floor(value));
  }

  private requiresVariantSelection(): boolean {
    return this.hasSizeSelection;
  }

  private clearTransientMessage(): void {
    if (
      this.addMessageTone === 'success' ||
      this.addMessage === this.stockLimitMessage ||
      this.addMessage === this.reachedStockLimitMessage
    ) {
      this.addMessage = '';
    }
  }

  private showStockLimitMessage(): void {
    this.addMessageTone = 'error';
    if (this.isOutOfStock) {
      this.addMessage = this.outOfStockMessage;
      return;
    }

    this.addMessage = this.hasReachedSelectableLimit ? this.reachedStockLimitMessage : this.stockLimitMessage;
  }

  private resetQuantityAfterCartAction(): void {
    this.quantity = 0;
    this.quantityInput = '0';
  }

  private syncQuantityWithRemainingStock(): void {
    const remainingStock = this.remainingStock;
    if (remainingStock === undefined) {
      this.quantity = Math.max(1, this.quantity || 1);
      this.quantityInput = String(this.quantity);
      return;
    }

    if (remainingStock <= 0) {
      this.quantity = 0;
      this.quantityInput = '0';
      return;
    }

    this.quantity = Math.min(Math.max(1, this.quantity || 1), remainingStock);
    this.quantityInput = String(this.quantity);
  }

  private isDefaultVariant(variant: ProductVariantDocument): boolean {
    const productSku = String(this.product.sku || this.product.id).trim().toLowerCase();
    const variantSku = String(variant.sku || '').trim().toLowerCase();
    return productSku !== '' && variantSku === productSku;
  }

  private toSizeVariants(variants: ProductVariantDocument[], colorName = ''): ProductVariantDocument[] {
    const seenLabels = new Set<string>();

    return variants.filter((variant) => {
      // Hide default variants that match the product SKU
      if (this.isDefaultVariant(variant)) {
        return false;
      }

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
    const rawLabel = variant.label?.trim() || variant.variant_name?.trim() || variant.name?.trim() || '';
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
