import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type DashboardRangePreset =
  | 'all'
  | 'last7days'
  | 'thisMonth'
  | 'thisQuarter'
  | 'thisYear'
  | 'custom';

export type TrendGranularity = 'day' | 'week' | 'month' | 'quarter';

export interface DashboardOverviewQuery {
  rangePreset: DashboardRangePreset;
  granularity: TrendGranularity;
  startDate?: string;
  endDate?: string;
}

export interface DashboardTrendData {
  labels: string[];
  revenueData: number[];
  countData: number[];
}

export interface DashboardSummary {
  totalRevenue: number;
  totalOrders: number;
  processingOrdersCount: number;
  needRestockCount: number;
  lowStockCount: number;
}

export interface DashboardInventoryAlertItem {
  _id?: string;
  id?: string;
  name?: string;
  sku?: string;
  stock_quantity: number;
  reorder_point: number;
  low_stock_threshold: number;
  parent_product_id: string;
  parent_product_name: string;
}

export interface DashboardOverviewResponse {
  summary: DashboardSummary;
  trend: DashboardTrendData;
  statusStats: Record<string, number>;
  lists: {
    recentOrders: any[];
    installationOrders: any[];
        topSellingProducts: any[];

  };
  inventoryAlerts: {
    needRestockItems: DashboardInventoryAlertItem[];
    lowStockItems: DashboardInventoryAlertItem[];
  };
  meta: {
    rangePreset: DashboardRangePreset;
    granularity: TrendGranularity;
    startDate: string;
    endDate: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getOverview(query: DashboardOverviewQuery): Observable<DashboardOverviewResponse> {
    let params = new HttpParams()
      .set('rangePreset', query.rangePreset)
      .set('granularity', query.granularity);

    if (query.startDate) {
      params = params.set('startDate', query.startDate);
    }

    if (query.endDate) {
      params = params.set('endDate', query.endDate);
    }

    return this.http.get<DashboardOverviewResponse>(
      `${this.apiUrl}/admin/dashboard/overview`,
      { params }
    );
  }
}