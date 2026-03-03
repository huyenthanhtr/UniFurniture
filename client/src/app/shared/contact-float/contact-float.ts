import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../ui-state.service';

@Component({
    selector: 'app-contact-float',
    imports: [CommonModule],
    templateUrl: './contact-float.html',
    styleUrl: './contact-float.css',
})
export class ContactFloat {
    ui = inject(UiStateService);
}
