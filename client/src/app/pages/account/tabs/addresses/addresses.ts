import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

const API_BASE_URL = 'http://localhost:3000/api';

export interface Address {
  _id?: string;
  fullName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  address: string;
  isDefault: boolean;
}

interface Option {
  value: string;
  label: string;
}

interface ProvinceApi {
  code: number;
  name: string;
}

interface DistrictApi {
  code: number;
  name: string;
}

interface ProvinceDetailApi {
  districts?: DistrictApi[];
}

const FALLBACK_PROVINCES: Option[] = [
  { value: 'TP.HCM', label: 'TP.HCM' },
  { value: 'Bình Dương', label: 'Bình Dương' },
  { value: 'Đồng Nai', label: 'Đồng Nai' },
  { value: 'Long An', label: 'Long An' },
  { value: 'Tây Ninh', label: 'Tây Ninh' },
  { value: 'Bà Rịa - Vũng Tàu', label: 'Bà Rịa - Vũng Tàu' },
  { value: 'Tiền Giang', label: 'Tiền Giang' },
  { value: 'Gia Lai', label: 'Gia Lai' },
  { value: 'Lào Cai', label: 'Lào Cai' },
];

@Component({
  selector: 'app-account-addresses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './addresses.html',
  styleUrl: './addresses.css',
})
export class AccountAddressesTab implements OnInit {
  @Input() profile: any = null;
  private readonly http = inject(HttpClient);

  addresses = signal<Address[]>([]);
  loading = signal(false);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  error = signal('');
  loadingDistricts = signal(false);
  modalVisible = signal(false);
  modalTitle = signal('');
  modalMessage = signal('');
  modalType = signal<'success' | 'error'>('success');

  form: Address = this.emptyForm();
  private resolvedCustomerId = signal('');
  provinces: Option[] = [...FALLBACK_PROVINCES];
  districtOptions: Option[] = [];
  private provinceCodeByName = new Map<string, number>();

  touched = {
    fullName: false,
    phone: false,
    province: false,
    district: false,
    address: false,
  };

  get profileId(): string {
    return String(this.profile?._id || this.profile?.id || '').trim();
  }

  ngOnInit(): void {
    this.loadProvinces();
    void this.bootstrap();
  }

  async bootstrap(): Promise<void> {
    const customerId = await this.ensureCustomerId();
    if (!customerId) {
      this.error.set('Khong tim thay customer_id hop le de tai so dia chi.');
      this.showModal('Không thể tải sổ địa chỉ', 'Không tìm thấy tài khoản khách hàng hợp lệ.', 'error');
      return;
    }
    await this.loadAddresses();
  }

