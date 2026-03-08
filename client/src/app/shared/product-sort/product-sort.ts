import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';

export type ProductSortValue = 'best-selling' | 'newest' | 'oldest';

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
    { value: 'best-selling', label: 'S\u1ea3n ph\u1ea9m n\u1ed5i b\u1eadt' },
    { value: 'newest', label: 'M\u1edbi nh\u1ea5t' },
    { value: 'oldest', label: 'C\u0169 nh\u1ea5t' },
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
