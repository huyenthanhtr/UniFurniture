import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CheckoutForm } from '../../checkout';

export type ShippingZone = 'GIAO_VA_LAP' | 'GIAO_KHONG_LAP' | 'NGOAI_VUNG';

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

interface SavedAddress {
  _id: string;
  fullName: string;
  phone: string;
  province: string;
  district: string;
  address: string;
  isDefault: boolean;
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

const INSTALLABLE_BD_DISTRICTS = new Set(['di an', 'thuan an', 'thu dau mot', 'tan uyen']);

@Component({
  selector: 'app-shipping-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shipping-form.html',
  styleUrl: './shipping-form.css',
})
export class ShippingFormComponent implements OnInit, OnChanges {
  private readonly apiBaseUrl = 'http://localhost:3000/api';
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  @Input() form!: CheckoutForm;
  @Output() formChange = new EventEmitter<Partial<CheckoutForm>>();

  shippingZone: ShippingZone | null = null;
  addressTouched = false;

  provinces: Option[] = [...FALLBACK_PROVINCES];
  districtOptions: Option[] = [];
  loadingDistricts = false;

  private provinceCodeByName = new Map<string, number>();
  isLoggedIn = false;
  loadingSavedAddresses = false;
  savedAddresses: SavedAddress[] = [];
  selectedSavedAddressId = '';
  savedAddressError = '';
  private hasAutoAppliedDefaultAddress = false;
  private lastDistrictProvince = '';

  touched = {
    fullName: false,
    phone: false,
    email: false,
    province: false,
    district: false,
    address: false,
  };

  ngOnInit(): void {
    this.isLoggedIn = this.checkLoggedIn();
    this.loadProvinces();

    if (this.isLoggedIn) {
      void this.loadSavedAddresses();
    }

    if (this.form?.province) {
      const mappedProvince = this.resolveProvinceValue(this.form.province);
      this.loadDistrictsByProvinceName(mappedProvince, this.form.district || '');
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['form']) {
      this.detectZone();
      const mappedProvince = this.resolveProvinceValue(this.form?.province || '');
      if (mappedProvince && mappedProvince !== this.lastDistrictProvince) {
        this.loadDistrictsByProvinceName(mappedProvince, this.form?.district || '');
      } else if (mappedProvince && this.districtOptions.length === 0) {
        this.loadDistrictsByProvinceName(mappedProvince, this.form.district || '');
      }
    }
  }

  get shouldShowShippingMethod(): boolean {
    return (
      this.isRequiredFilled('province') &&
      this.isRequiredFilled('district') &&
      this.isRequiredFilled('address') &&
      !!this.shippingZone
    );
  }

  onProvinceChange(value: string): void {
    this.addressTouched = true;
    this.touched.province = true;
    this.clearSelectedSavedAddress();

    const mappedProvince = this.resolveProvinceValue(value);

    this.formChange.emit({
      province: mappedProvince,
      district: '',
      shippingMethod: '',
    });

    this.districtOptions = [];
    if (mappedProvince) {
      this.loadDistrictsByProvinceName(mappedProvince);
    }

    this.detectZone(mappedProvince, '');
  }

  onDistrictChange(value: string): void {
    this.addressTouched = true;
    this.touched.district = true;
    this.clearSelectedSavedAddress();
    this.formChange.emit({ district: value, shippingMethod: '' });
    this.detectZone(this.form?.province || '', value);
  }

  onAddressChange(value: string): void {
    this.addressTouched = true;
    this.clearSelectedSavedAddress();
    this.formChange.emit({ address: value, shippingMethod: '' });
    this.detectZone();
  }

  selectShipping(method: 'GIAO_VA_LAP' | 'GIAO_KHONG_LAP'): void {
    this.formChange.emit({ shippingMethod: method });
  }

  patch(field: keyof CheckoutForm, value: string): void {
    if (field !== 'note') {
      this.clearSelectedSavedAddress();
    }
    this.formChange.emit({ [field]: value } as Partial<CheckoutForm>);
  }

