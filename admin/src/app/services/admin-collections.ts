import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CollectionService {
  // Thay đổi port nếu server của bạn chạy port khác
  private apiUrl = 'http://localhost:3000/api/collections';

  constructor(private http: HttpClient) {}

getProductsByCollection(collectionId: string) {
  return this.http.get<any>(`${this.apiUrl}/${collectionId}/products`);
}
  getAllCollections(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // Nhận vào FormData vì có chứa file ảnh banner
  createCollection(data: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  // Nhận vào FormData
  updateCollection(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, data);
  }

  deleteCollection(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}