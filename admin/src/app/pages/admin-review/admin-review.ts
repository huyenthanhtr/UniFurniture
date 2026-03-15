import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminReviews } from '../../services/admin-reviews';
import { Review } from '../../models/review.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-review.html',
  styleUrl: './admin-review.css'
})
export class AdminReview implements OnInit {
  reviews: Review[] = [];
  filteredReviews: Review[] = [];

  // Filter States
  searchTerm: string = '';
  statusFilter: string = 'all';
  ratingFilter: string = 'all';

  // Sort States
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Pagination States
  currentPage: number = 1;
  itemsPerPage: number = 10;
  Math = Math;

  // Modal Chi tiết & Phản hồi
  showReviewModal: boolean = false;
  selectedReview: any = null;
  replyContent: string = '';

  // Popup Xác nhận trạng thái
  showConfirmPopup: boolean = false;
  pendingStatusChange: { item: any, newStatus: string } | null = null;

  // Popup Kết quả
  showResultPopup: boolean = false;
  resultMessage = { title: '', message: '', type: '' as 'success' | 'error' };

  constructor(
    private reviewService: AdminReviews, 
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void { this.loadReviews(); }

  loadReviews() {
    this.reviewService.getReviews().subscribe(data => {
      this.reviews = data;
      this.applyFilters();
    });
  }

  // --- HÀM LỌC VÀ SẮP XẾP ---
  applyFilters() {
    let filtered = this.reviews.filter(r => {
      // Ưu tiên lấy tên người nhận thực tế, nếu không có mới lấy tên thành viên đăng ký
      const customerName = r.order_detail_id?.order_id?.shipping_name || r.customer_id?.full_name || '';
      
      const matchSearch = r.content.toLowerCase().includes(this.searchTerm.toLowerCase()) || 
                          customerName.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchStatus = this.statusFilter === 'all' || r.status === this.statusFilter;
      const matchRating = this.ratingFilter === 'all' || r.rating.toString() === this.ratingFilter;
      
      return matchSearch && matchStatus && matchRating;
    });

    // Logic Sắp xếp
    if (this.sortColumn) {
      filtered.sort((a: any, b: any) => {
        let valA: any = '';
        let valB: any = '';

        switch(this.sortColumn) {
          case 'product_name':
            valA = a.order_detail_id?.product_name || '';
            valB = b.order_detail_id?.product_name || '';
            break;
          case 'order_code':
            valA = a.order_detail_id?.order_id?.order_code || '';
            valB = b.order_detail_id?.order_id?.order_code || '';
            break;
          case 'customer_name':
            valA = a.order_detail_id?.order_id?.shipping_name || a.customer_id?.full_name || '';
            valB = b.order_detail_id?.order_id?.shipping_name || b.customer_id?.full_name || '';
            break;
          case 'rating':
            valA = a.rating; valB = b.rating;
            break;
          case 'content':
            valA = a.content || ''; valB = b.content || '';
            break;
          case 'status':
            valA = a.status || ''; valB = b.status || '';
            break;
        }

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    this.filteredReviews = filtered;
    this.currentPage = 1;
    this.cdr.detectChanges();
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
    this.ratingFilter = 'all';
    this.sortColumn = '';
    this.sortDirection = 'asc';
    this.applyFilters();
  }

  get paginatedReviews() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredReviews.slice(startIndex, startIndex + this.itemsPerPage);
  }

  changePage(page: number) { this.currentPage = page; }

  showResult(title: string, msg: string, type: 'success' | 'error') {
    this.resultMessage = { title, message: msg, type };
    this.showResultPopup = true;
    this.cdr.detectChanges();
  }

  // --- XỬ LÝ TRẠNG THÁI ---
  updateStatus(item: any): void {
    this.pendingStatusChange = { item: item, newStatus: item.status };
    this.showConfirmPopup = true;
  }

  cancelConfirm(): void {
    if (this.pendingStatusChange) { this.loadReviews(); }
    this.showConfirmPopup = false;
    this.pendingStatusChange = null;
  }

  executeStatusChange(): void {
    this.showConfirmPopup = false;
    if (this.pendingStatusChange) {
      const { item, newStatus } = this.pendingStatusChange;
      this.reviewService.updateStatus(item._id, newStatus).subscribe({
        next: () => {
          this.showResult('Thành công', 'Đã cập nhật trạng thái đánh giá.', 'success');
          this.pendingStatusChange = null;
          this.loadReviews();
        },
        error: () => {
          this.showResult('Lỗi', 'Không thể cập nhật trạng thái.', 'error');
          this.pendingStatusChange = null;
          this.loadReviews();
        }
      });
    }
  }

  // --- HÀNH ĐỘNG ---
  goToOrderDetail(item: any) {
    const orderId = item.order_detail_id?.order_id?._id || item.order_detail_id?.order_id;
    if (orderId) {
      this.router.navigate(['/admin/orders', orderId]);
    } else {
      this.showResult('Lỗi', 'Không tìm thấy thông tin đơn hàng gốc.', 'error');
    }
  }

  openReviewDetail(review: any) {
    this.selectedReview = review;
    this.replyContent = review.reply?.content || '';
    this.showReviewModal = true;
  }

  closeReviewModal() {
    this.showReviewModal = false;
    this.selectedReview = null;
    this.replyContent = '';
  }

  submitReply() {
    if (this.selectedReview && this.replyContent) {
      this.reviewService.sendReply(this.selectedReview._id, this.replyContent).subscribe({
        next: () => {
          this.showResult('Thành công', 'Đã lưu phản hồi của cửa hàng.', 'success');
          this.closeReviewModal();
          this.loadReviews();
        },
        error: () => this.showResult('Lỗi', 'Lỗi khi gửi phản hồi.', 'error')
      });
    }
  }
}