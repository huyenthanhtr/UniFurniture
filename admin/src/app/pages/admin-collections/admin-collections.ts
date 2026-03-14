import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// Lưu ý: Đổi tên Service dưới đây thành Service quản lý collection của bạn
import { CollectionService } from '../../services/admin-collections'; 

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

  constructor(
    private collectionService: CollectionService,
    private cdr: ChangeDetectorRef 
  ) { }

  ngOnInit(): void { this.loadCollections(); }

  loadCollections() {
    this.collectionService.getAllCollections().subscribe(data => {
      this.collections = data;
      this.applyFilters();
      this.cdr.detectChanges();
    });
  }

  applyFilters() {
    let filtered = this.collections.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatus = this.statusFilter === 'all' || item.status === this.statusFilter;
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
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  resetFilters() {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.sortColumn = '';
    this.sortDirection = 'asc';
    this.applyFilters();
  }

  get paginatedCollections() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredCollections.slice(startIndex, startIndex + this.itemsPerPage);
  }

  changePage(page: number) { this.currentPage = page; }

  // ================= RÀNG BUỘC (VALIDATION) =================
  realTimeValidate(): void {
    const c = this.currentCollection;
    this.validationError = '';

    if (!c.name || c.name.trim() === '') {
      this.validationError = 'Tên bộ sưu tập không được để trống.'; return;
    }

    // Kiểm tra trùng Tên bộ sưu tập
    const isNameExists = this.collections.some(item => 
      item.name.trim().toUpperCase() === c.name.trim().toUpperCase() && 
      item._id !== c._id
    );

    if (isNameExists) {
      this.validationError = `Bộ sưu tập "${c.name.toUpperCase()}" đã tồn tại. Vui lòng chọn tên khác.`;
      return;
    }
  }

  // ================= QUẢN LÝ MODAL & POPUP =================
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

  // ================= THỰC THI GỌI API =================
  executeSave(): void {
    this.showConfirmPopup = false;

    if (this.pendingStatusChange) {
      const { item, newStatus } = this.pendingStatusChange;
      const updatedItem = { ...item, status: newStatus }; 
      
      this.collectionService.updateCollection(item._id, updatedItem).subscribe({
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
    
    // TRƯỜNG HỢP NÀY LÀ BANNER NHÉ (Giả định Backend bạn dùng uploadImage.single('banner'))
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
}