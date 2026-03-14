import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminCouponsService } from '../../services/admin-coupons'; 

@Component({
  selector: 'app-admin-coupons',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-coupons.html',
  styleUrls: ['./admin-coupons.css']
})
export class AdminCoupons implements OnInit {
  private couponService = inject(AdminCouponsService) as any;
  private cdr = inject(ChangeDetectorRef); // Inject ChangeDetectorRef để ép cập nhật UI
  coupons: any[] = [];
  currentCoupon: any = {};
  pendingStatusChange: { item: any, newStatus: string } | null = null;
  // Quản lý trạng thái Popup
  showModal: boolean = false;
  isEdit: boolean = false;
  showConfirmPopup: boolean = false;
  showResultPopup: boolean = false;
  
  validationError: string = '';
  resultMessage = { title: '', message: '', type: '' as 'success' | 'error' };
  filter = {
    search: '',
    type: '',
    status: '',
    onlyAvailable: false, // Lọc còn lượt dùng
    startDate: '',
    endDate: ''
  };

  sortConfig = {
    column: '',
    direction: 'asc' // 'asc' hoặc 'desc'
  };
  ngOnInit(): void {
    this.loadCoupons();
  }

loadCoupons(): void {
    this.couponService.getCoupons().subscribe({
      next: (data: any) => { 
        this.coupons = this.checkAndFormatCoupons(data); 
        this.cdr.detectChanges(); // 3. Ép Angular vẽ lại bảng ngay khi có dữ liệu
      },
      error: (err: any) => { 
        console.error(err);
        this.cdr.detectChanges(); 
      }
    });
  }

openModal(coupon: any = null): void {
    this.showModal = true;
    this.validationError = '';
    if (coupon) {
      this.isEdit = true;
      this.currentCoupon = { 
        ...coupon,
        start_at: new Date(coupon.start_at).toISOString().split('T')[0],
        end_at: new Date(coupon.end_at).toISOString().split('T')[0]
      };
    } else {
      this.isEdit = false;
      const today = new Date().toISOString().split('T')[0];
      this.currentCoupon = {
        code: '', discount_type: 'percent', discount_value: 0,
        max_discount_amount: 0, min_order_value: 0, used: 0,
        total_limit: 10, status: 'active', start_at: today, end_at: today
      };
    }
    this.cdr.detectChanges();
  }
// THÊM ĐOẠN NÀY VÀO: Getter kiểm tra form đã điền đủ thông tin cơ bản chưa
  get isFormValid(): boolean {
    const c = this.currentCoupon;
    if (!c) return false;
    
    // Kiểm tra các trường bắt buộc không được để trống hoặc bằng 0
    if (!c.code || c.code.toString().trim() === '') return false;
    if (c.discount_value === null || c.discount_value === undefined || c.discount_value <= 0) return false;
    if (c.total_limit === null || c.total_limit === undefined || c.total_limit <= 0) return false;
    if (!c.start_at || !c.end_at) return false;
    
    // Nếu đang có bất kỳ dòng thông báo lỗi đỏ nào thì cũng khóa nút
    if (this.validationError !== '') return false; 
    
    return true;
  }
realTimeValidate(): void {
    const c = this.currentCoupon;
    this.validationError = ''; // Reset lỗi trước khi kiểm tra

    // 1. Kiểm tra Mã code
    if (!c.code || c.code.trim() === '') {
      this.validationError = 'Mã code không được để trống.';
      return;
    }

    // 2. Kiểm tra Trùng mã code
    const isCodeExists = this.coupons.some(item => 
      item.code.trim().toUpperCase() === c.code.trim().toUpperCase() && 
      item._id !== c._id // Loại trừ chính nó nếu đang chỉnh sửa
    );
    if (isCodeExists) {
      this.validationError = `Mã "${c.code.toUpperCase()}" đã tồn tại. Vui lòng chọn mã khác.`;
      return;
    }

    // 3. Kiểm tra Giá trị giảm giá
    if (c.discount_value === null || c.discount_value === undefined || c.discount_value <= 0) {
      this.validationError = 'Giá trị giảm giá phải lớn hơn 0.';
      return;
    }

    // 4. Ràng buộc phần trăm
    if (c.discount_type === 'percent' && c.discount_value >= 100) {
      this.validationError = 'Phần trăm giảm giá phải nhỏ hơn 100%.';
      return;
    }

    // 5. Tự động đồng bộ giảm tối đa (Nếu là cố định)
    if (c.discount_type === 'fixed') {
      this.currentCoupon.max_discount_amount = c.discount_value;
    }

    // 6. Kiểm tra Tổng lượt dùng
    if (c.total_limit === null || c.total_limit === undefined || c.total_limit <= 0) {
      this.validationError = 'Tổng lượt sử dụng phải lớn hơn 0.';
      return;
    }

    // 7. Kiểm tra Ngày tháng
    if (!c.start_at) {
      this.validationError = 'Vui lòng chọn ngày bắt đầu.';
      return;
    }
    if (!c.end_at) {
      this.validationError = 'Vui lòng chọn ngày kết thúc.';
      return;
    }
    if (new Date(c.start_at) > new Date(c.end_at)) {
      this.validationError = 'Ngày bắt đầu không được lớn hơn ngày kết thúc.';
      return;
    }
  }
  onTypeChange(): void {
    this.realTimeValidate();
  }

