import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  private readonly http = inject(HttpClient);

  @Input() form!: CheckoutForm;
  @Output() formChange = new EventEmitter<Partial<CheckoutForm>>();

  shippingZone: ShippingZone | null = null;
  addressTouched = false;

  provinces: Option[] = [...FALLBACK_PROVINCES];
  districtOptions: Option[] = [];
  loadingDistricts = false;

  private provinceCodeByName = new Map<string, number>();

  touched = {
    fullName: false,
    phone: false,
    email: false,
    province: false,
    district: false,
    address: false,
  };

  ngOnInit(): void {
    this.loadProvinces();
    if (this.form?.province) {
      this.loadDistrictsByProvinceName(this.form.province);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['form']) {
      this.detectZone();
      if (this.form?.province && this.districtOptions.length === 0) {
        this.loadDistrictsByProvinceName(this.form.province);
      }
    }
  }

  get shouldShowShippingMethod(): boolean {
    return this.isRequiredFilled('province') && 
           this.isRequiredFilled('district') && 
           this.isRequiredFilled('address') && 
           !!this.shippingZone;
  }

  onProvinceChange(value: string): void {
    this.addressTouched = true;
    this.touched.province = true;

    this.formChange.emit({
      province: value,
      district: '',
      shippingMethod: '',
    });

    this.districtOptions = [];
    if (value) {
      this.loadDistrictsByProvinceName(value);
    }

    this.detectZone(value, '');
  }

  onDistrictChange(value: string): void {
    this.addressTouched = true;
    this.touched.district = true;
    this.formChange.emit({ district: value, shippingMethod: '' });
    this.detectZone(this.form?.province || '', value);
  }

  onAddressChange(value: string): void {
    this.addressTouched = true;
    this.formChange.emit({ address: value, shippingMethod: '' });
    this.detectZone();
  }

  selectShipping(method: 'GIAO_VA_LAP' | 'GIAO_KHONG_LAP'): void {
    this.formChange.emit({ shippingMethod: method });
  }

  patch(field: keyof CheckoutForm, value: string): void {
    this.formChange.emit({ [field]: value } as Partial<CheckoutForm>);
  }

  markTouched(field: 'fullName' | 'phone' | 'email' | 'province' | 'district' | 'address'): void {
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

    return !this.isPhoneFormatValid(rawPhone);
  }

  phoneErrorMessage(): string {
    const rawPhone = String(this.form?.phone || '').trim();
    if (!rawPhone) {
      return '* Bắt buộc';
    }
    return '* Số điện thoại không hợp lệ';
  }

  isEmailInvalid(): boolean {
    if (!this.touched.email) {
      return false;
    }

    const email = String(this.form?.email || '').trim();
    if (!email) {
      return false;
    }

    return !this.isEmailFormatValid(email);
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
    this.http
      .get<ProvinceApi[]>('https://provinces.open-api.vn/api/?depth=1')
      .subscribe({
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
          // Giữ fallback mặc định
        },
      });
  }

  private loadDistrictsByProvinceName(provinceName: string): void {
    const code = this.provinceCodeByName.get(provinceName);
    if (!code) {
      this.districtOptions = [{ value: 'Quận/Huyện khác', label: 'Quận/Huyện khác' }];
      return;
    }

    this.loadingDistricts = true;
    this.http
      .get<ProvinceDetailApi>(`https://provinces.open-api.vn/api/p/${code}?depth=2`)
      .subscribe({
        next: (res) => {
          const districts = Array.isArray(res?.districts) ? res.districts : [];
          const mapped = districts
            .map((item) => String(item.name || '').trim())
            .filter((name) => Boolean(name))
            .sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }))
            .map((name) => ({ value: name, label: name }));

          this.districtOptions = mapped.length
            ? mapped
            : [{ value: 'Quận/Huyện khác', label: 'Quận/Huyện khác' }];
          this.loadingDistricts = false;
        },
        error: () => {
          this.districtOptions = [{ value: 'Quận/Huyện khác', label: 'Quận/Huyện khác' }];
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
}