  onSavedAddressChange(addressId: string): void {
    this.selectedSavedAddressId = String(addressId || '').trim();
    const selected = this.savedAddresses.find((item) => item._id === this.selectedSavedAddressId);
    if (selected) {
      this.applySavedAddress(selected);
    }
  }

  useManualAddressEntry(): void {
    this.selectedSavedAddressId = '';
    this.addressTouched = true;
    this.formChange.emit({
      fullName: '',
      phone: '',
      province: '',
      district: '',
      address: '',
      shippingMethod: '',
    });
    this.districtOptions = [];
  }

  openAddressBook(): void {
    void this.router.navigate(['/tai-khoan'], { queryParams: { tab: 'addresses' } });
  }

  markTouched(field: 'fullName' | 'phone' | 'email' | 'province' | 'district' | 'address'): void {
    this.touched[field] = true;
  }

  isInvalid(field: 'fullName' | 'province' | 'district' | 'address'): boolean {
    return this.touched[field] && !this.isRequiredFilled(field);
  }

  isPhoneInvalid(): boolean {
    if (!this.touched.phone) return false;

    const rawPhone = String(this.form?.phone || '').trim();
    if (!rawPhone) return true;

    return !this.isPhoneFormatValid(rawPhone);
  }

  phoneErrorMessage(): string {
    const rawPhone = String(this.form?.phone || '').trim();
    if (!rawPhone) return '* Bắt buộc';
    return '* Số điện thoại không hợp lệ';
  }

  isEmailInvalid(): boolean {
    if (!this.touched.email) return false;

    const email = String(this.form?.email || '').trim();
    if (!email) return false;

    return !this.isEmailFormatValid(email);
  }

  hasProvinceOption(value: string): boolean {
    const target = String(value || '').trim();
    if (!target) return false;
    return this.provinces.some((item) => String(item.value || '').trim() === target);
  }

  hasDistrictOption(value: string): boolean {
    const target = String(value || '').trim();
    if (!target) return false;
    return this.districtOptions.some((item) => String(item.value || '').trim() === target);
  }

  isDefaultSavedAddress(item: SavedAddress): boolean {
    return Boolean(item?.isDefault);
  }

  isDefaultSavedAddressSelected(): boolean {
    if (!this.selectedSavedAddressId) return false;
    const selected = this.savedAddresses.find((item) => item._id === this.selectedSavedAddressId);
    return Boolean(selected?.isDefault);
  }

  private isRequiredFilled(field: 'fullName' | 'phone' | 'province' | 'district' | 'address'): boolean {
    const value = String(this.form?.[field] || '').trim();
    return value.length > 0;
  }

  private isPhoneFormatValid(value: string): boolean {
    const normalized = value.replace(/[\s.-]/g, '');
    return /^(0\d{9}|\+84\d{9})$/.test(normalized);
  }

