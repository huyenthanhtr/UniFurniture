import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../ui-state.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  ui = inject(UiStateService);
}
