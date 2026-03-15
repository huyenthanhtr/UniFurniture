export interface Review {
  _id: string;
  order_detail_id: {
    _id: string;
    product_name: string;
    order_id?: {
      _id: string;
      order_code: string;
      shipping_name: string;
      shipping_email: string;
    };
  };
  // DÙNG KHỐI NÀY ĐỂ CHỨA THÔNG TIN KHÁCH TỪ BẢNG CUSTOMERS
  customer_id?: {
    _id: string;
    customer_code: string;
    full_name: string;
    phone: string;
  };
  rating: number;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  images?: string[];
  videos?: string[];
  reply?: {
    content: string;
    repliedAt: Date;
  };
  createdAt: Date;
}