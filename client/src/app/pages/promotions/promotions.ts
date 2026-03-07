import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FlashDeal {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  originalPrice: number;
  salePrice: number;
  sold: number;
  total: number;
}

interface VoucherDeal {
  code: string;
  label: string;
  description: string;
  color: string;
}

interface PromoCollection {
  title: string;
  subtitle: string;
  imageUrl: string;
  route: string;
}

@Component({
  selector: 'app-promotions-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './promotions.html',
  styleUrl: './promotions.css',
})
export class PromotionsPageComponent implements OnInit, OnDestroy {
  countdown = { hours: '00', minutes: '00', seconds: '00' };

  readonly flashDeals: FlashDeal[] = [
    {
      id: 'deal-sofa',
      title: 'Sofa Lua Italic 3 Cho',
      category: 'Phong khach',
      imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=900',
      originalPrice: 21900000,
      salePrice: 15900000,
      sold: 38,
      total: 60,
    },
    {
      id: 'deal-bed',
      title: 'Giuong Go Tana 1m8',
      category: 'Phong ngu',
      imageUrl: 'https://images.unsplash.com/photo-1505693314120-0d443867891c?auto=format&fit=crop&q=80&w=900',
      originalPrice: 18200000,
      salePrice: 12900000,
      sold: 22,
      total: 45,
    },
    {
      id: 'deal-table',
      title: 'Ban An 6 Ghe Stone',
      category: 'Phong bep',
      imageUrl: 'https://images.unsplash.com/photo-1617098474202-0d0d7f60f5f8?auto=format&fit=crop&q=80&w=900',
      originalPrice: 26500000,
      salePrice: 19800000,
      sold: 17,
      total: 28,
    },
    {
      id: 'deal-tv',
      title: 'Ke TV Walnut Prime',
      category: 'Phong khach',
      imageUrl: 'https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?auto=format&fit=crop&q=80&w=900',
      originalPrice: 9800000,
      salePrice: 7390000,
      sold: 41,
      total: 55,
    },
  ];

  readonly vouchers: VoucherDeal[] = [
    {
      code: 'UNIHOME10',
      label: 'Giam 10%',
      description: 'Cho don hang tu 12 trieu. Ap dung toan bo noi that.',
      color: '#2f855a',
    },
    {
      code: 'FREESHIP24',
      label: 'Free van chuyen',
      description: 'Ho tro van chuyen noi thanh HCM va Ha Noi.',
      color: '#dd6b20',
    },
    {
      code: 'COMBOPLUS',
      label: 'Giam them 2 trieu',
      description: 'Danh cho combo phong khach + phong ngu.',
      color: '#9b2c2c',
    },
  ];

  readonly collections: PromoCollection[] = [
    {
      title: 'Living Refresh',
      subtitle: 'Nang cap phong khach voi sofa va ban tra cao cap.',
      imageUrl: 'https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&q=80&w=1200',
      route: '/products',
    },
    {
      title: 'Bedroom Serenity',
      subtitle: 'Khong gian ngu toi gian, tinh te, tiet kiem chi phi.',
      imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=1200',
      route: '/products',
    },
    {
      title: 'Dining Signature',
      subtitle: 'Ban an, ghe an va den trang tri dong bo phong cach.',
      imageUrl: 'https://images.unsplash.com/photo-1616594039964-3f7d5dcf7684?auto=format&fit=crop&q=80&w=1200',
      route: '/products',
    },
  ];

  private timerId: ReturnType<typeof setInterval> | null = null;
  private targetTime = Date.now() + 28 * 60 * 60 * 1000;

  ngOnInit(): void {
    this.updateCountdown();
    this.timerId = setInterval(() => this.updateCountdown(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
    }
  }

  trackByDealId(index: number, deal: FlashDeal): string {
    return deal.id || String(index);
  }

  trackByVoucher(index: number, voucher: VoucherDeal): string {
    return voucher.code || String(index);
  }

  trackByCollection(index: number, collection: PromoCollection): string {
    return collection.title || String(index);
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value) + 'd';
  }

  discountPercent(deal: FlashDeal): number {
    if (deal.originalPrice <= 0 || deal.salePrice >= deal.originalPrice) {
      return 0;
    }
    return Math.round(((deal.originalPrice - deal.salePrice) / deal.originalPrice) * 100);
  }

  soldPercent(deal: FlashDeal): number {
    if (deal.total <= 0) {
      return 0;
    }
    return Math.min(Math.round((deal.sold / deal.total) * 100), 100);
  }

  private updateCountdown(): void {
    const remaining = this.targetTime - Date.now();
    if (remaining <= 0) {
      this.targetTime = Date.now() + 28 * 60 * 60 * 1000;
      this.countdown = { hours: '28', minutes: '00', seconds: '00' };
      return;
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    this.countdown = {
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
    };
  }
}
