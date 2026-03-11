import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminCouponsService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/coupons'; // Thay đổi theo URL của bạn

  getCoupons(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  createCoupon(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  deleteCoupon(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
  // src/app/services/admin-coupons.ts
  updateCoupon(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
}
}