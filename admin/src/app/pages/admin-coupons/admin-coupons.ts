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
  
  // Quản lý trạng thái Popup
  showModal: boolean = false;
  isEdit: boolean = false;
  showConfirmPopup: boolean = false;
  showResultPopup: boolean = false;
  
  validationError: string = '';
  resultMessage = { title: '', message: '', type: '' as 'success' | 'error' };

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

  realTimeValidate(): void {
    const c = this.currentCoupon;
    this.validationError = '';

if (!c.code || c.code.trim() === '') {
    this.validationError = 'Mã code không được để trống.';
    return;
  }

  if (c.discount_value === null || c.discount_value === undefined) {
    this.validationError = 'Vui lòng nhập giá trị giảm giá.';
    return;
  }

  if (c.total_limit === null || c.total_limit === undefined) {
    this.validationError = 'Vui lòng nhập tổng lượt sử dụng.';
    return;
  }
    // 2. KIỂM TRA TRÙNG MÃ (Bổ sung mới)
  const isCodeExists = this.coupons.some(item => 
    item.code.trim().toUpperCase() === c.code.trim().toUpperCase() && 
    item._id !== c._id // Loại trừ chính nó nếu đang chỉnh sửa
  );

  if (isCodeExists) {
    this.validationError = `Mã "${c.code.toUpperCase()}" đã tồn tại trong hệ thống. Vui lòng chọn mã khác.`;
    return;
  }
    if (c.discount_type === 'percent' && c.discount_value >= 100 || c.discount_value <=0) {
      this.validationError = 'Phần trăm giảm giá phải lớn hơn 0% và nhỏ hơn 100%.';
      return;
    }

    if (new Date(c.start_at) > new Date(c.end_at)) {
      this.validationError = 'Ngày bắt đầu không được lớn hơn ngày kết thúc.';
      return;
    }

    if (c.discount_type === 'fixed') {
      this.currentCoupon.max_discount_amount = c.discount_value;
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
executeSave(): void {
    this.showConfirmPopup = false;
    const request = this.isEdit 
      ? this.couponService.updateCoupon(this.currentCoupon._id, this.currentCoupon)
      : this.couponService.createCoupon(this.currentCoupon);

    request.subscribe({
      next: () => {
        this.showModal = false;
        this.loadCoupons();
        this.showResult('Thành công', 'Dữ liệu khuyến mãi đã được lưu.', 'success');
        this.cdr.detectChanges(); // Ép hiện Popup thành công ngay lập tức
      },
      error: (err: any) => {
        this.showResult('Thất bại', err.error?.message || 'Lỗi server', 'error');
        this.cdr.detectChanges(); // Ép hiện Popup lỗi ngay lập tức
      }
    });
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

  updateStatus(item: any): void {
    this.couponService.updateCoupon(item._id, { status: item.status }).subscribe({
      next: () => this.showResult('Thành công', 'Đã cập nhật trạng thái.', 'success'),
      error: () => this.showResult('Lỗi', 'Cập nhật trạng thái thất bại.', 'error')
    });
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

}