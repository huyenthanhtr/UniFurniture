// src/app/pages/admin-coupons/admin-coupons.ts

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
// Sửa đường dẫn import cho đúng với cấu trúc thư mục của bạn
import { AdminCouponsService } from '../../services/admin-coupons'; 

@Component({
  selector: 'app-admin-coupons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-coupons.html',
  styleUrls: ['./admin-coupons.css']
})
export class AdminCoupons implements OnInit {
  // Sử dụng 'any' để tránh lỗi TS2571 (Object is of type 'unknown') 
  // khi service chưa được định nghĩa kiểu trả về rõ ràng
  private couponService = inject(AdminCouponsService) as any;
  
  coupons: any[] = [];

  ngOnInit() {
    this.loadCoupons();
  }

  loadCoupons() {
    this.couponService.getCoupons().subscribe({
      // Chỉ định kiểu dữ liệu (data: any) và (err: any) để sửa lỗi TS7006
      next: (data: any) => {
        this.coupons = data;
        console.log('Dữ liệu nhận được:', this.coupons);
      },
      error: (err: any) => {
        console.error('Lỗi lấy dữ liệu:', err);
      }
    });
  }

  openModal() {
    console.log('Mở modal thêm khuyến mãi');
  }

  delete(id: string) {
    if (confirm('Bạn có chắc muốn xóa mã này?')) {
      this.couponService.deleteCoupon(id).subscribe({
        next: () => {
          this.loadCoupons();
        },
        error: (err: any) => console.error('Lỗi khi xóa:', err)
      });
    }
  }
}