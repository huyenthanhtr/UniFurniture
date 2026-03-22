import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

const API_BASE_URL = 'http://localhost:3000/api';

@Component({
  selector: 'app-account-security',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './security.html',
  styleUrl: './security.css',
})
export class AccountSecurityTab {
  @Input() profile: any = null;

  private readonly http = inject(HttpClient);

  form = { oldPassword: '', newPassword: '', confirmPassword: '' };
  saving = signal(false);
  submitError = signal('');
  fieldErrors = signal<{ oldPassword: string; newPassword: string; confirmPassword: string }>({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  touched = {
    oldPassword: false,
    newPassword: false,
    confirmPassword: false,
  };
  showOldPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  modalVisible = signal(false);
  modalTitle = signal('');
  modalMessage = signal('');
  modalType = signal<'success' | 'error'>('success');

  get accountId(): string {
    return String(this.profile?._id || this.profile?.id || '').trim();
  }

  async changePassword(): Promise<void> {
    this.submitError.set('');

    const isValid = this.validateForm(true);
    if (!isValid) {
      return;
    }

    this.saving.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${API_BASE_URL}/profiles/${this.accountId}/change-password`, {
          old_password: this.form.oldPassword,
          new_password: this.form.newPassword,
        })
      );

      this.form = { oldPassword: '', newPassword: '', confirmPassword: '' };
      this.fieldErrors.set({ oldPassword: '', newPassword: '', confirmPassword: '' });
      this.touched.oldPassword = false;
      this.touched.newPassword = false;
      this.touched.confirmPassword = false;
      this.showModal('Đổi mật khẩu thành công', 'Mật khẩu tài khoản của bạn đã được cập nhật.', 'success');
    } catch (err: any) {
      const message =
        err?.error?.message ||
        'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu cũ.';
      if (message.toLowerCase().includes('mật khẩu hiện tại')) {
        this.fieldErrors.update((prev) => ({ ...prev, oldPassword: message }));
        this.touched.oldPassword = true;
      } else {
        this.submitError.set(message);
      }
      this.showModal('Không thể đổi mật khẩu', message, 'error');
    } finally {
      this.saving.set(false);
    }
  }

  closeModal(): void {
    this.modalVisible.set(false);
  }

  togglePasswordVisibility(field: 'old' | 'new' | 'confirm'): void {
    if (field === 'old') {
      this.showOldPassword.update((v) => !v);
      return;
    }
    if (field === 'new') {
      this.showNewPassword.update((v) => !v);
      return;
    }
    this.showConfirmPassword.update((v) => !v);
  }

  markTouched(field: 'oldPassword' | 'newPassword' | 'confirmPassword'): void {
    this.touched[field] = true;
    this.validateForm();
  }

  hasFieldError(field: 'oldPassword' | 'newPassword' | 'confirmPassword'): boolean {
    return this.touched[field] && !!this.fieldErrors()[field];
  }

  private validateForm(markAllTouched = false): boolean {
    const nextErrors = { oldPassword: '', newPassword: '', confirmPassword: '' };

    if (!String(this.form.oldPassword || '').trim()) {
      nextErrors.oldPassword = '* Bắt buộc';
    }
    if (!String(this.form.newPassword || '').trim()) {
      nextErrors.newPassword = '* Bắt buộc';
    }
    if (!String(this.form.confirmPassword || '').trim()) {
      nextErrors.confirmPassword = '* Bắt buộc';
    }

    if (!nextErrors.newPassword && this.form.newPassword.length < 6) {
      nextErrors.newPassword = '* Mật khẩu mới phải có ít nhất 6 ký tự';
    }

    if (!nextErrors.newPassword && !nextErrors.confirmPassword && this.form.newPassword !== this.form.confirmPassword) {
      nextErrors.confirmPassword = '* Mật khẩu xác nhận không khớp';
    }

    if (!nextErrors.oldPassword && !nextErrors.newPassword && this.form.oldPassword === this.form.newPassword) {
      nextErrors.newPassword = '* Mật khẩu mới phải khác mật khẩu hiện tại';
    }

    this.fieldErrors.set(nextErrors);

    if (markAllTouched) {
      this.touched.oldPassword = true;
      this.touched.newPassword = true;
      this.touched.confirmPassword = true;
    }

    return !nextErrors.oldPassword && !nextErrors.newPassword && !nextErrors.confirmPassword;
  }

  private showModal(title: string, message: string, type: 'success' | 'error' = 'success'): void {
    this.modalTitle.set(String(title || '').trim());
    this.modalMessage.set(String(message || '').trim());
    this.modalType.set(type);
    this.modalVisible.set(true);
  }
}
