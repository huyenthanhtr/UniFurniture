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
  private cdr = inject(ChangeDetectorRef);

  coupons: any[] = [];
  currentCoupon: any = {};
  pendingStatusChange: { item: any, newStatus: string } | null = null;

  showModal = false;
  isEdit = false;
  showConfirmPopup = false;
  showResultPopup = false;

  validationError = '';
  resultMessage = { title: '', message: '', type: '' as 'success' | 'error' };

  filter = {
    search: '',
    type: '',
    status: '',
    onlyAvailable: false,
    startDate: '',
    endDate: ''
  };

  currentPage = 1;
  itemsPerPage = 10;

  sortConfig: { column: string; direction: 'asc' | 'desc' } = {
    column: '',
    direction: 'asc'
  };

  ngOnInit(): void {
    const savedPage = sessionStorage.getItem('adminCouponPage');
    if (savedPage) {
      this.currentPage = parseInt(savedPage, 10) || 1;
    }
    this.loadCoupons();
  }

  loadCoupons(): void {
    this.couponService.getCoupons().subscribe({
      next: (data: any[]) => {
        this.coupons = this.checkAndFormatCoupons(data);
        this.ensureValidPage();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  checkAndFormatCoupons(data: any[]): any[] {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return data.map(coupon => {
      const endDate = new Date(coupon.end_at);
      endDate.setHours(0, 0, 0, 0);

      if (endDate < now) {
        coupon.status = 'expired';
      } else if (coupon.status === 'expired' && endDate >= now) {
        coupon.status = 'active';
      }

      return coupon;
    });
  }

  private getFilteredRawData(): any[] {
    let result = [...this.coupons];

    if (this.filter.search) {
      const s = this.filter.search.toLowerCase().trim();
      result = result.filter(c => (c.code || '').toLowerCase().includes(s));
    }

    if (this.filter.type) {
      result = result.filter(c => c.discount_type === this.filter.type);
    }

    if (this.filter.status) {
      result = result.filter(c => c.status === this.filter.status);
    }

    if (this.filter.onlyAvailable) {
      result = result.filter(c => Number(c.used) < Number(c.total_limit));
    }

    if (this.filter.startDate && this.filter.endDate) {
      const fStart = new Date(this.filter.startDate);
      const fEnd = new Date(this.filter.endDate);
      fStart.setHours(0, 0, 0, 0);
      fEnd.setHours(23, 59, 59, 999);

      result = result.filter(c => {
        const cStart = new Date(c.start_at);
        const cEnd = new Date(c.end_at);
        return cEnd >= fStart && cStart <= fEnd;
      });
    }

    if (this.sortConfig.column) {
      result.sort((a: any, b: any) => {
        let valA = a[this.sortConfig.column];
        let valB = b[this.sortConfig.column];

        if (this.sortConfig.column === 'end_at' || this.sortConfig.column === 'start_at') {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        } else if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = (valB || '').toLowerCase();
        } else {
          valA = Number(valA ?? 0);
          valB = Number(valB ?? 0);
        }

        if (valA < valB) return this.sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }

  get filteredCoupons(): any[] {
    return this.getFilteredRawData();
  }

  get paginatedCoupons(): any[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredCoupons.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCoupons.length / this.itemsPerPage));
  }

  get visiblePages(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const pages: number[] = [];

    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else if (current <= 3) {
      pages.push(1, 2, 3, 4, 5);
    } else if (current >= total - 2) {
      pages.push(total - 4, total - 3, total - 2, total - 1, total);
    } else {
      pages.push(current - 2, current - 1, current, current + 1, current + 2);
    }

    return pages;
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    sessionStorage.setItem('adminCouponPage', page.toString());
    this.cdr.detectChanges();
  }

  ensureValidPage(): void {
    const maxPage = this.totalPages;
    if (this.currentPage > maxPage) {
      this.currentPage = maxPage;
      sessionStorage.setItem('adminCouponPage', this.currentPage.toString());
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
      sessionStorage.setItem('adminCouponPage', '1');
    }
  }

  onFilterChange(resetPage: boolean = true): void {
    if (resetPage) {
      this.currentPage = 1;
      sessionStorage.setItem('adminCouponPage', '1');
    } else {
      this.ensureValidPage();
    }
    this.cdr.detectChanges();
  }

  toggleSort(column: string): void {
    if (this.sortConfig.column === column) {
      this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortConfig.column = column;
      this.sortConfig.direction = 'asc';
    }

    this.currentPage = 1;
    sessionStorage.setItem('adminCouponPage', '1');
    this.cdr.detectChanges();
  }

  getSortIcon(column: string): string {
    if (this.sortConfig.column !== column) return 'fa-sort text-muted';
    return this.sortConfig.direction === 'asc' ? 'fa-sort-up active' : 'fa-sort-down active';
  }

  resetFilters(): void {
    this.filter = {
      search: '',
      type: '',
      status: '',
      onlyAvailable: false,
      startDate: '',
      endDate: ''
    };
    this.sortConfig = { column: '', direction: 'asc' };
    this.currentPage = 1;
    sessionStorage.setItem('adminCouponPage', '1');
    this.cdr.detectChanges();
  }

  get isFormValid(): boolean {
    const c = this.currentCoupon;
    if (!c) return false;
    if (!c.code || c.code.toString().trim() === '') return false;
    if (c.discount_value === null || c.discount_value === undefined || c.discount_value <= 0) return false;
    if (c.total_limit === null || c.total_limit === undefined || c.total_limit <= 0) return false;
    if (!c.start_at || !c.end_at) return false;
    if (this.validationError !== '') return false;
    return true;
  }

  realTimeValidate(): void {
    const c = this.currentCoupon;
    this.validationError = '';

    if (!c.code || c.code.trim() === '') {
      this.validationError = 'Mã code không được để trống.';
      return;
    }

    const isCodeExists = this.coupons.some(item =>
      item.code.trim().toUpperCase() === c.code.trim().toUpperCase() &&
      item._id !== c._id
    );
    if (isCodeExists) {
      this.validationError = `Mã "${c.code.toUpperCase()}" đã tồn tại. Vui lòng chọn mã khác.`;
      return;
    }

    if (c.discount_value === null || c.discount_value === undefined || c.discount_value <= 0) {
      this.validationError = 'Giá trị giảm giá phải lớn hơn 0.';
      return;
    }

    if (c.discount_type === 'percent' && c.discount_value >= 100) {
      this.validationError = 'Phần trăm giảm giá phải nhỏ hơn 100%.';
      return;
    }

    if (c.discount_type === 'fixed') {
      this.currentCoupon.max_discount_amount = c.discount_value;
    }

    if (c.total_limit === null || c.total_limit === undefined || c.total_limit <= 0) {
      this.validationError = 'Tổng lượt sử dụng phải lớn hơn 0.';
      return;
    }

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
    }
  }

  onTypeChange(): void {
    this.realTimeValidate();
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
        code: '',
        discount_type: 'percent',
        discount_value: 0,
        max_discount_amount: 0,
        min_order_value: 0,
        used: 0,
        total_limit: 10,
        status: 'active',
        start_at: today,
        end_at: today
      };
    }

    this.cdr.detectChanges();
  }

  closeModal(): void {
    this.showModal = false;
    this.showConfirmPopup = false;
    this.cdr.detectChanges();
  }

  confirmSave(): void {
    this.realTimeValidate();
    if (!this.validationError) {
      this.showConfirmPopup = true;
      this.cdr.detectChanges();
    }
  }

  showResult(title: string, msg: string, type: 'success' | 'error') {
    this.resultMessage = { title, message: msg, type };
    this.showResultPopup = true;
    this.cdr.detectChanges();
  }

  updateStatus(item: any): void {
    this.pendingStatusChange = {
      item,
      newStatus: item.status
    };
    this.showConfirmPopup = true;
    this.cdr.detectChanges();
  }

  executeSave(): void {
    this.showConfirmPopup = false;

    if (this.pendingStatusChange) {
      const { item, newStatus } = this.pendingStatusChange;

      this.couponService.updateCoupon(item._id, { status: newStatus }).subscribe({
        next: () => {
          this.pendingStatusChange = null;
          this.loadCoupons();
          setTimeout(() => {
            this.showResult('Thành công', 'Đã cập nhật trạng thái mới.', 'success');
          }, 0);
        },
        error: (err: any) => {
          this.pendingStatusChange = null;
          this.loadCoupons();
          setTimeout(() => {
            this.showResult('Lỗi', err.error?.message || 'Cập nhật thất bại.', 'error');
          }, 0);
        }
      });
      return;
    }

    const request = this.isEdit
      ? this.couponService.updateCoupon(this.currentCoupon._id, this.currentCoupon)
      : this.couponService.createCoupon(this.currentCoupon);

    request.subscribe({
      next: () => {
        this.showModal = false;
        this.loadCoupons();
        this.cdr.detectChanges();

        setTimeout(() => {
          this.showResult('Thành công', 'Dữ liệu khuyến mãi đã được lưu.', 'success');
        }, 0);
      },
      error: (err: any) => {
        setTimeout(() => {
          this.showResult('Thất bại', err.error?.message || 'Lỗi server', 'error');
        }, 0);
      }
    });
  }

  cancelConfirm(): void {
    if (this.pendingStatusChange) {
      this.loadCoupons();
    }
    this.showConfirmPopup = false;
    this.pendingStatusChange = null;
    this.cdr.detectChanges();
  }
}