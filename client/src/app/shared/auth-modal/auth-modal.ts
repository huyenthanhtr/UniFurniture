import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiStateService } from '../ui-state.service';

@Component({
    selector: 'app-auth-modal',
    imports: [CommonModule, FormsModule],
    templateUrl: './auth-modal.html',
    styleUrl: './auth-modal.css',
})
export class AuthModal {
    ui = inject(UiStateService);

    loginData = { email: '', password: '' };
    registerData = { name: '', email: '', phone: '', password: '', confirmPassword: '' };
    showPassword = false;

    switchTab(tab: 'login' | 'register') {
        this.ui.authTab.set(tab);
    }

    onLogin() {
        console.log('Login:', this.loginData);
        // TODO: call auth service
    }

    onRegister() {
        console.log('Register:', this.registerData);
        // TODO: call auth service
    }

    closeOnBackdrop(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('auth-overlay')) {
            this.ui.closeAuth();
        }
    }
}
