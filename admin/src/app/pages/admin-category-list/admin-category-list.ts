import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../services/admin-categories';
import { Category } from '../../models/category.model';
import { AdminProductsService } from '../../services/admin-products';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-category-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-category-list.html',
  styleUrl: './admin-category-list.css'
})
export class AdminCategoryList implements OnInit {
  categories: Category[] = [];
  filteredCategories: Category[] = [];

  searchTerm: string = '';
  statusFilter: string = 'all';
  roomFilter: string = 'all';

  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  currentPage: number = 1;
  itemsPerPage: number = 10;
  Math = Math;

  showModal: boolean = false;
  isEditMode: boolean = false;
  currentCategory: Partial<Category> = {};
  rooms: string[] = ['Phòng khách', 'Phòng ăn', 'Phòng ngủ', 'Phòng làm việc'];

  selectedFile: File | null = null; 
  imagePreview: string | ArrayBuffer | null = null; 
  
  validationError: string = '';
  showConfirmPopup: boolean = false;
  showResultPopup: boolean = false;
  resultMessage = { title: '', message: '', type: '' as 'success' | 'error' };
  pendingStatusChange: { item: any, newStatus: string } | null = null; 

  showProductsModal: boolean = false;
  isLoadingProducts: boolean = false;
  selectedCategoryForProducts: Category | null = null;
  categoryProducts: any[] = [];

