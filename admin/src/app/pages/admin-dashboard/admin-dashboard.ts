import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';
import { DashboardService } from '../../services/admin-dashboard';
import { forkJoin } from 'rxjs';

type TrendGranularity = 'day' | 'week' | 'month' | 'quarter';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css']
})
export class AdminDashboard implements OnInit {
  totalRevenue = 0;
  totalOrders = 0;
  totalItemsSold = 0;
  pendingOrdersCount = 0;

  lowStockItems: any[] = [];
  needRestockItems: any[] = [];
  recentOrders: any[] = [];
  installationOrders: any[] = [];
  allOrders: any[] = [];
  productsMap = new Map<string, any>();

  isBrowser: boolean;
  statusChart: Chart | null = null;
  trendChart: Chart | null = null;

  currentFilter: TrendGranularity = 'month';
  startDate = '';
  endDate = '';

  constructor(
    private dashboardService: DashboardService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef // THÊM CHANGEDETECTORREF ĐỂ FIX LỖI PHẢI CLICK CHUỘT
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.initializeDefaultDateRange();
    this.loadDashboardData();
  }

  initializeDefaultDateRange(): void {
    const now = new Date();
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
    this.startDate = this.formatDateInput(firstDayOfYear);
    this.endDate = this.formatDateInput(now);
  }

  formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadDashboardData(): void {
    forkJoin({
      orders: this.dashboardService.getOrders(),
      variants: this.dashboardService.getVariants(),
      products: this.dashboardService.getProducts()
    }).subscribe({
      next: (data) => {
        this.allOrders = Array.isArray(data.orders) ? data.orders : [];
        const variantsData = Array.isArray(data.variants) ? data.variants : [];
        const productsData = Array.isArray(data.products) ? data.products : [];

        this.productsMap = new Map(productsData.map((p: any) => [String(p._id || p.id), p]));

        this.totalOrders = this.allOrders.length;
        this.totalRevenue = this.dashboardService.calculateTotalRevenue(this.allOrders);
        this.pendingOrdersCount = this.allOrders.filter((o: any) => this.normalizeStatus(o.status) === 'pending').length;
        this.totalItemsSold = variantsData.reduce((sum: number, v: any) => sum + Number(v?.sold || 0), 0);

        this.prepareStockLists(variantsData);
        this.prepareRecentOrders();
        this.prepareInstallationOrders();

        // ÉP ANGULAR CẬP NHẬT GIAO DIỆN NGAY LẬP TỨC
        this.cdr.detectChanges();

        if (this.isBrowser) {
          setTimeout(() => {
            this.createStatusChart(this.allOrders);
            this.updateTrendChart(this.currentFilter);
            this.cdr.detectChanges(); // Cập nhật lại sau khi vẽ xong biểu đồ
          }, 0);
        }
      },
      error: (err) => {
        console.error('Lỗi tải dữ liệu dashboard:', err);
      }
    });
  }

  prepareStockLists(variantsData: any[]): void {
    const enrichedVariants = variantsData.map((variant: any) => {
      let productId = variant?.product_id;
      if (productId && typeof productId === 'object') {
        productId = productId._id || productId.id || productId;
      }

      const parentProduct = this.productsMap.get(String(productId));
      const stockQuantity = Number(variant?.stock_quantity ?? 0);

      const rawLowThreshold = Number(variant?.low_stock_threshold ?? variant?.minimum_stock ?? 10);
      const lowStockThreshold = Number.isFinite(rawLowThreshold) ? Math.max(0, rawLowThreshold) : 10;

      const rawReorderPoint = Number(variant?.reorder_point ?? Math.min(lowStockThreshold, 3));
      const reorderPointBase = Number.isFinite(rawReorderPoint) ? Math.max(0, rawReorderPoint) : Math.min(lowStockThreshold, 3);
      const reorderPoint = Math.min(reorderPointBase, lowStockThreshold);

      return {
        ...variant,
        stock_quantity: stockQuantity,
        low_stock_threshold: lowStockThreshold,
        reorder_point: reorderPoint,
        parent_product_name: parentProduct?.name || 'Sản phẩm chưa cập nhật tên',
        parent_product_id: String(productId) // BỔ SUNG ID ĐỂ CHUYỂN HƯỚNG
      };
    });

    const sorted = [...enrichedVariants].sort((a: any, b: any) => {
      if (a.stock_quantity !== b.stock_quantity) return a.stock_quantity - b.stock_quantity;
      return String(a.parent_product_name).localeCompare(String(b.parent_product_name), 'vi');
    });

    this.needRestockItems = sorted
      .filter((variant: any) => variant.stock_quantity <= variant.reorder_point)
      .slice(0, 12);

    this.lowStockItems = sorted
      .filter((variant: any) => {
        return variant.stock_quantity > variant.reorder_point
          && variant.stock_quantity <= variant.low_stock_threshold;
      })
      .slice(0, 12);
  }

