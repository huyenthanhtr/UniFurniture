import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = 'http://localhost:3000/api'; 

  constructor(private http: HttpClient) {}

  // Ép lấy 1000 đơn hàng mới nhất để thống kê chính xác
  getOrders(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/orders?limit=1000`).pipe(
      map(res => res.items || res || []) 
    );
  }

  getVariants(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/product-variants?limit=1000`).pipe(
      map(res => res.items || res || []) 
    );
  }

  getProducts(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/products?limit=1000`).pipe(
      map(res => res.items || res || []) 
    );
  }

  calculateTotalRevenue(orders: any[]): number {
    return orders
      .filter(order => ['completed', 'delivered'].includes(String(order.status).trim().toLowerCase()))
      .reduce((sum, order) => sum + (order.total_amount || 0), 0);
  }

  getOrderStatusStats(orders: any[]): any {
    const stats: { [key: string]: number } = {};
    orders.forEach(order => {
      const status = String(order.status).trim().toLowerCase();
      stats[status] = (stats[status] || 0) + 1;
    });
    return stats;
  }

  getLowStockAlerts(variants: any[]): any[] {
    return variants.filter(v => v.stock_quantity <= 5 || v.status === 'unavailable');
  }
}