  constructor(
    private categoryService: CategoryService,
    private cdr: ChangeDetectorRef, 
    private productService: AdminProductsService,
    private router: Router
  ) { }

ngOnInit(): void {
    const savedPage = sessionStorage.getItem('adminCategoryPage');
    if (savedPage) {
      this.currentPage = parseInt(savedPage, 10);
    }
    this.loadCategories();
  }
  loadCategories() {
    this.categoryService.getAllCategories().subscribe(data => {
      this.categories = data;
      this.applyFilters();
      this.cdr.detectChanges();
    });
  }

applyFilters(resetPage: boolean = false): void {    
  let filtered = this.categories.filter(cat => {
    const matchSearch =
      (cat.name || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      (cat.category_code || '').toLowerCase().includes(this.searchTerm.toLowerCase());

    const matchStatus = this.statusFilter === 'all' || cat.status === this.statusFilter;
    const matchRoom = this.roomFilter === 'all' || cat.room === this.roomFilter;

    return matchSearch && matchStatus && matchRoom;
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

  this.filteredCategories = filtered;

  if (resetPage) {
    this.currentPage = 1;
    sessionStorage.setItem('adminCategoryPage', '1');
  } else {
    const maxPage = Math.max(1, this.totalPages);
    if (this.currentPage > maxPage) {
      this.currentPage = maxPage;
      sessionStorage.setItem('adminCategoryPage', this.currentPage.toString());
    }
  }

  this.cdr.detectChanges();
}
  get totalPages(): number {
    return Math.ceil(this.filteredCategories.length / this.itemsPerPage);
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
get paginatedCategories(): any[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredCategories.slice(startIndex, startIndex + this.itemsPerPage);
  }
  changePage(page: number): void {
    this.currentPage = page;
    sessionStorage.setItem('adminCategoryPage', page.toString());
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
    this.roomFilter = 'all';
    this.sortColumn = '';
    this.sortDirection = 'asc';
    this.applyFilters();
  }


  get isFormValid(): boolean {
    const c = this.currentCategory;
    if (!c) return false;
    if (!c.category_code || c.category_code.toString().trim() === '') return false;
    if (!c.name || c.name.toString().trim() === '') return false;
    if (!c.room || c.room.toString().trim() === '') return false;
    if (this.validationError !== '') return false; 
    return true;
  }

  realTimeValidate(): void {
    const c = this.currentCategory;
    this.validationError = '';

    if (!c.category_code || c.category_code.trim() === '') {
      this.validationError = 'Mã danh mục không được để trống.'; return;
    }
    if (!c.name || c.name.trim() === '') {
      this.validationError = 'Tên danh mục không được để trống.'; return;
    }
    if (!c.room || c.room.trim() === '') {
      this.validationError = 'Vui lòng chọn không gian.'; return;
    }

    const isCodeExists = this.categories.some(item => 
      item.category_code.trim().toUpperCase() === c.category_code!.trim().toUpperCase() && 
      item._id !== c._id 
    );

    if (isCodeExists) {
      this.validationError = `Mã "${c.category_code!.toUpperCase()}" đã tồn tại. Vui lòng chọn mã khác.`;
      return;
    }
  }

  openAddModal() {
    this.isEditMode = false;
    this.validationError = '';
    this.currentCategory = { status: 'active', room: 'Phòng khách' } as Partial<Category>;
    this.selectedFile = null; this.imagePreview = null; 
    this.showModal = true;
  }

  openEditModal(category: Category) {
    this.isEditMode = true;
    this.validationError = '';
    this.currentCategory = { ...category };
    this.selectedFile = null; this.imagePreview = null; 
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.showConfirmPopup = false;
    this.currentCategory = {};
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
      this.loadCategories(); 
    }
    this.showConfirmPopup = false;
    this.pendingStatusChange = null;
  }

  updateStatus(item: Category): void {
    this.pendingStatusChange = { item: item, newStatus: item.status };
    this.showConfirmPopup = true;
  }

  executeSave(): void {
    this.showConfirmPopup = false;

    if (this.pendingStatusChange) {
      const { item, newStatus } = this.pendingStatusChange;
      const updatedItem = { ...item, status: newStatus }; 
      
      this.categoryService.updateCategory(item._id!, updatedItem as any).subscribe({
        next: () => {
          this.showResult('Thành công', 'Đã cập nhật trạng thái mới.', 'success');
          this.pendingStatusChange = null;
          this.loadCategories();
          this.cdr.detectChanges(); 
        },
        error: (err: any) => {
          this.showResult('Lỗi', err.error?.message || 'Cập nhật thất bại.', 'error');
          this.pendingStatusChange = null;
          this.loadCategories(); 
          this.cdr.detectChanges(); 
        }
      });
      return; 
    }

    const formData = new FormData();
    formData.append('category_code', this.currentCategory.category_code!);
    formData.append('name', this.currentCategory.name!);
    formData.append('room', this.currentCategory.room!);
    if (this.currentCategory.status) formData.append('status', this.currentCategory.status);
    if (this.currentCategory.description) formData.append('description', this.currentCategory.description);
    if (this.selectedFile) formData.append('image', this.selectedFile);

    const request = this.isEditMode 
      ? this.categoryService.updateCategory(this.currentCategory._id!, formData as any)
      : this.categoryService.createCategory(formData as any);

    request.subscribe({
      next: () => {
        this.showModal = false;
        this.loadCategories();
        this.showResult('Thành công', 'Danh mục đã được lưu vào hệ thống.', 'success');
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
viewProducts(category: Category) {
  if (!category._id) return;

  this.selectedCategoryForProducts = category;
  this.showProductsModal = true;
  this.isLoadingProducts = true;
  this.categoryProducts = [];
  this.cdr.detectChanges();

  this.categoryService.getProductsByCategory(category._id).subscribe({
    next: (products: any[]) => {
      this.categoryProducts = Array.isArray(products) ? products : [];
      this.isLoadingProducts = false;
      this.cdr.detectChanges();
    },
    error: (err: any) => {
      console.error('Lỗi tải sản phẩm của danh mục:', err);
      this.categoryProducts = [];
      this.isLoadingProducts = false;
      this.cdr.detectChanges();
    }
  });
}

  closeProductsModal() {
    this.showProductsModal = false;
    this.selectedCategoryForProducts = null;
    this.categoryProducts = [];
    this.cdr.detectChanges();
  }

  goToProductDetail(prod: any) {
    this.closeProductsModal();
    
    const productId = prod._id?.$oid || prod._id || prod.slug; 
    
    this.router.navigate(['/admin/products', productId]);
  }
}