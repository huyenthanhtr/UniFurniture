import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CollectionService } from '../../services/admin-collections'; 
import { AdminProductsService } from '../../services/admin-products';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-collections',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-collections.html',
  styleUrl: './admin-collections.css'
})
export class AdminCollections implements OnInit {
  collections: any[] = [];
  filteredCollections: any[] = [];

  searchTerm: string = '';
  statusFilter: string = 'all';

  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  currentPage: number = 1;
  itemsPerPage: number = 10;
  Math = Math;

  showModal: boolean = false;
  isEditMode: boolean = false;
  currentCollection: any = {};
  
  selectedFile: File | null = null; 
  imagePreview: string | ArrayBuffer | null = null; 

  validationError: string = '';
  showConfirmPopup: boolean = false;
  showResultPopup: boolean = false;
  resultMessage = { title: '', message: '', type: '' as 'success' | 'error' };
  pendingStatusChange: { item: any, newStatus: string } | null = null; 

  showProductsModal: boolean = false;
  isLoadingProducts: boolean = false;
  selectedCollectionForProducts: any = null;
  collectionProducts: any[] = [];

  constructor(
    private collectionService: CollectionService,
    private productService: AdminProductsService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

ngOnInit(): void {
    const savedPage = sessionStorage.getItem('adminCollectionsPage');
    if (savedPage) {
      this.currentPage = parseInt(savedPage, 10);
    }
    this.loadCollections();
  }
  loadCollections() {
    this.collectionService.getAllCollections().subscribe({
      next: (data: any) => {
        this.collections = data;
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error(err)
    });
  }

applyFilters(resetPage: boolean = false): void {    let filtered = this.collections.filter(col => {
      const matchSearch = col.name?.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatus = this.statusFilter === 'all' || col.status === this.statusFilter;
      return matchSearch && matchStatus;
    });

    if (this.sortColumn) {
      filtered.sort((a: any, b: any) => {
        let valA = a[this.sortColumn];
        let valB = b[this.sortColumn];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
  if (resetPage) {
      this.currentPage = 1;
      sessionStorage.setItem('adminCollectionsPage', '1');
    } else {
      const maxPage = Math.max(1, this.totalPages);
      if (this.currentPage > maxPage) {
        this.currentPage = maxPage;
        sessionStorage.setItem('adminCollectionsPage', this.currentPage.toString());
      }
    }
    this.filteredCollections = filtered;
    this.cdr.detectChanges()
  }
get totalPages(): number {
    return Math.ceil(this.filteredCollections.length / this.itemsPerPage);
  }
  get visiblePages(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const pages: number[] = [];

    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, 5);
      } else if (current >= total - 2) {
        pages.push(total - 4, total - 3, total - 2, total - 1, total);
      } else {
        pages.push(current - 2, current - 1, current, current + 1, current + 2);
      }
    }
    return pages;
  }
  sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  getSortIcon(column: string) {
    if (this.sortColumn !== column) return 'fa-sort text-muted';
    return this.sortDirection === 'asc' ? 'fa-sort-up active' : 'fa-sort-down active';
  }

  resetFilters() {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.sortColumn = '';
    this.sortDirection = 'asc';
    this.applyFilters();
  }

changePage(page: number): void {
    this.currentPage = page;
    sessionStorage.setItem('adminCollectionsPage', page.toString());
  }  
  get paginatedCollections() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredCollections.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get isFormValid(): boolean {
    const c = this.currentCollection;
    if (!c || !c.name || c.name.toString().trim() === '') return false;
    if (this.validationError !== '') return false; 
    return true;
  }

  realTimeValidate(): void {
    const c = this.currentCollection;
    this.validationError = '';
    if (!c.name || c.name.trim() === '') {
      this.validationError = 'Tên bộ sưu tập không được để trống.';
    }
  }

  openAddModal() {
    this.isEditMode = false;
    this.validationError = '';
    this.currentCollection = { status: 'active' };
    this.selectedFile = null; this.imagePreview = null; 
    this.showModal = true;
  }

  openEditModal(collection: any) {
    this.isEditMode = true;
    this.validationError = '';
    this.currentCollection = { ...collection };
    this.selectedFile = null; this.imagePreview = null; 
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.showConfirmPopup = false;
    this.currentCollection = {};
    this.selectedFile = null; 
    this.imagePreview = null;
  }

  showResult(title: string, msg: string, type: 'success' | 'error') {
    this.resultMessage = { title, message: msg, type };
    this.showResultPopup = true;
    this.cdr.detectChanges();
  }

  confirmSave(): void {
    this.realTimeValidate();
    if (!this.validationError) {
      this.showConfirmPopup = true;
    }
  }

  cancelConfirm(): void {
    if (this.pendingStatusChange) {
      this.loadCollections(); 
    }
    this.showConfirmPopup = false;
    this.pendingStatusChange = null;
  }

  updateStatus(item: any): void {
    this.pendingStatusChange = { item: item, newStatus: item.status };
    this.showConfirmPopup = true;
  }

  executeSave(): void {
    this.showConfirmPopup = false;

    if (this.pendingStatusChange) {
      const { item, newStatus } = this.pendingStatusChange;
      const formData = new FormData();
      formData.append('status', newStatus);

      this.collectionService.updateCollection(item._id, formData as any).subscribe({
        next: () => {
          this.showResult('Thành công', 'Đã cập nhật trạng thái mới.', 'success');
          this.pendingStatusChange = null;
          this.loadCollections();
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.showResult('Lỗi', err.error?.message || 'Cập nhật thất bại.', 'error');
          this.pendingStatusChange = null;
          this.loadCollections();
          this.cdr.detectChanges();
        }
      });
      return; 
    }

    const formData = new FormData();
    formData.append('name', this.currentCollection.name);
    if (this.currentCollection.status) formData.append('status', this.currentCollection.status);
    if (this.currentCollection.description) formData.append('description', this.currentCollection.description);
    if (this.selectedFile) formData.append('banner', this.selectedFile);

    const request = this.isEditMode 
      ? this.collectionService.updateCollection(this.currentCollection._id, formData as any)
      : this.collectionService.createCollection(formData as any);

    request.subscribe({
      next: () => {
        this.showModal = false;
        this.loadCollections();
        this.showResult('Thành công', 'Bộ sưu tập đã được lưu vào hệ thống.', 'success');
        this.closeModal();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.showResult('Thất bại', err.error?.message || 'Lỗi server', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e) => { this.imagePreview = reader.result; };
      reader.readAsDataURL(file);
    }
  }
private normalizeId(value: any): string {
  if (!value) return '';

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  if (typeof value === 'object') {
    if (value.$oid) return String(value.$oid).trim();
    if (value._id) return this.normalizeId(value._id);
    if (value.id) return this.normalizeId(value.id);
  }

  return '';
}

private getProductCollectionId(product: any): string {
  return this.normalizeId(product?.collection_id);
}

private belongsToCollection(product: any, targetId: string): boolean {
  const candidates: any[] = [];

  if (product.collection_id) candidates.push(product.collection_id);
  if (product.collection) candidates.push(product.collection);

  if (Array.isArray(product.collection_ids)) {
    candidates.push(...product.collection_ids);
  }

  if (Array.isArray(product.collections)) {
    candidates.push(...product.collections);
  }

  return candidates.some(candidate => this.normalizeId(candidate) === targetId);
}
viewProducts(collection: any): void {
  this.selectedCollectionForProducts = collection;
  this.showProductsModal = true;
  this.isLoadingProducts = true;
  this.collectionProducts = [];
  this.cdr.detectChanges();

  const targetId = this.normalizeId(collection?._id);

  this.collectionService.getProductsByCollection(targetId).subscribe({
    next: (res: any) => {
      this.collectionProducts = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];

      console.log('Collection được chọn:', collection);
      console.log('targetId:', targetId);
      console.log('Products thuộc collection:', this.collectionProducts);

      this.isLoadingProducts = false;
      this.cdr.detectChanges();
    },
    error: (err: any) => {
      console.error('Lỗi tải sản phẩm theo bộ sưu tập:', err);
      this.collectionProducts = [];
      this.isLoadingProducts = false;
      this.cdr.detectChanges();
    }
  });
}
  closeProductsModal() {
    this.showProductsModal = false;
    this.selectedCollectionForProducts = null;
    this.collectionProducts = [];
    this.cdr.detectChanges();
  }

  goToProductDetail(prod: any) {
    this.closeProductsModal();
    const productId = prod._id?.$oid || prod._id || prod.slug; 
    this.router.navigate(['/admin/products', productId]);
  }
}