  confirmSave(): void {
    this.realTimeValidate();
    if (!this.validationError) {
      this.showConfirmPopup = true;
    }
  }


showResult(title: string, msg: string, type: 'success' | 'error') {
    this.resultMessage = { title, message: msg, type };
    this.showResultPopup = true;
    this.cdr.detectChanges(); // Đảm bảo Popup luôn hiện ra mà không cần click chuột
  }

closeModal(): void {
    this.showModal = false;
    this.showConfirmPopup = false;
    this.cdr.detectChanges();
  }

// Sửa lại hàm updateStatus
updateStatus(item: any): void {
  // 1. Lưu lại thông tin muốn thay đổi vào biến tạm
  this.pendingStatusChange = { 
    item: item, 
    newStatus: item.status 
  };
  
  // 2. Mở popup xác nhận (tận dụng popup có sẵn)
  this.showConfirmPopup = true;
}

// Sửa lại hàm executeSave để phân biệt giữa "Lưu từ Modal" và "Lưu từ Table"
executeSave(): void {
  this.showConfirmPopup = false;

  // TRƯỜNG HỢP 1: Cập nhật trạng thái từ bảng chính
  if (this.pendingStatusChange) {
    const { item, newStatus } = this.pendingStatusChange;
    
    this.couponService.updateCoupon(item._id, { status: newStatus }).subscribe({
      next: () => {
        this.showResult('Thành công', 'Đã cập nhật trạng thái mới.', 'success');
        this.pendingStatusChange = null; // Reset biến tạm
        this.loadCoupons(); // Load lại để đảm bảo data đồng bộ
      },
      error: (err: any) => {
        this.showResult('Lỗi', err.error?.message || 'Cập nhật thất bại.', 'error');
        this.pendingStatusChange = null;
        this.loadCoupons(); // Reset lại UI về trạng thái cũ do lỗi
      }
    });
    return; // Thoát hàm, không chạy phần code lưu Modal bên dưới
  }

  // TRƯỜNG HỢP 2: Lưu từ Modal (Code cũ của bạn)
  const request = this.isEdit 
    ? this.couponService.updateCoupon(this.currentCoupon._id, this.currentCoupon)
    : this.couponService.createCoupon(this.currentCoupon);

  request.subscribe({
    next: () => {
      this.showModal = false;
      this.loadCoupons();
      this.showResult('Thành công', 'Dữ liệu khuyến mãi đã được lưu.', 'success');
      this.cdr.detectChanges();
    },
    error: (err: any) => {
      this.showResult('Thất bại', err.error?.message || 'Lỗi server', 'error');
      this.cdr.detectChanges();
    }
  });
}

// Cập nhật lại nút "Quay lại" hoặc "Hủy" trong popup xác nhận
cancelConfirm(): void {
  if (this.pendingStatusChange) {
    this.loadCoupons(); // Load lại để Dropdown quay về giá trị cũ trong DB
  }
  this.showConfirmPopup = false;
  this.pendingStatusChange = null;
}
  
// Thêm hàm kiểm tra ngày vào class AdminCoupons
checkAndFormatCoupons(data: any[]): any[] {
  const now = new Date();
  // Đặt giờ về 00:00:00 để so sánh chính xác theo ngày nếu cần
  now.setHours(0, 0, 0, 0); 

  return data.map(coupon => {
    const endDate = new Date(coupon.end_at);
    endDate.setHours(0, 0, 0, 0);

    if (endDate < now) {
      // Nếu ngày kết thúc nhỏ hơn hiện tại -> Chắc chắn là Expired
      coupon.status = 'expired';
    } else if (coupon.status === 'expired' && endDate >= now) {
      // Nếu đang là Expired mà ngày kết thúc mới lại lớn hơn hoặc bằng hiện tại
      // Chuyển tự động về Active
      coupon.status = 'active';
    }
    return coupon;
  });
}
get filteredCoupons() {
    let result = [...this.coupons];

    // 1. Lọc theo Search (Mã code)
    if (this.filter.search) {
      const s = this.filter.search.toLowerCase();
      result = result.filter(c => c.code.toLowerCase().includes(s));
    }

    // 2. Lọc theo Loại
    if (this.filter.type) {
      result = result.filter(c => c.discount_type === this.filter.type);
    }

    // 3. Lọc theo Trạng thái
    if (this.filter.status) {
      result = result.filter(c => c.status === this.filter.status);
    }

    // 4. Lọc theo "Còn lượt dùng"
    if (this.filter.onlyAvailable) {
      result = result.filter(c => c.used < c.total_limit);
    }

    // 5. Lọc theo Thời hạn (Mã có hiệu lực trong khoảng ngày đã chọn)
  if (this.filter.startDate && this.filter.endDate) {
    const fStart = new Date(this.filter.startDate).getTime();
    const fEnd = new Date(this.filter.endDate).getTime();

    result = result.filter(c => {
      const cStart = new Date(c.start_at).getTime();
      const cEnd = new Date(c.end_at).getTime();
      
      // Logic: Ngày bắt đầu của mã phải <= ngày bắt đầu lọc
      // VÀ ngày kết thúc của mã phải >= ngày kết thúc lọc
      return cStart <= fStart && cEnd >= fEnd;
    });
  }

    // 6. Sắp xếp
if (this.sortConfig.column) {
    const col = this.sortConfig.column;
    const dir = this.sortConfig.direction === 'asc' ? 1 : -1;

    result.sort((a, b) => {
      let valA = a[col];
      let valB = b[col];

      // Xử lý riêng cho ngày tháng
      if (col === 'start_at' || col === 'end_at') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      // So sánh
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
  }
    return result;
  }

  // Hàm xử lý khi bấm vào tiêu đề cột để sắp xếp
  toggleSort(column: string) {
    if (this.sortConfig.column === column) {
      this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortConfig.column = column;
      this.sortConfig.direction = 'asc';
    }
  }

  // Hàm đặt lại bộ lọc
  resetFilters() {
    this.filter = {
      search: '',
      type: '',
      status: '',
      onlyAvailable: false,
      startDate: '',
      endDate: ''
    };
    this.sortConfig = { column: '', direction: 'asc' };
  }
}