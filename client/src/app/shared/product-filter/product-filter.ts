import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';

export interface FilterSelectOption {
  value: string;
  label: string;
  hex?: string;
  type?: 'category' | 'collection';
}

export interface FilterCategoryTreeGroup {
  id: string;
  label: string;
  children: FilterSelectOption[];
}

export interface ProductFilterState {
  categoryId: string;
  categoryIds: string[];
  collectionIds: string[];
  categoryGroupId: string;
  categoryType: 'category' | 'collection' | 'mixed' | 'none';
  priceRanges: string[];
  colors: string[];
  sizes: string[];
  priceRange: string;
  color: string;
  size: string;
}

type DropdownKey = 'category' | 'price' | 'color' | 'size';
type FilterChipType = 'category' | 'price' | 'color' | 'size';

const DEFAULT_COLOR_OPTIONS: FilterSelectOption[] = [
  { value: 'trang', label: 'Trắng', hex: '#f5f5f4' },
  { value: 'den', label: 'Đen', hex: '#111827' },
  { value: 'xam', label: 'Xám', hex: '#9ca3af' },
  { value: 'nau', label: 'Nâu', hex: '#8b5e3c' },
  { value: 'xanh', label: 'Xanh', hex: '#6f96bf' },
  { value: 'mix', label: 'Mix', hex: '#d1d5db' },
];

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
  @Input() categoryTree: FilterCategoryTreeGroup[] = [];
  @Input() preferredExpandedGroupIds: string[] = [];
  @Input() categoryDefaultLabel = 'Tất cả danh mục';
  @Input() selectedCategoryId = '';
  @Input() selectedCategoryIds: string[] = [];
  @Input() selectedCategoryGroupId = '';
  @Input() selectedPriceRanges: string[] = [];
  @Input() selectedColors: string[] = [];
  @Input() selectedSizes: string[] = [];
  @Input() categoryTriggerLabel = '';

  @Output() filtersChange = new EventEmitter<ProductFilterState>();

  readonly priceOptions: FilterSelectOption[] = [
    { value: 'under-2m', label: 'Dưới 2 triệu' },
    { value: '2m-5m', label: '2 - 5 triệu' },
    { value: '5m-10m', label: '5 - 10 triệu' },
    { value: '10m-15m', label: '10 - 15 triệu' },
    { value: 'over-15m', label: 'Trên 15 triệu' },
  ];

  @Input() colorOptions: FilterSelectOption[] = DEFAULT_COLOR_OPTIONS;

  readonly sizeOptions: FilterSelectOption[] = [
    { value: 'size-90cm', label: '90cm' },
    { value: 'size-1m2', label: '1m2' },
    { value: 'size-1m4', label: '1m4' },
    { value: 'size-1m6', label: '1m6' },
    { value: 'size-1m8', label: '1m8' },
  ];

  openDropdown: DropdownKey | null = null;
  readonly expandedGroupIds = new Set<string>();

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
    if (this.openDropdown === 'category' && this.isCategoryTreeMode()) {
      this.syncExpandedGroupsToSelection();
    }
  }

  closeDropdown(): void {
    this.openDropdown = null;
  }

  selectCategory(value: string): void {
    if (this.isCategoryTreeMode()) {
      this.toggleCategoryLeaf(value);
      this.emitFilters();
      return;
    }

    if (this.isCategoryMultiSelect()) {
      this.toggleCategoryLeaf(value);
      this.emitFilters();
      return;
    }

    this.selectedCategoryId = value;
    this.selectedCategoryIds = value ? [value] : [];
    this.emitFilters();
    this.closeDropdown();
  }

  selectPrice(value: string): void {
    this.toggleMultiValue(this.selectedPriceRanges, value, (next) => {
      this.selectedPriceRanges = next;
    });
    this.emitFilters();
  }

  selectColor(value: string): void {
    this.toggleMultiValue(this.selectedColors, value, (next) => {
      this.selectedColors = next;
    });
    this.emitFilters();
  }

  selectSize(value: string): void {
    this.toggleMultiValue(this.selectedSizes, value, (next) => {
      this.selectedSizes = next;
    });
    this.emitFilters();
  }

  getCategoryLabel(): string {
    if (this.isCategoryTreeMode() || this.isCategoryMultiSelect()) {
      const selectedCount = this.getSelectedCategoryCount();
      return selectedCount > 0 ? `Đã chọn ${selectedCount}` : this.categoryDefaultLabel;
    }
    return this.resolveLabel(this.categoryOptions, this.selectedCategoryId, this.categoryDefaultLabel);
  }

  getPriceLabel(): string {
    return this.selectedPriceRanges.length > 0 ? `Đã chọn ${this.selectedPriceRanges.length}` : 'Tất cả';
  }

  getColorLabel(): string {
    return this.selectedColors.length > 0 ? `Đã chọn ${this.selectedColors.length}` : 'Tất cả';
  }

  getSizeLabel(): string {
    return this.selectedSizes.length > 0 ? `Đã chọn ${this.selectedSizes.length}` : 'Tất cả';
  }

  isPriceSelected(value: string): boolean {
    return this.selectedPriceRanges.includes(value);
  }

  isColorSelected(value: string): boolean {
    return this.selectedColors.includes(value);
  }

  isSizeSelected(value: string): boolean {
    return this.selectedSizes.includes(value);
  }

  isCategorySelected(value: string): boolean {
    if (!value) {
      return this.getResolvedSelectedCategoryIds().length === 0;
    }
    return this.getDisplaySelectedCategoryIds().includes(value);
  }

  isCategoryTreeMode(): boolean {
    return this.categoryTree.length > 0;
  }

  toggleGroupExpand(groupId: string): void {
    if (this.expandedGroupIds.has(groupId)) {
      this.expandedGroupIds.delete(groupId);
      return;
    }
    this.expandedGroupIds.add(groupId);
  }

  isGroupExpanded(groupId: string): boolean {
    return this.expandedGroupIds.has(groupId);
  }

  toggleCategoryGroup(group: FilterCategoryTreeGroup): void {
    if (group.id === 'bo-suu-tap') {
      const isChecked = this.selectedCategoryGroupId === group.id;
      this.selectedCategoryGroupId = isChecked ? '' : group.id;
      if (isChecked) {
        this.selectedCategoryIds = this.getResolvedSelectedCategoryIds().filter((id) => !this.isCollectionOption(id));
        this.selectedCategoryId = this.selectedCategoryIds.length === 1 ? this.selectedCategoryIds[0] : '';
      }
      this.syncExpandedGroupsToSelection();
      this.emitFilters();
      return;
    }

    const selected = new Set(this.getResolvedSelectedCategoryIds());
    const childIds = group.children.map((item) => item.value).filter(Boolean);
    const isChecked = childIds.length > 0 && childIds.every((id) => selected.has(id));

    if (isChecked) {
      childIds.forEach((id) => selected.delete(id));
    } else {
      childIds.forEach((id) => selected.add(id));
    }

    this.selectedCategoryIds = Array.from(selected);
    this.selectedCategoryId = this.selectedCategoryIds.length === 1 ? this.selectedCategoryIds[0] : '';
    this.syncExpandedGroupsToSelection();
    this.emitFilters();
  }

  isGroupChecked(group: FilterCategoryTreeGroup): boolean {
    if (this.selectedCategoryGroupId === group.id) {
      return true;
    }
    if (group.children.length === 0) {
      return false;
    }
    const selected = new Set(this.getResolvedSelectedCategoryIds());
    return group.children.every((item) => selected.has(item.value));
  }

  isGroupIndeterminate(group: FilterCategoryTreeGroup): boolean {
    if (this.selectedCategoryGroupId === group.id) {
      return false;
    }
    const selected = new Set(this.getResolvedSelectedCategoryIds());
    const childCount = group.children.length;
    if (childCount === 0) {
      return false;
    }
    const selectedCount = group.children.filter((item) => selected.has(item.value)).length;
    return selectedCount > 0 && selectedCount < childCount;
  }

  selectedCategoryChips(): FilterSelectOption[] {
    const selectedSet = new Set(this.getDisplaySelectedCategoryIds());
    const sourceOptions = this.categoryOptions.length > 0 ? this.categoryOptions : this.categoryTree.flatMap((group) => group.children);
    const selectedOptions = sourceOptions.filter((option) => selectedSet.has(option.value));

    if (selectedOptions.length > 0) {
      return selectedOptions;
    }

    return [];
  }

  getCategoryChipLabel(): string {
    return this.buildGroupedChipText(this.selectedCategoryChips().map((option) => option.label));
  }

  getPriceChipLabel(): string {
    return this.buildGroupedChipText(this.selectedPriceChips().map((option) => option.label), 2);
  }

  getColorChipLabel(): string {
    return this.selectedColorChips()
      .map((option) => option.label)
      .join(',');
  }

  getSizeChipLabel(): string {
    return this.buildGroupedChipText(this.selectedSizeChips().map((option) => option.label), 3);
  }

  getColorSwatchStyle(value: string): { background: string } {
    const dynamicColor = this.colorOptions.find((option) => option.value === value);
    if (dynamicColor?.hex) {
      return { background: dynamicColor.hex };
    }

    const map: Record<string, string> = {
      trang: '#f5f5f4',
      den: '#111827',
      xam: '#9ca3af',
      nau: '#8b5e3c',
      xanh: '#6f96bf',
      mix: 'linear-gradient(135deg, #f4d03f 0%, #d98880 48%, #85c1e9 100%)',
    };
    const background = map[value] || '#d1d5db';
    return { background };
  }

  hasSelectedFilters(): boolean {
    return (
      Boolean(this.selectedCategoryGroupId) ||
      this.getResolvedSelectedCategoryIds().length > 0 ||
      this.selectedPriceRanges.length > 0 ||
      this.selectedColors.length > 0 ||
      this.selectedSizes.length > 0
    );
  }

  removeFilterChip(type: FilterChipType, value?: string): void {
    if (type === 'category') {
      if (!value) {
        this.selectedCategoryIds = [];
        this.selectedCategoryId = '';
        this.selectedCategoryGroupId = '';
      } else {
        this.selectedCategoryIds = this.getResolvedSelectedCategoryIds().filter((id) => id !== value);
        this.selectedCategoryId = this.selectedCategoryIds.length === 1 ? this.selectedCategoryIds[0] : '';
      }
      this.syncExpandedGroupsToSelection();
      this.emitFilters();
      return;
    }

    if (type === 'price') {
      this.selectedPriceRanges = value ? this.selectedPriceRanges.filter((item) => item !== value) : [];
    } else if (type === 'color') {
      this.selectedColors = value ? this.selectedColors.filter((item) => item !== value) : [];
    } else {
      this.selectedSizes = value ? this.selectedSizes.filter((item) => item !== value) : [];
    }

    this.emitFilters();
  }

  clearAllFilters(): void {
    this.selectedCategoryIds = [];
    this.selectedCategoryId = '';
    this.selectedCategoryGroupId = '';
    this.selectedPriceRanges = [];
    this.selectedColors = [];
    this.selectedSizes = [];
    this.syncExpandedGroupsToSelection();
    this.emitFilters();
  }

  trackByOptionValue(index: number, option: FilterSelectOption): string {
    return option.value || String(index);
  }

  trackByGroupId(index: number, group: FilterCategoryTreeGroup): string {
    return group.id || String(index);
  }

  emitFilters(): void {
    const selectedCategoryGroupId = this.selectedCategoryGroupId;
    const displaySelectedIds = this.getDisplaySelectedCategoryIds();
    const sourceOptions =
      this.categoryOptions.length > 0 ? this.categoryOptions : this.categoryTree.flatMap((group) => group.children);
    const selectedOptions = sourceOptions.filter((option) => displaySelectedIds.includes(option.value));
    const collectionIds = selectedOptions.filter((option) => option.type === 'collection').map((option) => option.value);
    const categoryIds = selectedOptions.filter((option) => option.type !== 'collection').map((option) => option.value);
    const hasCollection = collectionIds.length > 0;
    const hasCategory = categoryIds.length > 0;
    const categoryType: 'category' | 'collection' | 'mixed' | 'none' =
      hasCollection && hasCategory
        ? 'mixed'
        : hasCategory
          ? 'category'
          : hasCollection
            ? 'collection'
            : 'none';
    const effectiveCategoryId =
      categoryType === 'collection'
        ? collectionIds[0] || ''
        : categoryType === 'category'
          ? this.selectedCategoryId || (categoryIds.length === 1 ? categoryIds[0] : '')
          : '';

    this.filtersChange.emit({
      categoryId: effectiveCategoryId,
      categoryIds,
      collectionIds,
      categoryGroupId: selectedCategoryGroupId,
      categoryType,
      priceRanges: this.selectedPriceRanges,
      colors: this.selectedColors,
      sizes: this.selectedSizes,
      priceRange: this.selectedPriceRanges[0] || '',
      color: this.selectedColors[0] || '',
      size: this.selectedSizes[0] || '',
    });
  }

  selectedPriceChips(): FilterSelectOption[] {
    const selectedSet = new Set(this.selectedPriceRanges);
    return this.priceOptions.filter((option) => selectedSet.has(option.value));
  }

  selectedColorChips(): FilterSelectOption[] {
    const selectedSet = new Set(this.selectedColors);
    return this.colorOptions.filter((option) => selectedSet.has(option.value));
  }

  selectedSizeChips(): FilterSelectOption[] {
    const selectedSet = new Set(this.selectedSizes);
    return this.sizeOptions.filter((option) => selectedSet.has(option.value));
  }

  getDisplayedCategoryLabel(): string {
    const selectedIds = this.getDisplaySelectedCategoryIds();
    if (selectedIds.length === 0 && this.selectedCategoryGroupId) {
      return this.getCategoryLabel();
    }

    if (selectedIds.length === 0) {
      return this.categoryTriggerLabel || this.categoryDefaultLabel;
    }

    const sourceOptions =
      this.categoryOptions.length > 0 ? this.categoryOptions : this.categoryTree.flatMap((group) => group.children);
    const selectedOptions = sourceOptions.filter((option) => selectedIds.includes(option.value));

    if (selectedOptions.length === 1) {
      return selectedOptions[0].label;
    }

    return this.getCategoryLabel();
  }

  isCategoryMultiSelect(): boolean {
    return this.categoryOptions.length > 0 && this.categoryOptions.every((option) => option.type !== 'collection');
  }

  private resolveLabel(options: FilterSelectOption[], value: string, fallback: string): string {
    const selected = options.find((option) => option.value === value);
    return selected?.label || fallback;
  }

  private getResolvedSelectedCategoryIds(): string[] {
    if (this.selectedCategoryIds.length > 0) {
      return this.selectedCategoryIds;
    }
    return this.selectedCategoryId ? [this.selectedCategoryId] : [];
  }

  private getSelectedCategoryCount(): number {
    return this.getDisplaySelectedCategoryIds().length;
  }

  private getDisplaySelectedCategoryIds(): string[] {
    const displayIds = new Set(this.getResolvedSelectedCategoryIds());

    if (this.selectedCategoryGroupId) {
      const selectedGroup = this.categoryTree.find((group) => group.id === this.selectedCategoryGroupId);
      selectedGroup?.children.forEach((item) => {
        if (item.value) {
          displayIds.add(item.value);
        }
      });
    }

    return Array.from(displayIds);
  }

  private toggleCategoryLeaf(value: string): void {
    if (!value) {
      this.selectedCategoryIds = [];
      this.selectedCategoryId = '';
      this.selectedCategoryGroupId = '';
      this.syncExpandedGroupsToSelection();
      return;
    }

    if (this.isCollectionOption(value)) {
      this.selectedCategoryGroupId = '';
    }
    const nextSet = new Set(this.getResolvedSelectedCategoryIds());
    if (nextSet.has(value)) {
      nextSet.delete(value);
    } else {
      nextSet.add(value);
    }

    this.selectedCategoryIds = Array.from(nextSet);
    this.selectedCategoryId = this.selectedCategoryIds.length === 1 ? this.selectedCategoryIds[0] : '';
    this.syncExpandedGroupsToSelection();
  }

  private isCollectionOption(value: string): boolean {
    return this.categoryTree.some((group) =>
      group.children.some((child) => child.value === value && child.type === 'collection')
    );
  }

  private syncExpandedGroupsToSelection(): void {
    const nextExpandedGroupIds = new Set<string>();

    if (this.selectedCategoryGroupId) {
      nextExpandedGroupIds.add(this.selectedCategoryGroupId);
    }

    const selectedIds = new Set(this.getResolvedSelectedCategoryIds());
    if (selectedIds.size > 0) {
      this.categoryTree.forEach((group) => {
        if (group.children.some((child) => selectedIds.has(child.value))) {
          nextExpandedGroupIds.add(group.id);
        }
      });
    }

    if (nextExpandedGroupIds.size === 0) {
      this.preferredExpandedGroupIds
        .filter((id) => this.categoryTree.some((group) => group.id === id))
        .forEach((id) => nextExpandedGroupIds.add(id));
    }

    this.expandedGroupIds.clear();
    nextExpandedGroupIds.forEach((id) => this.expandedGroupIds.add(id));
  }

  private toggleMultiValue(values: string[], value: string, assign: (next: string[]) => void): void {
    const nextSet = new Set(values);
    if (nextSet.has(value)) {
      nextSet.delete(value);
    } else {
      nextSet.add(value);
    }
    assign(Array.from(nextSet));
  }

  private buildGroupedChipText(values: string[], maxVisible = 3): string {
    if (!values.length) {
      return '';
    }

    const visibleValues = values.slice(0, maxVisible);
    const suffix = values.length > maxVisible ? ', Khác' : '';
    return `${visibleValues.join(',')}${suffix}`;
  }
}
