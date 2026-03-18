import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { UiStateService } from '../ui-state.service';

@Component({
    selector: 'app-auth-modal',
    imports: [CommonModule, FormsModule],
    templateUrl: './auth-modal.html',
    styleUrl: './auth-modal.css',
})
export class AuthModal {
    ui = inject(UiStateService);
    http = inject(HttpClient);
    cdr = inject(ChangeDetectorRef);

    loginData = { email: '', password: '' };
    registerData = { name: '', email: '', phone: '', password: '', confirmPassword: '', gender: 'male', date_of_birth: '', address: '' };
    showPassword = false;
    dialCode = '+84';

    isOtpOpend = false;
    otpCode = '';
    errorMessage = '';
    successMessage = '';
    isLoading = false;

    switchTab(tab: 'login' | 'register') {
        this.ui.authTab.set(tab);
        this.isOtpOpend = false;
        this.errorMessage = '';
        this.successMessage = '';
    }

    onLogin() {
        this.errorMessage = '';
        this.successMessage = '';

        if (!this.loginData.email || !this.loginData.password) {
            this.errorMessage = 'Vui lòng điền đầy đủ thông tin.';
            return;
        }

        this.isLoading = true;
        const payload = {
            emailOrPhone: this.loginData.email,
            password: this.loginData.password
        };

        this.http.post('http://localhost:3000/api/auth/login', payload).subscribe({
            next: (res: any) => {
                this.isLoading = false;
                this.successMessage = res.message || 'Đăng nhập thành công!';
                // Save profile to local storage for auth state visualization
                if (res.profile) {
                    localStorage.setItem('user_profile', JSON.stringify(res.profile));
                }
                setTimeout(() => {
                    this.ui.closeAuth();
                    window.location.reload(); // Refresh to update navbar
                }, 1500);
            },
            error: (err) => {
                this.isLoading = false;
                this.errorMessage = err.error?.message || 'Email/SĐT hoặc mật khẩu không chính xác.';
            }
        });
    }

    onRegister() {
        this.errorMessage = '';
        this.successMessage = '';

        if (!this.registerData.password || this.registerData.password.length < 8) {
            this.errorMessage = 'Mật khẩu phải có ít nhất 8 ký tự.';
            return;
        }

        if (this.registerData.password !== this.registerData.confirmPassword) {
            this.errorMessage = 'Mật khẩu xác nhận không khớp.';
            return;
        }

        let formattedPhone = this.registerData.phone;
        if (formattedPhone.startsWith('0')) {
            formattedPhone = formattedPhone.substring(1);
        }
        formattedPhone = this.dialCode.replace('+', '') + formattedPhone;

        this.isLoading = true;
        const payload: any = {
            full_name: this.registerData.name,
            phone: formattedPhone,
            password_hash: this.registerData.password
        };

        if (this.registerData.email) payload.email = this.registerData.email;

        this.http.post('http://localhost:3000/api/auth/register', payload).subscribe({
            next: (res: any) => {
                this.isLoading = false;
                this.successMessage = 'Mã OTP đã được gửi đến số điện thoại của bạn.';
                this.isOtpOpend = true;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.isLoading = false;
                this.errorMessage = err.error?.message || 'Có lỗi xảy ra khi đăng ký.';
            }
        });
    }

    onVerifyOtp() {
        this.errorMessage = '';
        this.successMessage = '';

        if (!this.otpCode) {
            this.errorMessage = 'Vui lòng nhập mã OTP.';
            return;
        }

        let formattedPhone = this.registerData.phone;
        if (formattedPhone.startsWith('0')) {
            formattedPhone = formattedPhone.substring(1);
        }
        formattedPhone = this.dialCode.replace('+', '') + formattedPhone;

        this.isLoading = true;
        const payload = {
            phone: formattedPhone,
            otp: this.otpCode
        };

        this.http.post('http://localhost:3000/api/auth/verify-otp', payload).subscribe({
            next: (res: any) => {
                this.isLoading = false;
                this.successMessage = 'Tạo tài khoản thành công! Bạn có thể đăng nhập ngay.';
                this.cdr.detectChanges();
                setTimeout(() => {
                    this.switchTab('login');
                }, 1500);
            },
            error: (err) => {
                this.isLoading = false;
                this.errorMessage = err.error?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.';
            }
        });
    }

    closeOnBackdrop(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('auth-overlay')) {
            this.ui.closeAuth();
        }
    }
}
