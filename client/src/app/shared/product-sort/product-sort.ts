import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';

export type ProductSortValue = 'best-selling' | 'newest' | 'oldest' | 'price' | 'suggested';

interface SortOption {
  value: ProductSortValue;
  label: string;
}

@Component({
  selector: 'app-product-sort',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-sort.html',
  styleUrl: './product-sort.css',
})
export class ProductSortComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @Input() selectedSort: ProductSortValue = 'best-selling';
  @Output() sortChange = new EventEmitter<ProductSortValue>();

  readonly sortOptions: SortOption[] = [
    { value: 'best-selling', label: 'Sản phẩm nổi bật' },
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
    { value: 'price', label: 'Giá từ thấp đến cao' },
    { value: 'suggested', label: 'Gợi ý cho bạn' },
  ];

  isOpen = false;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) {
      return;
    }
    if (!this.elementRef.nativeElement.contains(target)) {
      this.isOpen = false;
    }
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
  }

  selectSort(value: ProductSortValue): void {
    if (value !== this.selectedSort) {
      this.selectedSort = value;
      this.sortChange.emit(value);
    }
    this.isOpen = false;
  }

  getSelectedLabel(): string {
    const selected = this.sortOptions.find((item) => item.value === this.selectedSort);
    return selected?.label || this.sortOptions[0].label;
  }
}
