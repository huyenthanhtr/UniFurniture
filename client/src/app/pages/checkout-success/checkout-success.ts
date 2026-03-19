import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-checkout-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './checkout-success.html',
  styleUrl: './checkout-success.css',
})
export class CheckoutSuccessComponent {
  private readonly route = inject(ActivatedRoute);

  get orderCode(): string {
    return String(this.route.snapshot.queryParamMap.get('code') || '').trim();
  }
}
