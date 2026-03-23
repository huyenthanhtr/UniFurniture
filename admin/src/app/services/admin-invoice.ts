import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';

type InvoiceBundle = {
  order: any;
  customer?: any;
  profile?: any;
  items?: any[];
  payments?: any[];
  display?: any;
  pricing?: any;
};

@Injectable({ providedIn: 'root' })
export class AdminInvoiceService {
  private readonly fontFamily = '"Times New Roman", Times, serif';
  private readonly seller = {
    companyName: 'Nội Thất U-Home Furni',
    address: 'Số 669 Đỗ Mười, khu phố 13, phường Linh Xuân, TP.HCM',
    phone: '0123 456 789',
    fax: '-',
    bankAccount: '-',
  };

  downloadInvoice(bundle: InvoiceBundle): void {
    const order = bundle?.order || {};
    const display = bundle?.display || {};
    const items = Array.isArray(bundle?.items) ? bundle.items : [];
    const pricing = bundle?.pricing || {};
    const payments = Array.isArray(bundle?.payments) ? bundle.payments : [];

    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Không thể khởi tạo bộ vẽ hoá đơn.');
    }

    this.paintBackground(ctx, canvas.width, canvas.height);

    const totalAmount = this.toNumber(pricing?.grand_total || order?.total_amount);
    const discountAmount = this.toNumber(pricing?.discount_amount);
    const orderDate = this.toDate(order?.ordered_at || order?.createdAt);
    const buyerName = String(display?.receiver_name || order?.shipping_name || '-').trim() || '-';
    const buyerAddress = String(display?.address || order?.shipping_address || '-').trim() || '-';
    const buyerPhone = String(display?.phone || order?.shipping_phone || '-').trim() || '-';
    const buyerEmail = String(display?.email || order?.shipping_email || '-').trim() || '-';
    const orderCode = String(order?.order_code || order?._id || 'invoice').trim() || 'invoice';
    const paymentLabel = this.getPaymentMethodLabel(payments);
    const buyerUnit = String(bundle?.customer?.customer_code || buyerEmail || '-').trim() || '-';

    ctx.fillStyle = '#111';
    ctx.textBaseline = 'top';

    this.text(ctx, 'HÓA ĐƠN BÁN HÀNG', 620, 72, { align: 'center', size: 30, weight: '700' });
    this.text(ctx, 'Liên 1: Lưu', 620, 118, { align: 'center', size: 17 });
    this.text(
      ctx,
      `Ngày ${orderDate.getDate()} tháng ${orderDate.getMonth() + 1} năm ${orderDate.getFullYear()}`,
      620,
      162,
      { align: 'center', size: 16, weight: '600' }
    );

    this.text(ctx, 'Mẫu số:', 930, 86, { size: 16, weight: '600' });
    this.text(ctx, 'Ký hiệu:', 930, 116, { size: 16, weight: '600' });
    this.text(ctx, `Số: ${orderCode}`, 930, 162, { size: 16, weight: '700' });

    this.line(ctx, 76, 212, 1164, 212);

    let y = 238;
    const leftX = 72;
    const valueX = 286;

    y = this.infoRow(ctx, 'Đơn vị bán hàng:', this.seller.companyName, leftX, valueX, y, { size: 18, weight: '700' });
    y = this.infoRow(ctx, 'Mã số thuế:', orderCode, leftX, valueX, y, { weight: '700' });
    y = this.infoRow(ctx, 'Địa chỉ:', this.seller.address, leftX, valueX, y, { weight: '700' });
    y = this.infoRow(ctx, 'Điện thoại:', this.seller.phone, leftX, valueX, y, { weight: '700', suffix: `   Fax: ${this.seller.fax}` });
    y = this.infoRow(ctx, 'Số tài khoản:', this.seller.bankAccount, leftX, valueX, y, { weight: '700' });

    this.line(ctx, 76, 420, 1164, 420);

    y = 444;
    y = this.infoRow(ctx, 'Họ tên người mua hàng:', buyerName, leftX, 326, y, { weight: '700', maxWidth: 810 });
    y = this.infoRow(ctx, 'Tên đơn vị:', buyerUnit, leftX, 220, y, { weight: '700' });
    y = this.infoRow(ctx, 'Mã số thuế:', '-', leftX, 220, y, { weight: '700' });
    y = this.infoRow(ctx, 'Địa chỉ:', buyerAddress, leftX, 170, y, { weight: '700', maxWidth: 920 });
    y = this.infoRow(ctx, 'Hình thức thanh toán:', paymentLabel, leftX, 320, y, {
      weight: '700',
      suffix: '   Số tài khoản: -',
    });
    y = this.infoRow(ctx, 'Thông tin liên hệ:', `${buyerPhone} / ${buyerEmail}`, leftX, 320, y, {
      weight: '700',
      maxWidth: 810,
    });