  async loadAddresses(): Promise<void> {
    const customerId = this.resolvedCustomerId();
    if (!customerId) return;

    this.loading.set(true);
    this.error.set('');
    try {
      const res = await firstValueFrom(
        this.http.get<{ items?: any[] }>(`${API_BASE_URL}/customer-address`, {
          params: { customer_id: customerId, limit: '100' },
        })
      );
      const rows = Array.isArray(res?.items) ? res.items : [];
      this.addresses.set(rows.map((row) => this.normalizeAddress(row)));
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Khong the tai danh sach dia chi.');
      this.showModal('Không thể tải sổ địa chỉ', 'Vui lòng kiểm tra kết nối và thử lại.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  openAddForm(): void {
    this.form = this.emptyForm();
    this.editingId.set(null);
    this.resetTouched();
    this.districtOptions = [];
    this.showForm.set(true);
    this.error.set('');
  }

  openEditForm(addr: Address): void {
    this.form = { ...addr };
    this.editingId.set(addr._id || null);
    this.resetTouched();
    this.loadDistrictsByProvinceName(this.form.province, this.form.district);
    this.showForm.set(true);
    this.error.set('');
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.error.set('');
  }

  async saveAddress(): Promise<void> {
    const customerId = this.resolvedCustomerId();
    if (!customerId) {
      this.error.set('Thieu customer_id. Vui long dang nhap lai.');
      this.showModal('Không thể lưu địa chỉ', 'Thiếu customer_id. Vui lòng đăng nhập lại.', 'error');
      return;
    }

    const validationError = this.validateForm();
    if (validationError) {
      this.markAllTouched();
      return;
    }

    this.saving.set(true);
    this.error.set('');
    try {
      const payload = this.toApiPayload(this.form, customerId);
      const editingId = this.editingId();

      let saved: any;
      if (editingId) {
        saved = await firstValueFrom(this.http.patch(`${API_BASE_URL}/customer-address/${editingId}`, payload));
      } else {
        saved = await firstValueFrom(this.http.post(`${API_BASE_URL}/customer-address`, payload));
      }

      if (this.form.isDefault && saved?._id) {
        await this.setDefaultById(String(saved._id));
      }

      this.showForm.set(false);
      this.editingId.set(null);
      await this.loadAddresses();
      this.showModal(
        editingId ? 'Cập nhật thành công' : 'Thêm địa chỉ thành công',
        editingId ? 'Địa chỉ của bạn đã được cập nhật.' : 'Địa chỉ mới đã được lưu vào tài khoản.',
        'success'
      );
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Luu dia chi that bai.');
      this.showModal('Không thể lưu địa chỉ', 'Vui lòng kiểm tra thông tin và thử lại.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  canSubmitAddress(): boolean {
    return !this.validateForm();
  }

  onPhoneInput(value: string): void {
    // Keep only characters accepted by checkout phone normalization.
    this.form.phone = String(value || '').replace(/[^\d+\s.-]/g, '');
  }

  markTouched(field: 'fullName' | 'phone' | 'province' | 'district' | 'address'): void {
    this.touched[field] = true;
  }

  isInvalid(field: 'fullName' | 'province' | 'district' | 'address'): boolean {
    return this.touched[field] && !this.isRequiredFilled(field);
  }

  isPhoneInvalid(): boolean {
    if (!this.touched.phone) {
      return false;
    }

    const rawPhone = String(this.form?.phone || '').trim();
    if (!rawPhone) {
      return true;
    }

    return !this.isPhoneValid(rawPhone);
  }

  phoneErrorMessage(): string {
    const rawPhone = String(this.form?.phone || '').trim();
    if (!rawPhone) {
      return '* Bắt buộc';
    }
    return '* Số điện thoại không hợp lệ';
  }

  onProvinceChange(value: string): void {
    this.form.province = value;
    this.form.district = '';
    this.touched.province = true;
    this.touched.district = true;

    this.districtOptions = [];
    if (value) {
      this.loadDistrictsByProvinceName(value);
    }
  }

  onDistrictChange(value: string): void {
    this.form.district = value;
    this.touched.district = true;
  }

  private isPhoneValid(phoneValue?: string): boolean {
    const phone = String(phoneValue ?? this.form.phone ?? '').trim();
    if (!phone) return false;
    const normalizedPhone = phone.replace(/[\s.-]/g, '');
    return /^(0\d{9}|\+84\d{9})$/.test(normalizedPhone);
  }

  async setDefault(addr: Address): Promise<void> {
    if (!addr._id) return;
    try {
      await this.setDefaultById(String(addr._id));
      await this.loadAddresses();
      this.showModal('Cập nhật thành công', 'Địa chỉ mặc định đã được thay đổi.', 'success');
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Khong the dat dia chi mac dinh.');
      this.showModal('Không thể cập nhật', 'Không thể đặt địa chỉ mặc định. Vui lòng thử lại.', 'error');
    }
  }

  async deleteAddress(addr: Address): Promise<void> {
    if (!addr._id || !confirm('Xoa dia chi nay?')) return;
    try {
      await firstValueFrom(this.http.delete(`${API_BASE_URL}/customer-address/${addr._id}`));
      await this.loadAddresses();
      this.showModal('Xóa thành công', 'Địa chỉ đã được xóa khỏi tài khoản.', 'success');
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Khong the xoa dia chi.');
      this.showModal('Không thể xóa địa chỉ', 'Vui lòng thử lại sau.', 'error');
    }
  }

  private async setDefaultById(targetId: string): Promise<void> {
    const current = this.addresses();
    await Promise.all(
      current
        .filter((item) => !!item._id)
        .map((item) =>
          firstValueFrom(
            this.http.patch(`${API_BASE_URL}/customer-address/${item._id}`, {
              is_default: String(item._id) === targetId,
            })
          )
        )
    );
  }

  private normalizeAddress(row: any): Address {
    return {
      _id: row?._id,
      fullName: row?.customer_address_name || '',
      phone: row?.address_phone || '',
      province: row?.province || '',
      district: row?.district || '',
      ward: row?.ward || '',
      address: row?.address_line || '',
      isDefault: Boolean(row?.is_default),
    };
  }

  private toApiPayload(form: Address, customerId: string): any {
    return {
      customer_id: customerId,
      customer_address_name: String(form.fullName || '').trim(),
      address_phone: String(form.phone || '').trim(),
      address_line: String(form.address || '').trim(),
      ward: '',
      district: String(form.district || '').trim(),
      province: String(form.province || '').trim(),
      is_default: Boolean(form.isDefault),
      status: 'active',
    };
  }

  private emptyForm(): Address {
    return {
      fullName: '',
      phone: '',
      province: '',
      district: '',
      ward: '',
      address: '',
      isDefault: false,
    };
  }

  private validateForm(): string {
    if (!this.form.fullName.trim()) return 'missing-fullName';
    if (!this.form.phone.trim()) return 'missing-phone';
    if (!this.isPhoneValid(this.form.phone)) {
      return 'invalid-phone';
    }
    if (!this.form.province.trim()) return 'missing-province';
    if (!this.form.district.trim()) return 'missing-district';
    if (!this.form.address.trim()) return 'missing-address';
    return '';
  }

  private isRequiredFilled(field: 'fullName' | 'phone' | 'province' | 'district' | 'address'): boolean {
    const value = String(this.form?.[field] || '').trim();
    return value.length > 0;
  }

  private markAllTouched(): void {
    this.touched.fullName = true;
    this.touched.phone = true;
    this.touched.province = true;
    this.touched.district = true;
    this.touched.address = true;
  }

  private resetTouched(): void {
    this.touched.fullName = false;
    this.touched.phone = false;
    this.touched.province = false;
    this.touched.district = false;
    this.touched.address = false;
  }

  private loadProvinces(): void {
    this.http.get<ProvinceApi[]>('https://provinces.open-api.vn/api/?depth=1').subscribe({
      next: (items) => {
        if (!Array.isArray(items) || !items.length) return;

        const mapped = items
          .map((item) => ({ code: Number(item.code), name: String(item.name || '').trim() }))
          .filter((item) => item.code > 0 && item.name)
          .sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));

        this.provinceCodeByName = new Map(mapped.map((item) => [item.name, item.code]));
        this.provinces = mapped.map((item) => ({ value: item.name, label: item.name }));
      },
      error: () => {
        // keep fallback list
      },
    });
  }

  private loadDistrictsByProvinceName(provinceName: string, preferredDistrict = ''): void {
    const code = this.provinceCodeByName.get(provinceName);
    if (!code) {
      const fallback = [{ value: 'Quận/Huyện khác', label: 'Quận/Huyện khác' }];
      this.districtOptions = fallback;
      if (preferredDistrict && !fallback.find((item) => item.value === preferredDistrict)) {
        this.districtOptions = [{ value: preferredDistrict, label: preferredDistrict }, ...fallback];
      }
      return;
    }

    this.loadingDistricts.set(true);
    this.http.get<ProvinceDetailApi>(`https://provinces.open-api.vn/api/p/${code}?depth=2`).subscribe({
      next: (res) => {
        const districts = Array.isArray(res?.districts) ? res.districts : [];
        const mapped = districts
          .map((item) => String(item.name || '').trim())
          .filter((name) => Boolean(name))
          .sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }))
          .map((name) => ({ value: name, label: name }));

        const fallback = [{ value: 'Quận/Huyện khác', label: 'Quận/Huyện khác' }];
        const options = mapped.length ? mapped : fallback;
        if (preferredDistrict && !options.find((item) => item.value === preferredDistrict)) {
          this.districtOptions = [{ value: preferredDistrict, label: preferredDistrict }, ...options];
        } else {
          this.districtOptions = options;
        }

        this.loadingDistricts.set(false);
      },
      error: () => {
        const fallback = [{ value: 'Quận/Huyện khác', label: 'Quận/Huyện khác' }];
        if (preferredDistrict && !fallback.find((item) => item.value === preferredDistrict)) {
          this.districtOptions = [{ value: preferredDistrict, label: preferredDistrict }, ...fallback];
        } else {
          this.districtOptions = fallback;
        }
        this.loadingDistricts.set(false);
      },
    });
  }

  closeModal(): void {
    this.modalVisible.set(false);
  }

  private showModal(title: string, message: string, type: 'success' | 'error' = 'success'): void {
    this.modalTitle.set(String(title || '').trim());
    this.modalMessage.set(String(message || '').trim());
    this.modalType.set(type);
    this.modalVisible.set(true);
  }

  private async ensureCustomerId(): Promise<string> {
    const direct = String(this.profile?.customer_id || this.profile?.customerId || '').trim();
    if (direct) {
      this.resolvedCustomerId.set(direct);
      return direct;
    }

    const phone = String(this.profile?.phone || '').trim();
    const fullName = String(this.profile?.full_name || this.profile?.fullName || '').trim() || phone || 'Khach hang';
    const created = await firstValueFrom(
      this.http.post<any>(`${API_BASE_URL}/customers`, {
        full_name: fullName,
        phone,
        customer_type: 'member',
        status: 'active',
      })
    );
    const customerId = String(created?._id || '').trim();

    if (customerId && this.profileId) {
      try {
        const updatedProfile = await firstValueFrom(
          this.http.patch<any>(`${API_BASE_URL}/profiles/${this.profileId}`, { customer_id: customerId })
        );
        const raw = localStorage.getItem('user_profile');
        const current = raw ? JSON.parse(raw) : {};
        const merged = { ...current, ...updatedProfile, customer_id: customerId };
        localStorage.setItem('user_profile', JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: merged }));
      } catch {
        // Ignore profile sync failure; addresses still work with resolved customer id.
      }
    }

    this.resolvedCustomerId.set(customerId);
    return customerId;
  }
}
