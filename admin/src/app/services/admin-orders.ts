import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminOrdersService {
  private http = inject(HttpClient);
  private base = 'http://localhost:3000/api';

  getOrders(params: any = {}): Observable<any> {
    return this.http.get<any>(`${this.base}/orders`, { params });
  }

  getOrderById(id: string): Observable<any> {
    return this.http.get<any>(`${this.base}/orders/${id}`);
  }

  patchOrderStatus(id: string, status: string): Observable<any> {
    return this.http.patch<any>(`${this.base}/orders/${id}/status`, { status });
  }
}