    const tableTop = Math.max(620, y + 18);
    const tableLeft = 72;
    const tableWidth = 1092;
    const rowHeight = 40;
    const headerHeight = 56;
    const tableRows = Math.max(items.length + (discountAmount > 0 ? 1 : 0), 10);
    const tableHeight = headerHeight + tableRows * rowHeight;
    const cols = [70, 405, 90, 130, 175, 222];
    const colXs = [tableLeft];
    for (const width of cols) colXs.push(colXs[colXs.length - 1] + width);

    ctx.strokeStyle = '#1f1f1f';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(tableLeft, tableTop, tableWidth, tableHeight);
    for (let i = 1; i < colXs.length - 1; i += 1) {
      this.line(ctx, colXs[i], tableTop, colXs[i], tableTop + tableHeight);
    }
    this.line(ctx, tableLeft, tableTop + headerHeight, tableLeft + tableWidth, tableTop + headerHeight);

    this.text(ctx, 'STT', tableLeft + cols[0] / 2, tableTop + 12, { align: 'center', size: 15, weight: '700' });
    this.text(ctx, 'Tên hàng hóa, dịch vụ', colXs[1] + cols[1] / 2, tableTop + 12, {
      align: 'center',
      size: 15,
      weight: '700',
    });
    this.text(ctx, 'Đơn vị tính', colXs[2] + cols[2] / 2, tableTop + 8, {
      align: 'center',
      size: 15,
      weight: '700',
    });
    this.text(ctx, 'Số lượng', colXs[3] + cols[3] / 2, tableTop + 12, { align: 'center', size: 15, weight: '700' });
    this.text(ctx, 'Đơn giá', colXs[4] + cols[4] / 2, tableTop + 12, { align: 'center', size: 15, weight: '700' });
    this.text(ctx, 'Thành tiền', colXs[5] + cols[5] / 2, tableTop + 12, { align: 'center', size: 15, weight: '700' });

    for (let row = 0; row < tableRows; row += 1) {
      const lineY = tableTop + headerHeight + row * rowHeight;
      this.line(ctx, tableLeft, lineY, tableLeft + tableWidth, lineY);
    }

    const itemRows = [...items];
    if (discountAmount > 0) {
      itemRows.push({
        product_name: `Khuyến mãi ${pricing?.coupon_code ? `(${pricing.coupon_code})` : ''}`.trim(),
        variant_name: '',
        quantity: 1,
        unit_price: -discountAmount,
        total: -discountAmount,
        invoice_unit: 'lần',
      });
    }

    itemRows.forEach((item, index) => {
      const rowTop = tableTop + headerHeight + index * rowHeight + 8;
      const itemName = [item?.product_name, item?.variant_name].filter(Boolean).join(' - ') || '-';
      this.text(ctx, String(index + 1), tableLeft + cols[0] / 2, rowTop, {
        align: 'center',
        size: 14,
        weight: '600',
      });
      this.text(ctx, itemName, colXs[1] + 8, rowTop, { size: 14, weight: '600', maxWidth: cols[1] - 16 });
      this.text(ctx, String(item?.invoice_unit || 'cái'), colXs[2] + cols[2] / 2, rowTop, {
        align: 'center',
        size: 14,
        weight: '600',
      });
      this.text(ctx, this.formatNumber(item?.quantity || 0), colXs[3] + cols[3] / 2, rowTop, {
        align: 'center',
        size: 14,
        weight: '600',
      });
      this.text(ctx, this.formatCurrency(item?.unit_price || 0), colXs[4] + cols[4] - 10, rowTop, {
        align: 'right',
        size: 14,
        weight: '600',
      });
      this.text(ctx, this.formatCurrency(item?.total || 0), colXs[5] + cols[5] - 10, rowTop, {
        align: 'right',
        size: 14,
        weight: '700',
      });
    });

    const summaryTop = tableTop + tableHeight + 20;
    this.line(ctx, 72, summaryTop, 1164, summaryTop);
    this.infoRow(ctx, 'Cộng tiền hàng hóa, dịch vụ:', this.formatCurrency(totalAmount), 72, 390, summaryTop + 18, {
      weight: '700',
      alignRight: true,
    });
    this.infoRow(
      ctx,
      'Số tiền viết bằng chữ:',
      `${this.numberToVietnamese(totalAmount)} đồng`,
      72,
      320,
      summaryTop + 68,
      { weight: '700', maxWidth: 730 }
    );

    const signatureTop = Math.min(1450, summaryTop + 140);
    this.drawSignatureBox(ctx, 116, signatureTop, 348, 190, 'Người mua hàng', '(Ký, ghi rõ họ tên)');
    this.drawSignatureBox(ctx, 776, signatureTop, 348, 190, 'Người bán hàng', '(Ký, đóng dấu, ghi rõ họ tên)');

