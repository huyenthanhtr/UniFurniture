import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminCustomersService {
  private http = inject(HttpClient);
  private base = 'http://localhost:3000/api';

  getCustomers(params: any = {}): Observable<any> {
    return this.http.get<any>(`${this.base}/customers/admin/list`, { params });
  }

  getCustomerById(id: string): Observable<any> {
    return this.http.get<any>(`${this.base}/customers/admin/${id}`);
  }

  getCustomerAddresses(id: string): Observable<any> {
    return this.http.get<any>(`${this.base}/customers/admin/${id}/addresses`);
  }

  getCustomerAddressById(customerId: string, addressId: string): Observable<any> {
    return this.http.get<any>(`${this.base}/customers/admin/${customerId}/addresses/${addressId}`);
  }
}
