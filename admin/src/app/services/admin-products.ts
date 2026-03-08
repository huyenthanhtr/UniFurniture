import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminProductsService {
  private http = inject(HttpClient);

  private base = 'http://localhost:3000/api';

  getProducts(params: any = {}): Observable<any> {
    return this.http.get<any>(`${this.base}/products`, { params });
  }

  getProductById(id: string): Observable<any> {
    return this.http.get<any>(`${this.base}/products/${id}`);
  }

  getCategories(params: any = {}): Observable<any> {
    return this.http.get<any>(`${this.base}/categories`, { params });
  }

  getCollections(params: any = {}): Observable<any> {
    return this.http.get<any>(`${this.base}/collections`, { params });
  }

  getVariants(params: any = {}): Observable<any> {
    return this.http.get<any>(`${this.base}/product-variants`, { params });
  }

  getVariantById(id: string): Observable<any> {
    return this.http.get<any>(`${this.base}/product-variants/${id}`);
  }

  getImages(params: any = {}): Observable<any> {
    return this.http.get<any>(`${this.base}/product-images`, { params });
  }

  // CRUD (backend chưa có thì tạm thời chưa dùng)
  createProduct(payload: any): Observable<any> {
    return this.http.post(`${this.base}/products`, payload);
  }

  updateProduct(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.base}/products/${id}`, payload);
  }

  patchProduct(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.base}/products/${id}`, payload);
  }

  createVariant(payload: any): Observable<any> {
    return this.http.post(`${this.base}/product-variants`, payload);
  }

  updateVariant(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.base}/product-variants/${id}`, payload);
  }

  patchVariant(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.base}/product-variants/${id}`, payload);
  }
}