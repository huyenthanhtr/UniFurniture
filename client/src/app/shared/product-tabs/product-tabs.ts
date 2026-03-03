import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type TabKey = 'desc' | 'review' | 'policy';

@Component({
  selector: 'app-product-tabs',
  imports: [CommonModule],
  templateUrl: './product-tabs.html',
  styleUrl: './product-tabs.css',
})
export class ProductTabsComponent {
  @Input() description?: string;
  @Input() shortDescription?: string;
  @Input() warrantyMonths?: number;

  active: TabKey = 'desc';

  setTab(t: TabKey) {
    this.active = t;
  }
}