  prepareRecentOrders(): void {
    this.recentOrders = [...this.allOrders]
      .sort((a: any, b: any) => this.getOrderDate(b).getTime() - this.getOrderDate(a).getTime())
      .slice(0, 7);
  }

  prepareInstallationOrders(): void {
    const visibleStatuses = ['confirmed', 'processing', 'shipping'];

    this.installationOrders = this.allOrders
      .filter((order: any) => order?.is_installed === true && visibleStatuses.includes(this.normalizeStatus(order.status)))
      .sort((a: any, b: any) => this.getOrderDate(b).getTime() - this.getOrderDate(a).getTime())
      .slice(0, 10);
  }

  normalizeStatus(status: any): string {
    return String(status || '').trim().toLowerCase();
  }

  getOrderDate(order: any): Date {
    const rawDate = order?.ordered_at || order?.createdAt || order?.created_at;
    const parsed = rawDate ? new Date(rawDate) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  getStockSeverityLabel(item: any): string {
    const stock = Number(item?.stock_quantity ?? 0);
    const reorderPoint = Number(item?.reorder_point ?? 0);
    const lowStockThreshold = Number(item?.low_stock_threshold ?? 0);

    if (stock <= 0) return 'Hết hàng';
    if (stock <= reorderPoint) return `≤ mức nhập ngay (${reorderPoint})`;
    if (stock <= lowStockThreshold) return `≤ mức cảnh báo (${lowStockThreshold})`;
    return 'Đủ kho';
  }

  updateTrendChart(granularity: TrendGranularity): void {
    this.currentFilter = granularity;

    const start = this.startDate ? new Date(this.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = this.endDate ? new Date(this.endDate) : new Date();

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      const temp = new Date(start);
      start.setTime(end.getTime());
      end.setTime(temp.getTime());
      this.startDate = this.formatDateInput(start);
      this.endDate = this.formatDateInput(end);
    }

    const grouped = new Map<string, { revenue: number; count: number }>();

    for (const order of this.allOrders) {
      const orderDate = this.getOrderDate(order);
      if (orderDate < start || orderDate > end) continue;

      const bucketKey = this.getBucketKey(orderDate, granularity);
      if (!grouped.has(bucketKey)) {
        grouped.set(bucketKey, { revenue: 0, count: 0 });
      }

      const stats = grouped.get(bucketKey)!;
      stats.count += 1;

      const status = this.normalizeStatus(order.status);
      if (['completed', 'delivered'].includes(status)) {
        stats.revenue += Number(order?.total_amount || 0);
      }
    }

    const bucketKeys = this.generateBucketKeys(start, end, granularity);
    const labels: string[] = [];
    const revenueData: number[] = [];
    const countData: number[] = [];

    for (const key of bucketKeys) {
      const stats = grouped.get(key) || { revenue: 0, count: 0 };
      labels.push(this.formatBucketLabel(key, granularity));
      revenueData.push(stats.revenue);
      countData.push(stats.count);
    }

    this.drawMixedChart(labels, revenueData, countData);
  }

  onDateChange(): void {
    if (!this.startDate || !this.endDate) return;
    this.updateTrendChart(this.currentFilter);
  }

  generateBucketKeys(start: Date, end: Date, granularity: TrendGranularity): string[] {
    const keys: string[] = [];

    if (granularity === 'day') {
      const cursor = new Date(start);
      while (cursor <= end) {
        keys.push(this.getBucketKey(cursor, 'day'));
        cursor.setDate(cursor.getDate() + 1);
      }
      return keys;
    }

    if (granularity === 'week') {
      const cursor = this.getStartOfWeek(start);
      while (cursor <= end) {
        keys.push(this.getBucketKey(cursor, 'week'));
        cursor.setDate(cursor.getDate() + 7);
      }
      return keys;
    }

    if (granularity === 'month') {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= end) {
        keys.push(this.getBucketKey(cursor, 'month'));
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return keys;
    }

    const cursor = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
    while (cursor <= end) {
      keys.push(this.getBucketKey(cursor, 'quarter'));
      cursor.setMonth(cursor.getMonth() + 3);
    }
    return keys;
  }

  getStartOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  getWeekNumber(date: Date): number {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const diffMs = this.getStartOfWeek(date).getTime() - this.getStartOfWeek(startOfYear).getTime();
    return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  }

  getBucketKey(date: Date, granularity: TrendGranularity): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if (granularity === 'day') {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    if (granularity === 'week') {
      const weekNumber = this.getWeekNumber(date);
      return `${year}-W${String(weekNumber).padStart(2, '0')}`;
    }

    if (granularity === 'month') {
      return `${year}-${String(month).padStart(2, '0')}`;
    }

    const quarter = Math.floor((month - 1) / 3) + 1;
    return `${year}-Q${quarter}`;
  }

  formatBucketLabel(key: string, granularity: TrendGranularity): string {
    if (granularity === 'day') {
      const parts = key.split('-');
      return `${parts[2]}/${parts[1]}`;
    }

    if (granularity === 'week') {
      const [year, week] = key.split('-W');
      return `T${Number(week)}/${year}`;
    }

    if (granularity === 'month') {
      const [year, month] = key.split('-');
      return `${month}/${year}`;
    }

    return key.replace('-', ' ');
  }

  drawMixedChart(labels: string[], revenueData: number[], countData: number[]): void {
    const canvas = document.getElementById('trendChart') as HTMLCanvasElement | null;
    if (!canvas) return;

    if (this.trendChart) {
      this.trendChart.destroy();
    }

    this.trendChart = new Chart(canvas, {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Doanh thu (VNĐ)',
            data: revenueData,
            backgroundColor: '#908372', 
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'Số đơn hàng',
            data: countData,
            borderColor: '#d4a373', 
            backgroundColor: '#d4a373',
            pointRadius: 3,
            pointHoverRadius: 4,
            borderWidth: 2,
            tension: 0.3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top'
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            min: 0,
            title: {
              display: true,
              text: 'Doanh thu'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            min: 0,
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              stepSize: 1
            },
            title: {
              display: true,
              text: 'Số đơn'
            }
          }
        }
      }
    });
  }

  createStatusChart(orders: any[]): void {
    const canvas = document.getElementById('statusPieChart') as HTMLCanvasElement | null;
    if (!canvas) return;

    if (this.statusChart) {
      this.statusChart.destroy();
    }

    const stats = this.dashboardService.getOrderStatusStats(orders);
    const labels = [
      'Chờ xử lý',
      'Đã xác nhận',
      'Đang chuẩn bị',
      'Đang giao',
      'Đã giao',
      'Hoàn thành',
      'Chờ hủy',
      'Đã hủy',
      'Đã hoàn tiền'
    ];
    const data = [
      stats['pending'] || 0,
      stats['confirmed'] || 0,
      stats['processing'] || 0,
      stats['shipping'] || 0,
      stats['delivered'] || 0,
      stats['completed'] || 0,
      stats['cancel_pending'] || 0,
      stats['cancelled'] || 0,
      stats['refunded'] || 0
    ];
    
    const colors = ['#eab308', '#d4a373', '#a3b18a', '#908372', '#588157', '#166534', '#f87171', '#b42318', '#9ca3af'];

    this.statusChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderWidth: 1,
            borderColor: '#fff'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              padding: 14
            }
          }
        }
      }
    });
  }

  goToOrders(statusFilter?: string): void {
    if (statusFilter) {
      this.router.navigate(['/admin/orders'], { queryParams: { status: statusFilter } });
      return;
    }
    this.router.navigate(['/admin/orders']);
  }

  goToOrderDetail(orderId: string): void {
    this.router.navigate(['/admin/orders', orderId]);
  }

  goToProducts(): void {
    this.router.navigate(['/admin/products']);
  }

  // HÀM MỚI BỔ SUNG: Chuyển thẳng đến trang chi tiết của sản phẩm đó
  goToProductDetail(productId: string): void {
    if (productId && productId !== 'undefined' && productId !== 'null') {
      this.router.navigate(['/admin/products', productId]);
    } else {
      // Đề phòng trường hợp lỗi không có ID thì về danh sách sản phẩm
      this.router.navigate(['/admin/products']);
    }
  }

  getStatusBadgeClass(status: string): string {
    const normalized = this.normalizeStatus(status);

    if (['completed', 'delivered'].includes(normalized)) return 'badge-success';
    if (['shipping', 'processing', 'confirmed'].includes(normalized)) return 'badge-primary';
    if (normalized === 'pending') return 'badge-warning';
    if (['cancelled', 'cancel_pending', 'refunded'].includes(normalized)) return 'badge-danger';
    return 'badge-secondary';
  }

  getStatusName(status: string): string {
    const map: Record<string, string> = {
      pending: 'Chờ xử lý',
      confirmed: 'Đã xác nhận',
      processing: 'Đang chuẩn bị',
      shipping: 'Đang giao',
      delivered: 'Đã giao',
      completed: 'Hoàn thành',
      cancel_pending: 'Chờ hủy',
      cancelled: 'Đã hủy',
      refunded: 'Đã hoàn tiền'
    };

    return map[this.normalizeStatus(status)] || status || 'N/A';
  }
}