  private isEmailFormatValid(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
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

        if (this.form?.province) {
          const mappedProvince = this.resolveProvinceValue(this.form.province);
          this.loadDistrictsByProvinceName(mappedProvince, this.form.district || '');
        }
      },
      error: () => {
        // keep fallback
      },
    });
  }

  private loadDistrictsByProvinceName(provinceName: string, preferredDistrict = ''): void {
    this.lastDistrictProvince = String(provinceName || '').trim();
    const code = this.provinceCodeByName.get(provinceName);
    if (!code) {
      const fallback = [{ value: 'Quận/Huyện khác', label: 'Quận/Huyện khác' }];
      const preferred = this.resolveDistrictValue(preferredDistrict, fallback);
      if (preferred && !fallback.find((item) => item.value === preferred)) {
        this.districtOptions = [{ value: preferred, label: preferred }, ...fallback];
      } else {
        this.districtOptions = fallback;
      }
      this.syncPreferredDistrict(preferredDistrict, preferred);
      return;
    }

    this.loadingDistricts = true;
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
        const preferred = this.resolveDistrictValue(preferredDistrict, options);

        if (preferred && !options.find((item) => item.value === preferred)) {
          this.districtOptions = [{ value: preferred, label: preferred }, ...options];
        } else {
          this.districtOptions = options;
        }
        this.syncPreferredDistrict(preferredDistrict, preferred);
        this.loadingDistricts = false;
      },
      error: () => {
        const fallback = [{ value: 'Quận/Huyện khác', label: 'Quận/Huyện khác' }];
        const preferred = this.resolveDistrictValue(preferredDistrict, fallback);
        if (preferred && !fallback.find((item) => item.value === preferred)) {
          this.districtOptions = [{ value: preferred, label: preferred }, ...fallback];
        } else {
          this.districtOptions = fallback;
        }
        this.syncPreferredDistrict(preferredDistrict, preferred);
        this.loadingDistricts = false;
      },
    });
  }

  private detectZone(provinceOverride?: string, districtOverride?: string): void {
    const province = this.normalize(provinceOverride ?? this.form?.province ?? '');
    const district = this.normalize(districtOverride ?? this.form?.district ?? '');

    if (!province) {
      this.shippingZone = null;
      return;
    }

    const isHcm = province.includes('ho chi minh') || province.includes('tp.hcm') || province.includes('thanh pho ho chi minh');
    if (isHcm) {
      if (!district) {
        this.shippingZone = null;
        return;
      }

      if (district.includes('can gio')) {
        this.shippingZone = 'GIAO_KHONG_LAP';
        this.emitShippingMethodIfChanged('GIAO_KHONG_LAP');
        return;
      }

      this.shippingZone = 'GIAO_VA_LAP';
      return;
    }

    if (province.includes('dong nai')) {
      if (district.includes('bien hoa')) {
        this.shippingZone = 'GIAO_VA_LAP';
        return;
      }
      this.shippingZone = 'GIAO_KHONG_LAP';
      this.emitShippingMethodIfChanged('GIAO_KHONG_LAP');
      return;
    }

    if (province.includes('binh duong')) {
      if ([...INSTALLABLE_BD_DISTRICTS].some((name) => district.includes(name))) {
        this.shippingZone = 'GIAO_VA_LAP';
        return;
      }
      this.shippingZone = 'GIAO_KHONG_LAP';
      this.emitShippingMethodIfChanged('GIAO_KHONG_LAP');
      return;
    }

    if (
      province.includes('long an') ||
      province.includes('tay ninh') ||
      province.includes('ba ria') ||
      province.includes('vung tau') ||
      province.includes('tien giang')
    ) {
      this.shippingZone = 'GIAO_KHONG_LAP';
      this.emitShippingMethodIfChanged('GIAO_KHONG_LAP');
      return;
    }

    this.shippingZone = 'NGOAI_VUNG';
    this.emitShippingMethodIfChanged('GIAO_KHONG_LAP');
  }

  private emitShippingMethodIfChanged(method: 'GIAO_VA_LAP' | 'GIAO_KHONG_LAP'): void {
    if (this.form?.shippingMethod !== method) {
      this.formChange.emit({ shippingMethod: method });
    }
  }

  private normalize(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }

  private checkLoggedIn(): boolean {
    const token = String(localStorage.getItem('access_token') || '').trim();
    if (token) return true;
    const rawProfile = String(localStorage.getItem('user_profile') || '').trim();
    if (!rawProfile) return false;
    try {
      const profile = JSON.parse(rawProfile);
      return !!String(profile?._id || profile?.id || profile?.phone || '').trim();
    } catch {
      return false;
    }
  }

  private async loadSavedAddresses(): Promise<void> {
    this.loadingSavedAddresses = true;
    this.savedAddressError = '';

    try {
      const customerId = await this.resolveCustomerId();
      if (!customerId) {
        this.savedAddresses = [];
        return;
      }

      const res = await firstValueFrom(
        this.http.get<{ items?: any[] }>(`${this.apiBaseUrl}/customer-address`, {
          params: { customer_id: customerId, limit: '100' },
        })
      );
      const rows = Array.isArray(res?.items) ? res.items : [];
      this.savedAddresses = rows
        .map((row) => this.mapSavedAddress(row))
        .filter((row) => !!row._id)
        .sort((a, b) => {
          if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
          return a.fullName.localeCompare(b.fullName, 'vi', { sensitivity: 'base' });
        });

      const defaultAddress = this.savedAddresses.find((item) => item.isDefault) || this.savedAddresses[0];
      if (defaultAddress) {
        this.selectedSavedAddressId = defaultAddress._id;
        if (!this.hasAutoAppliedDefaultAddress) {
          this.applySavedAddress(defaultAddress);
          this.hasAutoAppliedDefaultAddress = true;
        }
      }
    } catch {
      this.savedAddresses = [];
      this.savedAddressError = 'Không thể tải sổ địa chỉ đã lưu.';
    } finally {
      this.loadingSavedAddresses = false;
    }
  }

  private applySavedAddress(address: SavedAddress): void {
    const mappedProvince = this.resolveProvinceValue(address.province);
    this.loadDistrictsByProvinceName(mappedProvince, address.district);
    this.addressTouched = true;
    const mappedDistrict = String(address.district || '').trim();
    this.formChange.emit({
      fullName: address.fullName,
      phone: address.phone,
      province: mappedProvince || address.province,
      district: mappedDistrict,
      address: address.address,
      shippingMethod: '',
    });
    this.detectZone(mappedProvince || address.province, mappedDistrict);
  }

  private mapSavedAddress(row: any): SavedAddress {
    const baseAddressLine = String(row?.address_line || '').trim();
    const fullAddress = String(row?.full_address || row?.shipping_address || '').trim();
    const fallbackParts = this.parseDistrictProvince(fullAddress || baseAddressLine);
    const districtRaw = this.getMeaningfulAddressText(row?.district) || fallbackParts.district;
    const provinceRaw = this.getMeaningfulAddressText(row?.province) || fallbackParts.province;
    const addressLine = baseAddressLine || fallbackParts.address;

    return {
      _id: String(row?._id || '').trim(),
      fullName: String(row?.customer_address_name || '').trim(),
      phone: String(row?.address_phone || '').trim(),
      province: this.normalizeAddressLabel(provinceRaw),
      district: this.normalizeAddressLabel(districtRaw),
      address: String(addressLine || '').trim(),
      isDefault: Boolean(row?.is_default),
    };
  }

  private async resolveCustomerId(): Promise<string> {
    const rawProfile = String(localStorage.getItem('user_profile') || '').trim();
    if (!rawProfile) return '';

    let profile: any = null;
    try {
      profile = JSON.parse(rawProfile);
    } catch {
      return '';
    }

    const direct = String(profile?.customer_id || profile?.customerId || '').trim();
    if (direct) return direct;

    const phone = String(profile?.phone || '').trim();
    const fullName = String(profile?.full_name || profile?.fullName || '').trim() || phone || 'Khach hang';
    const created = await firstValueFrom(
      this.http.post<any>(`${this.apiBaseUrl}/customers`, {
        full_name: fullName,
        phone,
        customer_type: 'member',
        status: 'active',
      })
    );
    const customerId = String(created?._id || '').trim();

    if (customerId && profile?._id) {
      try {
        const updatedProfile = await firstValueFrom(
          this.http.patch<any>(`${this.apiBaseUrl}/profiles/${String(profile._id).trim()}`, { customer_id: customerId })
        );
        const merged = { ...profile, ...updatedProfile, customer_id: customerId };
        localStorage.setItem('user_profile', JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: merged }));
      } catch {
        // ignore profile sync failure
      }
    }

    return customerId;
  }

  private resolveProvinceValue(rawProvince: string): string {
    const source = String(rawProvince || '').trim();
    if (!source) return '';

    const alias = this.expandProvinceAlias(source);
    if (alias) return alias;

    const exact = this.provinces.find((item) => item.value === source);
    if (exact) return exact.value;

    const normalizeForCompare = (value: string): string =>
      this.normalize(value)
        .replace(/^tinh\s+/, '')
        .replace(/^thanh pho\s+/, '')
        .replace(/^tp\.\s*/, '')
        .replace(/^tp\s+/, '')
        .trim();

    const normalizedSource = normalizeForCompare(source);
    const found = this.provinces.find((item) => normalizeForCompare(item.value) === normalizedSource);
    if (found?.value) return found.value;

    const foundByAlias = this.provinces.find((item) => normalizeForCompare(item.value).includes(normalizedSource));
    return foundByAlias?.value || source;
  }

  private resolveDistrictValue(rawDistrict: string, options: Option[]): string {
    const source = String(rawDistrict || '').trim();
    if (!source) return '';

    const exact = options.find((item) => item.value === source);
    if (exact) return exact.value;

    const normalizedSource = this.normalizeDistrictName(source);
    const found = options.find((item) => {
      const normalizedItem = this.normalizeDistrictName(item.value);
      return normalizedItem === normalizedSource;
    });
    return found?.value || source;
  }

  private syncPreferredDistrict(rawPreferred: string, resolvedPreferred: string): void {
    const hasPreferred = String(rawPreferred || '').trim().length > 0;
    if (!hasPreferred) return;
    const nextDistrict = String(resolvedPreferred || rawPreferred || '').trim();
    if (!nextDistrict) return;
    if (String(this.form?.district || '').trim() === nextDistrict) return;
    this.formChange.emit({ district: nextDistrict });
  }

  private clearSelectedSavedAddress(): void {
    if (!this.selectedSavedAddressId) return;
    this.selectedSavedAddressId = '';
  }

  private parseDistrictProvince(rawAddress: string): { address: string; district: string; province: string } {
    const parts = String(rawAddress || '')
      .split(',')
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    if (!parts.length) {
      return { address: '', district: '', province: '' };
    }

    if (parts.length === 1) {
      return { address: parts[0], district: '', province: '' };
    }

    if (parts.length === 2) {
      return { address: parts[0], district: '', province: parts[1] };
    }

    return {
      address: parts.slice(0, -2).join(', '),
      district: parts[parts.length - 2],
      province: parts[parts.length - 1],
    };
  }

  private getMeaningfulAddressText(value: unknown): string {
    const source = String(value || '').trim();
    if (!source) return '';
    const normalized = this.normalize(source);
    if (normalized === '-' || normalized === 'khac' || normalized === 'n/a') return '';
    return source;
  }

  private normalizeAddressLabel(value: string): string {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeDistrictName(value: string): string {
    return this.normalize(value)
      .replace(/^quan\s+/, '')
      .replace(/^q\.\s*/, '')
      .replace(/^q\s+/, '')
      .replace(/^huyen\s+/, '')
      .replace(/^h\.\s*/, '')
      .replace(/^h\s+/, '')
      .replace(/^thi xa\s+/, '')
      .replace(/^tx\.\s*/, '')
      .replace(/^tx\s+/, '')
      .replace(/^thanh pho\s+/, '')
      .replace(/^tp\.\s*/, '')
      .replace(/^tp\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private expandProvinceAlias(rawProvince: string): string {
    const source = this.normalize(String(rawProvince || ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (!source) return '';

    if (source === 'br-vt' || source === 'brvt' || source === 'ba ria vung tau' || source === 'tinh ba ria vung tau') {
      return 'Bà Rịa - Vũng Tàu';
    }
    if (source === 'tphcm' || source === 'tp hcm' || source === 'tp.hcm' || source === 'ho chi minh') {
      return 'Thành phố Hồ Chí Minh';
    }
    if (source === 'hn' || source === 'ha noi' || source === 'hanoi') {
      return 'Hà Nội';
    }
    return '';
  }
}
