import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';
import {
  DashboardService,
  DashboardOverviewResponse,
  DashboardRangePreset,
  TrendGranularity
} from '../../services/admin-dashboard';

const IN_PROGRESS_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipping',
  'delivered'
];

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css']
})
export class AdminDashboard implements OnInit {
  readonly inProgressOrderStatuses = IN_PROGRESS_ORDER_STATUSES;

  totalRevenue = 0;
  totalOrders = 0;
  processingOrdersCount = 0;
  needRestockCount = 0;
  lowStockCount = 0;

  lowStockItems: any[] = [];
  needRestockItems: any[] = [];
  recentOrders: any[] = [];
  installationOrders: any[] = [];

  isBrowser: boolean;
  statusChart: Chart | null = null;
  trendChart: Chart | null = null;

  selectedRangePreset: DashboardRangePreset = 'thisYear';
  currentFilter: TrendGranularity = 'month';
  startDate = '';
  endDate = '';
topSellingProducts: any[] = [];

  constructor(
    private dashboardService: DashboardService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.applyRangePreset('thisYear');
  }

  applyRangePreset(preset: DashboardRangePreset): void {
    const { start, end, granularity } = this.resolvePresetRange(preset);

    this.selectedRangePreset = preset;
    this.currentFilter = granularity;
    this.startDate = this.formatDateInput(start);
    this.endDate = this.formatDateInput(end);

    this.loadDashboardOverview();
  }

  changeGranularity(granularity: TrendGranularity): void {
    this.currentFilter = granularity;
    this.loadDashboardOverview();
  }

  onDateChange(): void {
    if (!this.startDate || !this.endDate) return;

    let start = new Date(this.startDate);
    let end = new Date(this.endDate);

    if (start > end) {
      const temp = start;
      start = end;
      end = temp;
      this.startDate = this.formatDateInput(start);
      this.endDate = this.formatDateInput(end);
    }

    this.selectedRangePreset = 'custom';
    this.currentFilter = this.getSuggestedGranularity(start, end);

    this.loadDashboardOverview();
  }

resolvePresetRange(
  preset: DashboardRangePreset
): { start: Date; end: Date; granularity: TrendGranularity } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start = new Date(end);
  let granularity: TrendGranularity = 'month';

  switch (preset) {
    case 'all':
      start = new Date(2000, 0, 1);
      start.setHours(0, 0, 0, 0);
      granularity = 'quarter';
      break;

    case 'last7days':
      start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      granularity = 'day';
      break;

    case 'thisMonth':
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      granularity = 'day';
      break;

    case 'thisQuarter': {
      const quarterStartMonth = Math.floor(end.getMonth() / 3) * 3;
      start = new Date(end.getFullYear(), quarterStartMonth, 1);
      start.setHours(0, 0, 0, 0);
      granularity = 'week';
      break;
    }

    case 'thisYear':
    default:
      start = new Date(end.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      granularity = 'month';
      break;
  }

  return { start, end, granularity };
}
  getSuggestedGranularity(start: Date, end: Date): TrendGranularity {
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);

    if (diffDays <= 31) return 'day';
    if (diffDays <= 120) return 'week';
    if (diffDays <= 366) return 'month';
    return 'quarter';
  }

  formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadDashboardOverview(): void {
    this.dashboardService.getOverview({
      rangePreset: this.selectedRangePreset,
      granularity: this.currentFilter,
      startDate: this.startDate,
      endDate: this.endDate
    }).subscribe({
      next: (data: DashboardOverviewResponse) => {
        this.bindOverviewData(data);
        this.cdr.detectChanges();

        if (this.isBrowser) {
setTimeout(() => {
  this.drawMixedChart(
    data.trend.labels,
    data.trend.revenueData,
    data.trend.countData
  );
  this.createStatusChart(data.statusStats);

  this.trendChart?.resize();
  this.statusChart?.resize();

  this.cdr.detectChanges();
}, 50);
        }
      },
      error: (err) => {
        console.error('Lỗi tải dữ liệu dashboard overview:', err);
      }
    });
  }

