import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CollectionService } from '../../services/admin-collections'; 
import { AdminProductsService } from '../../services/admin-products'; // Import service sản phẩm
import { Router } from '@angular/router'; // Import Router chuyển trang

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

  // --- QUẢN LÝ POPUP & FORM ---
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

  // --- BIẾN CHO MODAL XEM SẢN PHẨM ---
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

  ngOnInit(): void { this.loadCollections(); }

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

  applyFilters() {
    let filtered = this.collections.filter(col => {
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

    this.filteredCollections = filtered;
    this.currentPage = 1;
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

  changePage(page: number) { this.currentPage = page; }
  
  get paginatedCollections() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredCollections.slice(startIndex, startIndex + this.itemsPerPage);
  }

  // KHÓA NÚT LƯU
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

  // --- XỬ LÝ MODAL SẢN PHẨM ---
// --- XỬ LÝ MODAL SẢN PHẨM ---
  viewProducts(collection: any) {
    this.selectedCollectionForProducts = collection;
    this.showProductsModal = true;
    this.isLoadingProducts = true;
    this.collectionProducts = [];
    this.cdr.detectChanges();

    // 1. Lấy ID chuẩn của bộ sưu tập đang click
    const targetId = String(collection._id?.$oid || collection._id).trim();

    // 2. Ép Backend trả về toàn bộ sản phẩm (Không truyền collection_id lên nữa)
    const params: any = { limit: 1000 }; 

    this.productService.getProducts(params).subscribe({
      next: (res: any) => {
        setTimeout(() => {
          let allProducts = res.items || res.data || res || []; 
          
          // 3. FRONTEND TỰ RA TAY LỌC DỮ LIỆU
          this.collectionProducts = allProducts.filter((p: any) => {
            // Nếu sản phẩm không có trường collection_id thì loại luôn
            if (!p.collection_id) return false;

            // Lấy ID bộ sưu tập của từng sản phẩm
            const prodColId = String(p.collection_id?.$oid || p.collection_id).trim();

            // So sánh: Chỉ giữ lại những sản phẩm có ID khớp với bộ sưu tập đang click
            return prodColId === targetId;
          });
          
          this.isLoadingProducts = false;
          this.cdr.detectChanges();
        }, 0);
      },
      error: (err: any) => {
        setTimeout(() => {
          console.error('Lỗi tải sản phẩm của bộ sưu tập:', err);
          this.collectionProducts = [];
          this.isLoadingProducts = false;
          this.cdr.detectChanges();
        }, 0);
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