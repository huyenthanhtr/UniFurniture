import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminReviews } from '../../services/admin-reviews';
import { Review } from '../../models/review.model';

type MediaType = 'image' | 'video';
interface ReviewMediaItem {
  type: MediaType;
  url: string;
}

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

  searchTerm = '';
  statusFilter = 'all';
  ratingFilter = 'all';

  sortColumn = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  currentPage = 1;
  itemsPerPage = 10;
  Math = Math;

  showReviewModal = false;
  selectedReview: Review | null = null;
  replyContent = '';

  showConfirmPopup = false;
  pendingStatusChange: { item: Review; newStatus: string } | null = null;

  showResultPopup = false;
  resultMessage = { title: '', message: '', type: '' as 'success' | 'error' };

  readonly mediaPageSize = 5;
  mediaOffset = 0;
  activeMediaAbsoluteIndex = 0;

  constructor(
    private readonly reviewService: AdminReviews,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadReviews();
  }

  loadReviews(): void {
    this.reviewService.getReviews().subscribe((data) => {
      this.reviews = data;
      this.applyFilters();
    });
  }

  applyFilters(): void {
    let filtered = this.reviews.filter((r) => {
      const customerName = r.order_detail_id?.order_id?.shipping_name || r.customer_id?.full_name || '';
      const content = String(r.content || '').toLowerCase();
      const keyword = this.searchTerm.toLowerCase();
      const matchSearch = content.includes(keyword) || customerName.toLowerCase().includes(keyword);
      const matchStatus = this.statusFilter === 'all' || r.status === this.statusFilter;
      const matchRating = this.ratingFilter === 'all' || String(r.rating) === this.ratingFilter;
      return matchSearch && matchStatus && matchRating;
    });

    if (this.sortColumn) {
      filtered.sort((a: Review, b: Review) => {
        let valA: any = '';
        let valB: any = '';

        switch (this.sortColumn) {
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
            valA = a.rating;
            valB = b.rating;
            break;
          case 'content':
            valA = a.content || '';
            valB = b.content || '';
            break;
          case 'status':
            valA = a.status || '';
            valB = b.status || '';
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

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) return 'fa-sort text-muted';
    return this.sortDirection === 'asc' ? 'fa-sort-up active' : 'fa-sort-down active';
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.ratingFilter = 'all';
    this.sortColumn = '';
    this.sortDirection = 'asc';
    this.applyFilters();
  }

  get paginatedReviews(): Review[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredReviews.slice(startIndex, startIndex + this.itemsPerPage);
  }

  changePage(page: number): void {
    this.currentPage = page;
  }

  showResult(title: string, message: string, type: 'success' | 'error'): void {
    this.resultMessage = { title, message, type };
    this.showResultPopup = true;
    this.cdr.detectChanges();
  }

  updateStatus(item: Review): void {
    this.pendingStatusChange = { item, newStatus: item.status };
    this.showConfirmPopup = true;
  }

  cancelConfirm(): void {
    if (this.pendingStatusChange) {
      this.loadReviews();
    }
    this.showConfirmPopup = false;
    this.pendingStatusChange = null;
  }

  executeStatusChange(): void {
    this.showConfirmPopup = false;
    if (!this.pendingStatusChange) return;

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

  goToOrderDetail(item: Review): void {
    const orderId = item.order_detail_id?.order_id?._id || (item.order_detail_id?.order_id as any);
    if (orderId) {
      this.router.navigate(['/admin/orders', orderId]);
    } else {
      this.showResult('Lỗi', 'Không tìm thấy thông tin đơn hàng gốc.', 'error');
    }
  }

  openReviewDetail(review: Review): void {
    this.selectedReview = review;
    this.replyContent = review.reply?.content || '';
    this.mediaOffset = 0;
    this.activeMediaAbsoluteIndex = 0;
    this.showReviewModal = true;
  }

  closeReviewModal(): void {
    this.showReviewModal = false;
    this.selectedReview = null;
    this.replyContent = '';
    this.mediaOffset = 0;
    this.activeMediaAbsoluteIndex = 0;
  }

  submitReply(): void {
    if (!this.selectedReview || !this.replyContent.trim()) {
      return;
    }

    this.reviewService.sendReply(this.selectedReview._id, this.replyContent.trim()).subscribe({
      next: () => {
        this.showResult('Thành công', 'Đã lưu phản hồi của cửa hàng.', 'success');
        this.closeReviewModal();
        this.loadReviews();
      },
      error: () => this.showResult('Lỗi', 'Lỗi khi gửi phản hồi.', 'error')
    });
  }

  get selectedMedia(): ReviewMediaItem[] {
    if (!this.selectedReview) {
      return [];
    }

    const images = Array.isArray(this.selectedReview.images)
      ? this.selectedReview.images.filter(Boolean).map((url) => ({ type: 'image' as const, url }))
      : [];
    const videos = Array.isArray(this.selectedReview.videos)
      ? this.selectedReview.videos.filter(Boolean).map((url) => ({ type: 'video' as const, url }))
      : [];

    return [...images, ...videos];
  }

  get mediaWindow(): ReviewMediaItem[] {
    return this.selectedMedia.slice(this.mediaOffset, this.mediaOffset + this.mediaPageSize);
  }

  get canSlideMediaPrev(): boolean {
    return this.mediaOffset > 0;
  }

  get canSlideMediaNext(): boolean {
    return this.mediaOffset + this.mediaPageSize < this.selectedMedia.length;
  }

  get overflowCount(): number {
    const remaining = this.selectedMedia.length - this.mediaPageSize;
    return remaining > 0 ? remaining : 0;
  }

  get currentMediaPage(): number {
    return Math.floor(this.mediaOffset / this.mediaPageSize) + 1;
  }

  get totalMediaPages(): number {
    return Math.max(Math.ceil(this.selectedMedia.length / this.mediaPageSize), 1);
  }

  get activeMedia(): ReviewMediaItem | null {
    const current = this.selectedMedia[this.activeMediaAbsoluteIndex];
    return current || null;
  }

  slideMedia(delta: number): void {
    const nextOffset = this.mediaOffset + delta * this.mediaPageSize;
    const maxOffset = Math.max(this.selectedMedia.length - this.mediaPageSize, 0);
    this.mediaOffset = Math.max(0, Math.min(nextOffset, maxOffset));

    if (this.activeMediaAbsoluteIndex < this.mediaOffset || this.activeMediaAbsoluteIndex >= this.mediaOffset + this.mediaPageSize) {
      this.activeMediaAbsoluteIndex = this.mediaOffset;
    }
  }

  openMediaAt(windowIndex: number): void {
    this.activeMediaAbsoluteIndex = this.mediaOffset + windowIndex;
  }

  isMediaActive(windowIndex: number): boolean {
    return this.activeMediaAbsoluteIndex === this.mediaOffset + windowIndex;
  }

  openOverflowFromFirstPage(windowIndex: number): void {
    if (windowIndex !== this.mediaPageSize - 1 || !this.canSlideMediaNext) {
      this.openMediaAt(windowIndex);
      return;
    }

    this.slideMedia(1);
    this.activeMediaAbsoluteIndex = this.mediaOffset;
  }

  previewPrev(): void {
    if (this.activeMediaAbsoluteIndex > 0) {
      this.activeMediaAbsoluteIndex -= 1;
      if (this.activeMediaAbsoluteIndex < this.mediaOffset) {
        this.mediaOffset = Math.max(0, this.mediaOffset - this.mediaPageSize);
      }
    }
  }

  previewNext(): void {
    if (this.activeMediaAbsoluteIndex < this.selectedMedia.length - 1) {
      this.activeMediaAbsoluteIndex += 1;
      if (this.activeMediaAbsoluteIndex >= this.mediaOffset + this.mediaPageSize) {
        const maxOffset = Math.max(this.selectedMedia.length - this.mediaPageSize, 0);
        this.mediaOffset = Math.min(this.mediaOffset + this.mediaPageSize, maxOffset);
      }
    }
  }

  @HostListener('document:keydown', ['$event'])
  onModalKeyboardNavigation(event: KeyboardEvent): void {
    if (!this.showReviewModal || !this.selectedMedia.length) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previewPrev();
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.previewNext();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeReviewModal();
    }
  }
}