bindOverviewData(data: DashboardOverviewResponse): void {
  this.topSellingProducts = Array.isArray(data?.lists?.topSellingProducts)
    ? data.lists.topSellingProducts
    : [];

  this.needRestockItems = Array.isArray(data?.inventoryAlerts?.needRestockItems)
    ? data.inventoryAlerts.needRestockItems
    : [];

  this.lowStockItems = Array.isArray(data?.inventoryAlerts?.lowStockItems)
    ? data.inventoryAlerts.lowStockItems
    : [];

  this.recentOrders = Array.isArray(data?.lists?.recentOrders)
    ? data.lists.recentOrders
    : [];

  this.installationOrders = Array.isArray(data?.lists?.installationOrders)
    ? data.lists.installationOrders
    : [];

  this.totalRevenue = Number(data?.summary?.totalRevenue || 0);
  this.totalOrders = Number(data?.summary?.totalOrders || 0);
  this.processingOrdersCount = Number(data?.summary?.processingOrdersCount || 0);

  const backendNeedRestockCount = Number(data?.summary?.needRestockCount);
  const backendLowStockCount = Number(data?.summary?.lowStockCount);

  this.needRestockCount =
    Number.isFinite(backendNeedRestockCount) && backendNeedRestockCount > 0
      ? backendNeedRestockCount
      : this.needRestockItems.length;

  this.lowStockCount =
    Number.isFinite(backendLowStockCount) && backendLowStockCount > 0
      ? backendLowStockCount
      : this.lowStockItems.length;

  if (data?.meta?.startDate) this.startDate = data.meta.startDate;
  if (data?.meta?.endDate) this.endDate = data.meta.endDate;
  if (data?.meta?.granularity) this.currentFilter = data.meta.granularity;
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
          },
          {
            type: 'bar',
            label: 'Doanh thu (VNĐ)',
            data: revenueData,
            backgroundColor: '#908372',
            borderRadius: 6,
            yAxisID: 'y'
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

  createStatusChart(stats: Record<string, number>): void {
    const canvas = document.getElementById('statusPieChart') as HTMLCanvasElement | null;
    if (!canvas) return;

    if (this.statusChart) {
      this.statusChart.destroy();
    }

    const labels = [
      'Chờ xử lý',
      'Đã xác nhận',
      'Đang chuẩn bị',
      'Đang giao',
      'Đã giao',
      'Hoàn thành',
      'Chờ hủy',
      'Đã hủy',
      'Đã đổi hàng'
    ];

    const data = [
      stats?.['pending'] || 0,
      stats?.['confirmed'] || 0,
      stats?.['processing'] || 0,
      stats?.['shipping'] || 0,
      stats?.['delivered'] || 0,
      stats?.['completed'] || 0,
      stats?.['cancel_pending'] || 0,
      stats?.['cancelled'] || 0,
      stats?.['exchanged'] || 0
    ];

    const colors = [
      '#eab308',
      '#d4a373',
      '#a3b18a',
      '#908372',
      '#588157',
      '#166534',
      '#f87171',
      '#b42318',
      '#475569'
    ];

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

  normalizeStatus(status: any): string {
    return String(status || '').trim().toLowerCase();
  }

  getOrderDate(order: any): Date {
    const rawDate = order?.ordered_at || order?.createdAt || order?.created_at;
    const parsed = rawDate ? new Date(rawDate) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }



  goToOrders(statusFilter?: string): void {
    if (statusFilter) {
      this.router.navigate(['/admin/orders'], { queryParams: { status: statusFilter } });
      return;
    }

    this.router.navigate(['/admin/orders']);
  }

  goToOrdersByStatuses(statuses: string[]): void {
    this.router.navigate(['/admin/orders'], {
      queryParams: {
        statuses: statuses.join(',')
      }
    });
  }

  goToOrderDetail(orderId: string): void {
    this.router.navigate(['/admin/orders', orderId]);
  }

  goToProducts(): void {
    this.router.navigate(['/admin/products']);
  }

  goToProductDetail(productId: string): void {
    if (productId && productId !== 'undefined' && productId !== 'null') {
      this.router.navigate(['/admin/products', productId]);
      return;
    }

    this.router.navigate(['/admin/products']);
  }

  getStatusBadgeClass(status: string): string {
    const normalized = this.normalizeStatus(status);

    if (['completed', 'delivered'].includes(normalized)) return 'badge-success';
    if (['shipping', 'processing', 'confirmed'].includes(normalized)) return 'badge-primary';
    if (normalized === 'pending') return 'badge-warning';
    if (['cancelled', 'cancel_pending', 'exchanged'].includes(normalized)) return 'badge-danger';
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
      exchanged: 'Đã đổi hàng'
    };

    return map[this.normalizeStatus(status)] || status || 'N/A';
  }
}