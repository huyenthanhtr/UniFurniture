import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface PolicyArticle {
  slug: string;
  title: string;
  paragraphs: string[];
  highlights: string[];
}

const POLICY_ARTICLES: PolicyArticle[] = [
  {
    slug: 'chinh-sach-ban-hang',
    title: 'Chính Sách Bán Hàng',
    paragraphs: [
      'Nếu quý khách hàng không thanh toán toàn bộ giá trị đơn hàng trước khi giao hàng thì với các đơn hàng có giá trị trên 10,000,000đ; quý khách hàng vui lòng đặt cọc 10%. Phần giá trị còn lại của đơn hàng quý khách hàng vui lòng thanh toán ngay lúc nhận hàng. Nếu quý khách hàng hủy đơn hàng, U-HOME FURNI sẽ không hoàn lại số tiền 10% quý khách đã đặt cọc.',
      'Trong trường hợp quý khách hàng không thanh toán ngay phần giá trị còn lại của đơn hàng khi nhận hàng, U-HOME FURNI sẽ thu hồi số sản phẩm tương ứng với số tiền chưa thanh toán và quý khách hàng vui lòng thanh toán phí giao hàng cho U-HOME FURNI là 300,000đ cho các khu vực miễn phí giao hàng.',
      'Các loại phí phát sinh theo quy định của ban quản lý tại địa điểm nhận hàng liên quan đến việc giao hàng bằng xe tải, sử dụng thang máy giao hàng,... quý khách hàng vui lòng thanh toán trực tiếp với ban quản lý tại địa điểm nhận hàng của khách hàng.',
      'Nếu quý khách hàng có nhu cầu xuất hóa đơn vui lòng thông báo cho U-HOME FURNI ngay lúc đặt hàng. Hóa đơn đã xuất không thể chỉnh sửa hoặc hủy và xuất lại. Hóa đơn xuất theo yêu cầu của quý khách hàng sẽ được gửi đến quý khách hàng trong vòng 7 ngày kể từ ngày giao hàng thành công, không tính thứ 7, chủ nhật và các ngày lễ, tết.',
      'Sau 24 tiếng kể từ khi đơn hàng được xác nhận, quý khách hàng không thể thay đổi hoặc hủy đơn hàng sau khi đơn hàng đã được đóng gói và chuyển qua bộ phận vận chuyển.',
      'Thời gian lưu kho cho 1 đơn hàng tối đa là 30 ngày kể từ ngày đặt hàng. Quý khách hàng có nhu cầu lưu kho trên 7 ngày vui lòng thanh toán trước 100% giá trị đơn hàng. Nếu quý khách hàng hủy đơn hàng, quý khách hàng vui lòng thanh toán phí lưu kho cho U-HOME FURNI là 10% giá trị đơn hàng.',
      'U-HOME FURNI có quyền điều chỉnh chính sách khi cần thiết mà không cần thông báo trước.',
      '**Mọi thông tin chi tiết vui lòng liên hệ hotline: 0123 456 789.',
    ],
    highlights: [
      'Đặt cọc 10% đơn hàng',
      'Lưu kho tối đa 30 ngày',
      'Xuất hóa đơn trong 24 giờ',
      'Phí giao hàng bổ sung 300,000đ',
      'Hỗ trợ xuất hóa đơn',
      'Thay đổi lịch trước 24 giờ',
      'Quy định lưu kho rõ ràng',
      'Điều khoản minh bạch',
    ],
  },
  {
    slug: 'giao-hang-lap-dat',
    title: 'Chính Sách Giao Hàng & Lắp Đặt',
    paragraphs: [
      'U-HOME FURNI hỗ trợ giao hàng và lắp đặt theo các quy định dưới đây. Phí giao hàng đã được tính trong giá sản phẩm hiển thị trên website, khách hàng không cần thanh toán thêm chi phí vận chuyển.',
      'Thời gian giao hàng dự kiến trong vòng 3 ngày làm việc, từ 9h00 - 16h00, từ thứ Hai đến thứ Bảy (trừ lễ, Tết).',
      'U-HOME FURNI hỗ trợ giao hàng và lắp đặt tại các khu vực gần TP.HCM gồm: tất cả các quận/huyện thuộc TP.HCM (trừ Cần Giờ), TP. Thủ Đức, Biên Hòa, Dĩ An, Thuận An, Thủ Dầu Một, Tân Uyên và một số khu vực lân cận.',
      'Đối với các khu vực xa TP.HCM hoặc ngoài phạm vi hỗ trợ lắp đặt, U-HOME FURNI vẫn hỗ trợ giao hàng nhưng không hỗ trợ lắp đặt tại nhà.',
      'Quy định về lịch giao hàng: quý khách vui lòng sắp xếp thời gian nhận hàng theo lịch đã xác nhận với U-HOME FURNI. Nếu có việc bận đột xuất, vui lòng thông báo ít nhất 24 tiếng trước khi giao hàng.',
      'U-HOME FURNI hỗ trợ dời lịch giao hàng tối đa 1 lần. Từ lần tiếp theo, công ty có thể từ chối giao hàng và hủy đơn hàng.',
      'Quy định về lắp đặt: U-HOME FURNI chỉ lắp đặt theo tiêu chuẩn sản phẩm của hãng, không thực hiện các yêu cầu riêng như khoan tường, gắn sản phẩm lên tường hoặc các hạng mục ngoài tiêu chuẩn.',
      'U-HOME FURNI có quyền điều chỉnh chính sách khi cần thiết mà không cần thông báo trước.',
      '**Mọi thông tin chi tiết vui lòng liên hệ hotline: 0123 456 789.',
    ],
    highlights: [
      'Phí giao hàng đã tính trong giá',
      'Giao hàng trong 3 ngày làm việc',
      'Khung giờ 9h00 - 16h00',
      'Giao từ thứ Hai đến thứ Bảy',
      'Hỗ trợ lắp đặt khu vực gần TP.HCM',
      'Khu vực xa chỉ giao hàng',
      'Dời lịch giao tối đa 1 lần',
      'Hotline hỗ trợ trực tiếp',
    ],
  },
  {
    slug: 'bao-hanh-bao-tri',
    title: 'Chính Sách Bảo Hành & Bảo Trì',
    paragraphs: [
      'Thời hạn bảo hành: 5 năm tính từ ngày giao hàng thành công, áp dụng bảo hành 5 năm và bảo trì trọn đời.',
      'Phạm vi bảo hành: U-HOME FURNI bảo hành miễn phí cho các sản phẩm hư hỏng do lỗi chất liệu (không bao gồm khác biệt màu gỗ, vân gỗ, mắt gỗ theo đặc tính tự nhiên), lỗi kỹ thuật và lỗi lắp đặt từ phía hãng.',
      'U-HOME FURNI không bảo hành với các trường hợp: thiệt hại do thiên tai/cháy nổ hoặc bất khả kháng; khách tự vận chuyển bằng đơn vị ngoài, tự lắp đặt/sửa chữa/thay đổi kết cấu ban đầu; sử dụng sai hướng dẫn (quá tải, sai công năng, để vật nóng trực tiếp, dùng hóa chất mạnh...); hư hỏng cơ học do người dùng hoặc ngoại lực, ngập nước, ẩm cao, nhiệt cao; hao mòn tự nhiên theo thời gian; sản phẩm thuộc chương trình giảm giá không còn bán trên website.',
      'Chính sách bảo trì: với sản phẩm không nằm trong phạm vi bảo hành hoặc đã hết hạn bảo hành 5 năm, U-HOME FURNI vẫn nhận bảo trì trọn đời với chi phí hợp lý theo tình trạng thực tế.',
      'Quyết định của U-HOME FURNI là quyết định cuối cùng và có thể thay đổi mà không cần thông báo trước.',
      '* Bảo hành 01 năm khung ghế, mâm và cần cho Ghế Văn Phòng.',
      '**Mọi thông tin chi tiết vui lòng liên hệ hotline: 0123 456 789.',
    ],
    highlights: [
      'Bảo hành 5 năm',
      'Bảo trì trọn đời',
      'Áp dụng theo nhóm sản phẩm',
      'Chính sách minh bạch',
      'Bảo hành miễn phí tùy nhóm',
      'Loại trừ hao mòn tự nhiên',
      'Không áp dụng đồ trang trí, nệm',
      'Ghế văn phòng bảo hành 1 năm',
    ],
  },
  {
    slug: 'doi-tra',
    title: 'Chính Sách Đổi Trả',
    paragraphs: [
      'Chính sách đổi hàng: trong vòng 3 ngày kể từ ngày giao hàng thành công (không tính chủ nhật và ngày lễ, tết), quý khách được đổi sản phẩm miễn phí khi đồng thời đủ 2 điều kiện.',
      'Điều kiện 1: sản phẩm bị hư hỏng do lỗi chất liệu (không bao gồm khác biệt màu gỗ/vân gỗ/mắt gỗ do đặc tính tự nhiên), lỗi kỹ thuật hoặc lỗi lắp đặt từ phía U-HOME FURNI.',
      'Điều kiện 2: đổi sang sản phẩm khác có giá trị bằng hoặc cao hơn sản phẩm đã giao.',
      'Sau 3 ngày kể từ ngày giao hàng thành công, U-HOME FURNI áp dụng chính sách bảo hành cho các lỗi chất liệu, kỹ thuật và lắp đặt; không áp dụng đổi sang sản phẩm khác.',
      'Chính sách trả hàng: quý khách chỉ được trả hàng tại thời điểm giao hàng nếu sản phẩm không đúng thông tin đặt hàng do quý khách đặt nhầm hoặc thay đổi ý kiến.',
      '**Mọi thông tin chi tiết vui lòng liên hệ hotline: 0123 456 789.',
    ],
    highlights: [
      'Đổi trong 3 ngày',
      'Yêu cầu đủ 2 điều kiện',
      'Phí trả hàng 300,000đ',
      'Không tính chủ nhật/lễ tết',
      'Ưu tiên xử lý nhanh',
      'Có chuyển sang bảo hành',
      'Áp dụng tại thời điểm giao',
      'Không áp dụng đồ trang trí',
    ],
  },
  {
    slug: 'khach-hang-than-thiet',
    title: 'Khách Hàng Thân Thiết U-HOMIE',
    paragraphs: [
      'U-HOMIE - Become U-HOME FURNI homies. Với U-HOME FURNI, mỗi khách hàng đều là người đồng hành được trân quý.',
      'Cách tích điểm: 100,000đ tương đương 1 điểm. Điểm tự động cộng khi đơn hàng thanh toán thành công.',
      'Khi tích đủ 20 điểm (2,000,000đ), quý khách trở thành khách hàng thân thiết U-HOMIE.',
      'Hạng khách hàng: Bronze (Hạng Đồng) từ 20 điểm; Silver (Hạng Bạc) từ 50 điểm; Gold (Hạng Vàng) từ 150 điểm; Diamond (Hạng Kim Cương) từ 500 điểm.',
      'Ưu đãi theo hạng: Bronze là hạng khởi tạo chưa có ưu đãi; Silver giảm 3% cho tất cả đơn hàng; Gold giảm 5%; Diamond giảm 7%.',
      'Lưu ý: mức giảm áp dụng trên giá đã khuyến mãi theo chương trình hiện hành. Không áp dụng cho sản phẩm thanh lý.',
      'Điểm tích lũy sẽ bị xóa sau 365 ngày nếu không phát sinh đơn hàng mới, hoặc có phát sinh nhưng giao không thành công.',
      'Giới hạn sử dụng 1 lần cho mỗi khách hàng trong thời gian diễn ra khuyến mãi.',
      'Voucher chỉ hợp lệ với khách hàng đang thuộc chương trình khách hàng thân thiết tại thời điểm đặt đơn.',
      'Quyết định của U-HOME FURNI là quyết định cuối cùng và có thể thay đổi mà không cần thông báo trước.',
      '**Mọi thông tin chi tiết vui lòng liên hệ hotline: 0123 456 789.',
    ],
    highlights: [
      '100,000đ = 1 điểm',
      '4 hạng thành viên',
      'Ưu đãi đến 7%',
      'Điểm cộng sau thanh toán',
      'Xét hạng tự động',
      'Voucher theo điều kiện',
      'Điểm hết hạn sau 365 ngày',
      'Khách hàng thân thiết từ 20 điểm',
    ],
  },
  {
    slug: 'doi-tac-ban-hang',
    title: 'Chính Sách Đối Tác Bán Hàng',
    paragraphs: [
      'Đối tượng áp dụng: tất cả cá nhân/doanh nghiệp trong nhiều lĩnh vực, chứ không giới hạn các công ty thiết kế nội thất, thi công xây dựng, chủ cửa hàng, chủ cơ sở dịch vụ như quán cafe, quán ăn...',
      'Phạm vi áp dụng: toàn bộ sản phẩm thương hiệu U-HOME FURNI, và toàn bộ khu vực thuộc phạm vi bán hàng/giao hàng của U-HOME FURNI.',
      'Quyền lợi: Được hỗ trợ chính sách giao hàng, lắp đặt, bảo hành và bảo trì theo quy định của U-HOME FURNI; được hỗ trợ ấn phẩm truyền thông; được hỗ trợ kiến thức sản phẩm và cung cấp sản phẩm trưng bày tại cửa hàng đối tác.',
      'Trách nhiệm: đối tác phải tuân thủ chính sách giá bán, bán đúng giá niêm yết trên website U-HOME FURNI, không phá giá sản phẩm.',
      'Đối tác không sử dụng sai mục đích các sản phẩm trưng bày và thông tin sản phẩm do U-HOME FURNI cung cấp.',
      'Đối tác có trách nhiệm giữ gìn và đảm bảo chất lượng sản phẩm trưng bày, ấn phẩm truyền thông do U-HOME FURNI cung cấp.',
    ],
    highlights: [
      'Áp dụng cho cá nhân & doanh nghiệp',
      'Không giới hạn ngành nghề',
      'Áp dụng toàn bộ sản phẩm U-HOME FURNI',
      'Áp dụng toàn bộ khu vực bán hàng',
      'Hỗ trợ giao hàng & lắp đặt',
      'Hỗ trợ truyền thông & trưng bày',
      'Được đào tạo kiến thức sản phẩm',
      'Yêu cầu tuân thủ giá niêm yết',
    ],
  },
];

@Component({
  selector: 'app-policy-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './policy.html',
  styleUrl: './policy.css',
})
export class PolicyPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly policyLinks = POLICY_ARTICLES.map((item) => ({ title: item.title, slug: item.slug }));

  currentPolicy: PolicyArticle = POLICY_ARTICLES[0];

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') || '';
      this.currentPolicy = POLICY_ARTICLES.find((item) => item.slug === slug) || POLICY_ARTICLES[0];
    });
  }
}
