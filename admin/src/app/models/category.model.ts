export interface Category {
  _id?: string;
  category_code: string;
  name: string;
  slug?: string;
  description?: string;
  image_url?: string;
  room: 'Phòng khách' | 'Phòng ăn' | 'Phòng ngủ' | 'Phòng làm việc';
  status: 'active' | 'inactive';
  createdAt?: Date;
  updatedAt?: Date;
}