    this.text(ctx, '(Cần kiểm tra, đối chiếu khi lập, giao, nhận hóa đơn)', 620, Math.min(1694, signatureTop + 244), {
      align: 'center',
      size: 13,
      italic: true,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    pdf.save(`hoa-don-${orderCode}.pdf`);
  }

  private paintBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#fffdf9';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#8b2d1d';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    ctx.strokeStyle = '#202020';
    ctx.lineWidth = 2;
    ctx.strokeRect(34, 34, width - 68, height - 68);

    ctx.strokeStyle = 'rgba(139, 45, 29, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 42; x < width - 42; x += 26) {
      this.line(ctx, x, 12, x + 12, 12);
    }
  }

  private infoRow(
    ctx: CanvasRenderingContext2D,
    label: string,
    value: string,
    labelX: number,
    valueX: number,
    y: number,
    opts: {
      size?: number;
      weight?: string;
      alignRight?: boolean;
      maxWidth?: number;
      suffix?: string;
    } = {}
  ): number {
    this.text(ctx, label, labelX, y, { size: 16 });
    const lines = this.text(ctx, `${String(value || '-')}${opts.suffix || ''}`, opts.alignRight ? 1130 : valueX, y - 1, {
      size: opts.size || 16,
      weight: opts.weight || '700',
      align: opts.alignRight ? 'right' : 'left',
      maxWidth: opts.maxWidth || 840,
    });
    return y + Math.max(40, lines * ((opts.size || 16) + 6));
  }

  private drawSignatureBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    subtitle: string
  ): void {
    ctx.strokeStyle = '#1f1f1f';
    ctx.lineWidth = 1.1;
    ctx.strokeRect(x, y, width, height);
    this.text(ctx, title, x + width / 2, y + 18, { align: 'center', size: 20, weight: '700' });
    this.text(ctx, subtitle, x + width / 2, y + 50, { align: 'center', size: 16, italic: true });
  }

  private text(
    ctx: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    opts: { size?: number; weight?: string; align?: CanvasTextAlign; italic?: boolean; maxWidth?: number } = {}
  ): number {
    const size = opts.size || 14;
    const weight = opts.weight || '400';
    const italic = opts.italic ? 'italic ' : '';
    ctx.font = `${italic}${weight} ${size}px ${this.fontFamily}`;
    ctx.textAlign = opts.align || 'left';
    const lines = this.wrapText(ctx, String(value || '-'), opts.maxWidth || 9999);
    // @ts-ignore
    lines.forEach((line: any, index: number) => {
      ctx.fillText(line, x, y + index * (size + 6));
    });
    return lines.length;
  }

  private wrapText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
    if (!value) return ['-'];
    if (!Number.isFinite(maxWidth) || maxWidth <= 0) return [value];
    const words = value.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !current) {
        current = test;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : ['-'];
  }

  private line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private toNumber(value: any): number {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num : 0;
  }

  private toDate(value: any): Date {
    const date = new Date(value || Date.now());
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  private formatNumber(value: any): string {
    return this.toNumber(value).toLocaleString('vi-VN');
  }

  private formatCurrency(value: any): string {
    return this.toNumber(value).toLocaleString('vi-VN');
  }

  private getPaymentMethodLabel(payments: any[]): string {
    const latest = payments[0] || {};
    const method = String(latest?.method || '').toLowerCase();
    if (method === 'bank_transfer') return 'Chuyển khoản';
    if (method === 'cod') return 'COD';
    return 'Chưa xác định';
  }

  private numberToVietnamese(value: number): string {
    const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const units = ['', 'nghìn', 'triệu', 'tỷ'];
    let num = Math.round(Math.abs(this.toNumber(value)));
    if (num === 0) return 'không';

    const readTriple = (triple: number, full: boolean): string => {
      const hundred = Math.floor(triple / 100);
      const ten = Math.floor((triple % 100) / 10);
      const one = triple % 10;
      const parts: string[] = [];

      if (full || hundred > 0) {
        parts.push(`${digits[hundred]} trăm`);
      }

      if (ten > 1) {
        parts.push(`${digits[ten]} mươi`);
        if (one === 1) parts.push('mốt');
        else if (one === 5) parts.push('lăm');
        else if (one > 0) parts.push(digits[one]);
      } else if (ten === 1) {
        parts.push('mười');
        if (one === 5) parts.push('lăm');
        else if (one > 0) parts.push(digits[one]);
      } else if (one > 0) {
        if (hundred > 0 || full) parts.push('lẻ');
        parts.push(one === 5 && (hundred > 0 || full) ? 'năm' : digits[one]);
      }

      return parts.join(' ').trim();
    };

    const groups: number[] = [];
    while (num > 0) {
      groups.push(num % 1000);
      num = Math.floor(num / 1000);
    }

    const parts: string[] = [];
    for (let i = groups.length - 1; i >= 0; i -= 1) {
      const group = groups[i];
      if (group === 0) continue;
      const text = readTriple(group, i < groups.length - 1);
      const unit = units[i % units.length];
      parts.push(text);
      if (unit) parts.push(unit);
    }

    const result = parts.join(' ').replace(/\s+/g, ' ').trim();
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
}
