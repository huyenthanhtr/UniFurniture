import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../services/admin-categories';
import { Category } from '../../models/category.model';

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

selectedFile: File | null = null; // Lưu file ảnh vật lý
imagePreview: string | ArrayBuffer | null = null; // Lưu chuỗi base64 để hiển thị xem trước
  
// --- BIẾN MỚI CHO RÀNG BUỘC VÀ THÔNG BÁO ---
  validationError: string = '';
  showConfirmPopup: boolean = false;
  showResultPopup: boolean = false;
  resultMessage = { title: '', message: '', type: '' as 'success' | 'error' };
  pendingStatusChange: { item: any, newStatus: string } | null = null; // Dùng khi đổi trạng thái ngoài bảng



constructor(
    private categoryService: CategoryService,
    private cdr: ChangeDetectorRef 
  ) { }

  ngOnInit(): void { this.loadCategories(); }

  loadCategories() {
    this.categoryService.getAllCategories().subscribe(data => {
      this.categories = data;
      this.applyFilters();
      this.cdr.detectChanges();
    });
  }

  applyFilters() {
    let filtered = this.categories.filter(cat => {
      const matchSearch = cat.name.toLowerCase().includes(this.searchTerm.toLowerCase()) || 
                          cat.category_code.toLowerCase().includes(this.searchTerm.toLowerCase());
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
    this.roomFilter = 'all';
    this.sortColumn = '';
    this.sortDirection = 'asc';
    this.applyFilters();
  }

// Gọi hàm này khi chọn Trạng thái từ Dropdown


  changePage(page: number) { this.currentPage = page; }
get paginatedCategories() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredCategories.slice(startIndex, startIndex + this.itemsPerPage);
  }
saveCategory() {
    if (!this.currentCategory.category_code || !this.currentCategory.name || !this.currentCategory.room) {
      alert('Vui lòng điền đầy đủ các trường bắt buộc!');
      return;
    }

    // ĐÓNG GÓI DỮ LIỆU VÀO FORMDATA
    const formData = new FormData();
    formData.append('category_code', this.currentCategory.category_code);
    formData.append('name', this.currentCategory.name);
    formData.append('room', this.currentCategory.room);
    
    if (this.currentCategory.status) {
      formData.append('status', this.currentCategory.status);
    }
    if (this.currentCategory.description) {
      formData.append('description', this.currentCategory.description);
    }

    // NẾU CÓ CHỌN FILE ẢNH MỚI THÌ NHÉT VÀO GÓI HÀNG (Tên 'image' phải khớp với uploadImage.single('image') ở Backend)
    if (this.selectedFile) {
      formData.append('image', this.selectedFile);
    }

    // Gọi API lưu dữ liệu
    if (this.isEditMode && this.currentCategory._id) {
      this.categoryService.updateCategory(this.currentCategory._id, formData).subscribe({
        next: () => { this.loadCategories(); this.closeModal(); },
        error: (err) => alert('Lỗi Backend: ' + (err.error?.message || err.message))
      });
    } else {
      this.categoryService.createCategory(formData).subscribe({
        next: () => { this.loadCategories(); this.closeModal(); },
        error: (err) => alert('Lỗi Backend: ' + (err.error?.message || err.message))
      });
    }
  }
  // Bắt sự kiện khi người dùng chọn file

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

    // Kiểm tra trùng Mã Danh Mục
    const isCodeExists = this.categories.some(item => 
      item.category_code.trim().toUpperCase() === c.category_code!.trim().toUpperCase() && 
      item._id !== c._id // Trừ chính nó nếu đang Edit
    );

    if (isCodeExists) {
      this.validationError = `Mã "${c.category_code!.toUpperCase()}" đã tồn tại. Vui lòng chọn mã khác.`;
      return;
    }
  }
// ================= QUẢN LÝ MODAL & POPUP =================
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

  // Bấm "Lưu thông tin" ở Form sẽ gọi hàm này để mở Popup hỏi lại
  confirmSave(): void {
    this.realTimeValidate();
    if (!this.validationError) {
      this.showConfirmPopup = true;
    }
  }

  cancelConfirm(): void {
    if (this.pendingStatusChange) {
      this.loadCategories(); // Reset lại UI nếu hủy đổi trạng thái ngoài bảng
    }
    this.showConfirmPopup = false;
    this.pendingStatusChange = null;
  }

  // Đổi trạng thái trực tiếp trên bảng
  updateStatus(item: Category): void {
    this.pendingStatusChange = { item: item, newStatus: item.status };
    this.showConfirmPopup = true;
  }

  // ================= THỰC THI GỌI API =================
  executeSave(): void {
    this.showConfirmPopup = false;

    // 1. Trường hợp lưu trạng thái từ bảng
    if (this.pendingStatusChange) {
      const { item, newStatus } = this.pendingStatusChange;
      const updatedItem = { ...item, status: newStatus }; // Gói dữ liệu
      
      this.categoryService.updateCategory(item._id!, updatedItem as any).subscribe({
        next: () => {
          this.showResult('Thành công', 'Đã cập nhật trạng thái mới.', 'success');
          this.pendingStatusChange = null;
          this.loadCategories();
          this.cdr.detectChanges(); // Thêm dòng này
        },
        error: (err: any) => {
          this.showResult('Lỗi', err.error?.message || 'Cập nhật thất bại.', 'error');
          this.pendingStatusChange = null;
          this.loadCategories(); // Reset UI do lỗi
          this.cdr.detectChanges(); // Thêm dòng này
        }
      });
      return; // Dừng hàm
    }

    // 2. Trường hợp lưu từ Form Modal
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
        this.cdr.detectChanges(); // Thêm dòng này
      },
      error: (err: any) => {
        this.showResult('Thất bại', err.error?.message || 'Lỗi server', 'error');
        this.cdr.detectChanges(); // Thêm dòng này
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