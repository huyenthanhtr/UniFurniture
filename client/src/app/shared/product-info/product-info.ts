import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-info.html',
  styleUrl: './product-info.css',
})
export class ProductInfoComponent {

  @Input() product: any;

  quantity = 1;

  increase() { this.quantity++; }
  decrease() { if (this.quantity > 1) this.quantity--; }

}