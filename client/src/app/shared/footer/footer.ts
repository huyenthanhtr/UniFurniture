import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  readonly policyLinks = [
    { label: 'Chính Sách Bán Hàng', slug: 'chinh-sach-ban-hang' },
    { label: 'Chính Sách Giao Hàng & Lắp Đặt', slug: 'giao-hang-lap-dat' },
    { label: 'Chính Sách Bảo Hành & Bảo Trì', slug: 'bao-hanh-bao-tri' },
    { label: 'Chính Sách Đổi Trả', slug: 'doi-tra' },
    { label: 'Khách Hàng Thân Thiết - U-HOMIE', slug: 'khach-hang-than-thiet' },
    { label: 'Chính Sách Đối Tác Bán Hàng', slug: 'doi-tac-ban-hang' },
  ];
}
