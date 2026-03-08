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

  createProduct(payload: any): Observable<any> {
    return this.http.post<any>(`${this.base}/products`, payload);
  }

  updateProduct(id: string, payload: any): Observable<any> {
    return this.http.put<any>(`${this.base}/products/${id}`, payload);
  }

  patchProduct(id: string, payload: any): Observable<any> {
    return this.http.patch<any>(`${this.base}/products/${id}`, payload);
  }

  deleteProduct(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/products/${id}`);
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

  createVariant(payload: any): Observable<any> {
    return this.http.post<any>(`${this.base}/product-variants`, payload);
  }

  updateVariant(id: string, payload: any): Observable<any> {
    return this.http.put<any>(`${this.base}/product-variants/${id}`, payload);
  }

  patchVariant(id: string, payload: any): Observable<any> {
    return this.http.patch<any>(`${this.base}/product-variants/${id}`, payload);
  }

  deleteVariant(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/product-variants/${id}`);
  }

  getImages(params: any = {}): Observable<any> {
    return this.http.get<any>(`${this.base}/product-images`, { params });
  }

  getImageById(id: string): Observable<any> {
    return this.http.get<any>(`${this.base}/product-images/${id}`);
  }

  createImage(payload: any): Observable<any> {
    return this.http.post<any>(`${this.base}/product-images`, payload);
  }

  updateImage(id: string, payload: any): Observable<any> {
    return this.http.put<any>(`${this.base}/product-images/${id}`, payload);
  }

  patchImage(id: string, payload: any): Observable<any> {
    return this.http.patch<any>(`${this.base}/product-images/${id}`, payload);
  }

  deleteImage(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/product-images/${id}`);
  }
}