import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';

export interface FilterSelectOption {
  value: string;
  label: string;
}

export interface ProductFilterState {
  categoryId: string;
  priceRange: string;
  color: string;
  size: string;
}

type DropdownKey = 'category' | 'price' | 'color' | 'size';

@Component({
  selector: 'app-product-filter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-filter.html',
  styleUrl: './product-filter.css',
})
export class ProductFilterComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @Input() categoryOptions: FilterSelectOption[] = [];
  @Input() categoryDefaultLabel = 'Tất cả danh mục';
  @Input() selectedCategoryId = '';
  @Input() selectedPriceRange = 'price-asc';
  @Input() selectedColor = 'all';
  @Input() selectedSize = 'all';

  @Output() filtersChange = new EventEmitter<ProductFilterState>();

  readonly priceOptions: FilterSelectOption[] = [
    { value: 'price-asc', label: 'Từ thấp đến cao' },
    { value: 'price-desc', label: 'Từ cao đến thấp' },
    { value: 'under-2m', label: 'Dưới 2 triệu' },
    { value: '2m-5m', label: '2 - 5 triệu' },
    { value: '5m-10m', label: '5 - 10 triệu' },
    { value: '10m-15m', label: '10 - 15 triệu' },
    { value: 'over-15m', label: 'Trên 15 triệu' },
  ];

  readonly colorOptions: FilterSelectOption[] = [
    { value: 'all', label: 'Tất cả màu' },
    { value: 'trang', label: 'Trắng' },
    { value: 'den', label: 'Đen' },
    { value: 'xam', label: 'Xám' },
    { value: 'nau', label: 'Nâu' },
    { value: 'xanh', label: 'Xanh' },
  ];

  readonly sizeOptions: FilterSelectOption[] = [
    { value: 'all', label: 'Tất cả kích thước' },
    { value: 'nho', label: 'Nhỏ' },
    { value: 'vua', label: 'Vừa' },
    { value: 'lon', label: 'Lớn' },
  ];

  openDropdown: DropdownKey | null = null;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) {
      return;
    }
    if (!this.elementRef.nativeElement.contains(target)) {
      this.closeDropdown();
    }
  }

  toggleDropdown(dropdown: DropdownKey): void {
    this.openDropdown = this.openDropdown === dropdown ? null : dropdown;
  }

  closeDropdown(): void {
    this.openDropdown = null;
  }

  selectCategory(value: string): void {
    this.selectedCategoryId = value;
    this.emitFilters();
    this.closeDropdown();
  }

  selectPrice(value: string): void {
    this.selectedPriceRange = value;
    this.emitFilters();
    this.closeDropdown();
  }

  selectColor(value: string): void {
    this.selectedColor = value;
    this.emitFilters();
    this.closeDropdown();
  }

  selectSize(value: string): void {
    this.selectedSize = value;
    this.emitFilters();
    this.closeDropdown();
  }

  getCategoryLabel(): string {
    return this.resolveLabel(this.categoryOptions, this.selectedCategoryId, this.categoryDefaultLabel);
  }

  getPriceLabel(): string {
    return this.resolveLabel(this.priceOptions, this.selectedPriceRange, 'Từ thấp đến cao');
  }

  getColorLabel(): string {
    return this.resolveLabel(this.colorOptions, this.selectedColor, 'Tất cả màu');
  }

  getSizeLabel(): string {
    return this.resolveLabel(this.sizeOptions, this.selectedSize, 'Tất cả kích thước');
  }

  emitFilters(): void {
    this.filtersChange.emit({
      categoryId: this.selectedCategoryId,
      priceRange: this.selectedPriceRange,
      color: this.selectedColor,
      size: this.selectedSize,
    });
  }

  private resolveLabel(options: FilterSelectOption[], value: string, fallback: string): string {
    const selected = options.find((option) => option.value === value);
    return selected?.label || fallback;
  }
}
