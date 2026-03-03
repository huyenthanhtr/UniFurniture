import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-gallery.html',
  styleUrl: './product-gallery.css',
})
export class ProductGalleryComponent {

  @Input() images: string[] = [];

  selectedIndex = 0;

  select(i: number) {
    this.selectedIndex = i;
  }

}