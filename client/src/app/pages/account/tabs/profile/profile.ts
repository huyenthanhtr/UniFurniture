import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, Input, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

const API_BASE_URL = 'http://localhost:3000/api';

@Component({
  selector: 'app-account-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class AccountProfileTab implements OnInit {
  @Input() profile: any = null;
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  private readonly http = inject(HttpClient);

  saving = signal(false);
  uploadingAvatar = signal(false);
  isCameraOpen = signal(false);
  modalVisible = signal(false);
  modalTitle = signal('');
  modalMessage = signal('');
  modalType = signal<'success' | 'error'>('success');

  form = { fullName: '', email: '', avatarUrl: '' };
  stream: MediaStream | null = null;

  ngOnInit(): void {
    this.form = {
      fullName: this.profile?.full_name || this.profile?.fullName || '',
      email: this.profile?.email || '',
      avatarUrl: this.profile?.avatar_url || this.profile?.avatarUrl || '',
    };
  }

  get accountId(): string {
    return String(this.profile?._id || this.profile?.id || '').trim();
  }

  async onAvatarChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingAvatar.set(true);
    try {
      const dataUrl = await this.fileToDataUrl(file);
      // Use compressed data URL directly to avoid backend upload endpoint mismatch.
      this.form.avatarUrl = await this.optimizeImageDataUrl(dataUrl, 900, 0.82);
    } catch (err: any) {
      this.showModal('Không thể tải ảnh lên', err?.message || 'Vui lòng thử lại.', 'error');
    } finally {
      this.uploadingAvatar.set(false);
      input.value = '';
    }
  }

  async openRealCamera(): Promise<void> {
    try {
      this.isCameraOpen.set(true);
      setTimeout(async () => {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
        });
        if (this.videoElement) {
          this.videoElement.nativeElement.srcObject = this.stream;
        }
      }, 100);
    } catch {
      this.isCameraOpen.set(false);
      this.showModal('Không thể mở camera', 'Vui lòng cấp quyền camera cho trình duyệt.', 'error');
    }
  }

  capturePhoto(): void {
    const video = this.videoElement?.nativeElement;
    const canvas = this.canvasElement?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!video || !canvas || !context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    this.form.avatarUrl = dataUrl;
    this.stopCamera();
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.isCameraOpen.set(false);
  }

  async save(): Promise<void> {
    if (!this.accountId) return;

    this.saving.set(true);

    try {
      const payload = {
        full_name: this.form.fullName.trim(),
        email: this.form.email.trim(),
        avatar_url: this.form.avatarUrl,
      };

      let res: any;
      try {
        res = await firstValueFrom(this.http.patch(`${API_BASE_URL}/profiles/${this.accountId}`, payload));
      } catch {
        // Backward compatibility for environments still exposing /accounts/:id
        res = await firstValueFrom(this.http.patch(`${API_BASE_URL}/accounts/${this.accountId}`, payload));
      }
      const updated: any = (res as any)?.item || (res as any)?.account || (res as any)?.profile || res;

      let mergedProfile: any = updated;
      const raw = localStorage.getItem('user_profile');
      if (raw) {
        const current = JSON.parse(raw);
        mergedProfile = { ...current, ...updated };
        localStorage.setItem('user_profile', JSON.stringify(mergedProfile));
      }
      window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: mergedProfile }));

      if (this.profile && typeof this.profile === 'object') {
        Object.assign(this.profile, updated);
      }

      this.showModal('Cập nhật thành công', 'Thông tin hồ sơ của bạn đã được lưu.', 'success');
    } catch (err: any) {
      this.showModal(
        'Không thể lưu thay đổi',
        err?.error?.message || err?.message || 'Vui lòng thử lại sau.',
        'error'
      );
    } finally {
      this.saving.set(false);
    }
  }

  get avatarPreview(): string {
    return this.form.avatarUrl || '';
  }

  get initials(): string {
    const name = this.form.fullName || this.profile?.phone || 'U';
    return name.charAt(0).toUpperCase();
  }

  closeModal(): void {
    this.modalVisible.set(false);
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Doc file anh that bai.'));
      reader.readAsDataURL(file);
    });
  }

  private optimizeImageDataUrl(dataUrl: string, maxSide = 900, quality = 0.82): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const ratio = Math.min(maxSide / width, maxSide / height, 1);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  private showModal(title: string, message: string, type: 'success' | 'error' = 'success'): void {
    this.modalTitle.set(String(title || '').trim());
    this.modalMessage.set(String(message || '').trim());
    this.modalType.set(type);
    this.modalVisible.set(true);
  }
}
