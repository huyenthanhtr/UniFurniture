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

  patchOrderStatus(id: string, status: string, reason?: string): Observable<any> {
    const payload: Record<string, string> = { status };
    if (reason && reason.trim()) {
      payload['reason'] = reason.trim();
    }
    return this.http.patch<any>(`${this.base}/orders/${id}/status`, payload);
  }

  addWarrantyRecord(id: string, payload: {
    order_detail_id: string;
    serviced_at: string;
    cost: number;
    description: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.base}/orders/${id}/warranty-records`, payload);
  }

  patchPayment(id: string, payload: any): Observable<any> {
    return this.http.patch<any>(`${this.base}/payment/${id}`, payload);
  }

  createPayment(payload: any): Observable<any> {
    return this.http.post<any>(`${this.base}/payment`, payload);
  }
}
