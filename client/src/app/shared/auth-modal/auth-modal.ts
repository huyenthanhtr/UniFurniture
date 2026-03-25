import { Component, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { UiStateService } from '../ui-state.service';

@Component({
    selector: 'app-auth-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './auth-modal.html',
    styleUrl: './auth-modal.css',
})
export class AuthModal {
    ui = inject(UiStateService);
    http = inject(HttpClient);
    cdr = inject(ChangeDetectorRef);
    zone = inject(NgZone);

    loginData = { email: '', password: '' };
    registerData = { name: '', email: '', phone: '', password: '', confirmPassword: '', gender: 'male', date_of_birth: '', address: '' };
    showPassword = false;
    dialCode = '+84';

    isOtpOpend = false;
    otpCode = '';
    errorMessage = '';
    successMessage = '';
    isLoading = false;

    // Forgot password state
    forgotStep: 'phone' | 'otp' | 'newpass' = 'phone';
    forgotPhone = '';
    forgotOtp = '';
    forgotNewPassword = '';
    forgotConfirmPassword = '';
    showForgotPassword = false;

    switchTab(tab: 'login' | 'register' | 'forgot') {
        this.ui.authTab.set(tab as any);
        this.isOtpOpend = false;
        this.errorMessage = '';
        this.successMessage = '';
        this.forgotStep = 'phone';
        this.forgotPhone = '';
        this.forgotOtp = '';
        this.forgotNewPassword = '';
        this.forgotConfirmPassword = '';
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

        this.http.post(`http://localhost:3000/api/auth/login`, payload).subscribe({
            next: (res: any) => {
                this.isLoading = false;
                this.successMessage = res.message || 'Đăng nhập thành công!';
                if (res.profile) {
                    localStorage.setItem('user_profile', JSON.stringify(res.profile));
                }
                setTimeout(() => {
                    this.ui.closeAuth();
                    if (res.profile && res.profile.role === 'admin') {
                        const encodedProfile = encodeURIComponent(JSON.stringify(res.profile));
                        window.location.href = `http://localhost:4201?profile=${encodedProfile}`;
                    } else {
                        window.location.reload();
                    }
                }, 1500);
            },
            error: (err: any) => {
                this.isLoading = false;
                this.errorMessage = err.error?.message || 'Email/SĐT hoặc mật khẩu không chính xác.';
                this.cdr.detectChanges();
            }
        });
    }

    onRegister() {
        this.errorMessage = '';
        this.successMessage = '';

        if (!this.registerData.name || !this.registerData.phone || !this.registerData.password) {
            this.errorMessage = 'Vui lòng điền đầy đủ các thông tin bắt buộc (*).';
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (this.registerData.email && !emailRegex.test(this.registerData.email)) {
            this.errorMessage = 'Định dạng email không hợp lệ.';
            return;
        }

        const phoneRegex = /^[0-9]{9,10}$/;
        if (!phoneRegex.test(this.registerData.phone)) {
            this.errorMessage = 'Số điện thoại phải có 9 hoặc 10 chữ số.';
            return;
        }

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
            next: (_res: any) => {
                this.isLoading = false;
                this.successMessage = 'Mã OTP đã được gửi đến số điện thoại của bạn.';
                this.isOtpOpend = true;
                this.cdr.detectChanges();
            },
            error: (err: any) => {
                this.isLoading = false;
                this.errorMessage = err.error?.message || 'Có lỗi xảy ra khi đăng ký.';
                this.cdr.detectChanges();
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
        const payload = { phone: formattedPhone, otp: this.otpCode };

        this.http.post('http://localhost:3000/api/auth/verify-otp', payload).subscribe({
            next: (_res: any) => {
                this.isLoading = false;
                this.successMessage = 'Tạo tài khoản thành công! Bạn có thể đăng nhập ngay.';
                this.cdr.detectChanges();
                setTimeout(() => { this.switchTab('login'); }, 1500);
            },
            error: (err: any) => {
                this.isLoading = false;
                this.errorMessage = err.error?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.';
                this.cdr.detectChanges();
            }
        });
    }

    // --- Forgot Password Flow ---

    onForgotSendOtp() {
        this.errorMessage = '';
        this.successMessage = '';

        const phoneRegex = /^[0-9]{9,10}$/;
        const raw = this.forgotPhone.trim();
        if (!raw || !phoneRegex.test(raw)) {
            this.errorMessage = 'Vui lòng nhập số điện thoại hợp lệ (9-10 chữ số).';
            return;
        }

        let formattedPhone = raw.startsWith('0') ? raw.substring(1) : raw;
        formattedPhone = '84' + formattedPhone;

        this.isLoading = true;
        this.http.post('http://localhost:3000/api/auth/forgot-password', { phone: formattedPhone }).subscribe({
            next: (res: any) => {
                this.isLoading = false;
                this.successMessage = res.message || 'Mã OTP đã được gửi.';
                this.cdr.detectChanges();
                setTimeout(() => {
                    this.forgotStep = 'otp';
                    this.cdr.detectChanges();
                }, 0);
            },
            error: (err: any) => {
                this.isLoading = false;
                this.errorMessage = err.error?.message || 'Không thể gửi OTP. Vui lòng thử lại.';
                this.cdr.detectChanges();
            }
        });
    }

    onForgotVerifyOtp() {
        this.errorMessage = '';
        if (!this.forgotOtp.trim()) {
            this.errorMessage = 'Vui lòng nhập mã OTP.';
            return;
        }
        this.forgotStep = 'newpass';
        this.cdr.detectChanges();
    }

    onResetPassword() {
        this.errorMessage = '';
        this.successMessage = '';

        if (!this.forgotNewPassword || this.forgotNewPassword.length < 8) {
            this.errorMessage = 'Mật khẩu phải có ít nhất 8 ký tự.';
            return;
        }

        if (this.forgotNewPassword !== this.forgotConfirmPassword) {
            this.errorMessage = 'Mật khẩu xác nhận không khớp.';
            return;
        }

        let formattedPhone = this.forgotPhone.trim();
        formattedPhone = formattedPhone.startsWith('0') ? formattedPhone.substring(1) : formattedPhone;
        formattedPhone = '84' + formattedPhone;

        this.isLoading = true;
        this.http.post('http://localhost:3000/api/auth/reset-password', {
            phone: formattedPhone,
            otp: this.forgotOtp.trim(),
            newPassword: this.forgotNewPassword
        }).subscribe({
            next: (res: any) => {
                this.isLoading = false;
                this.successMessage = res.message || 'Đặt lại mật khẩu thành công!';
                this.cdr.detectChanges();
                setTimeout(() => { this.switchTab('login'); }, 2000);
            },
            error: (err: any) => {
                this.isLoading = false;
                this.errorMessage = err.error?.message || 'OTP không hợp lệ hoặc đã hết hạn.';
                this.forgotStep = 'otp';
                this.cdr.detectChanges();
            }
        });
    }

    togglePassword() {
        this.showPassword = !this.showPassword;
    }

    toggleForgotPassword() {
        this.showForgotPassword = !this.showForgotPassword;
    }
}
