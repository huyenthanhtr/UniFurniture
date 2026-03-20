const Order = require('../models/Order');
const ProductVariant = require('../models/ProductVariant');
const Product = require('../models/Product');
const OrderDetail = require('../models/OrderDetail');

const IN_PROGRESS_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipping',
  'delivered'
];

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getOrderDate(order) {
  const rawDate = order?.ordered_at || order?.createdAt || order?.created_at;
  const parsed = rawDate ? new Date(rawDate) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function resolveDateRange(rangePreset, startDate, endDate) {
  const now = new Date();
  const end = endDate ? new Date(endDate) : new Date(now);
  end.setHours(23, 59, 59, 999);

  let start;

  if (rangePreset === 'custom' && startDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  switch (rangePreset) {
    case 'last7days':
      start = new Date(end);
      start.setDate(end.getDate() - 6);
      break;

    case 'thisMonth':
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      break;

    case 'thisQuarter': {
      const quarterStartMonth = Math.floor(end.getMonth() / 3) * 3;
      start = new Date(end.getFullYear(), quarterStartMonth, 1);
      break;
    }

    case 'thisYear':
    default:
      start = new Date(end.getFullYear(), 0, 1);
      break;
  }

  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function getWeekNumber(date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

function getBucketKey(date, granularity) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (granularity === 'day') {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  if (granularity === 'week') {
    return `${year}-W${String(getWeekNumber(date)).padStart(2, '0')}`;
  }

  if (granularity === 'month') {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  const quarter = Math.floor((month - 1) / 3) + 1;
  return `${year}-Q${quarter}`;
}

function formatBucketLabel(key, granularity) {
  if (granularity === 'day') {
    const [year, month, day] = key.split('-');
    return `${day}/${month}`;
  }

  if (granularity === 'week') {
    const [year, week] = key.split('-W');
    return `T${Number(week)}/${year}`;
  }

  if (granularity === 'month') {
    const [year, month] = key.split('-');
    return `${month}/${year}`;
  }

  return key.replace('-', ' ');
}

function generateBucketKeys(start, end, granularity) {
  const keys = [];
  const cursor = new Date(start);

  if (granularity === 'day') {
    while (cursor <= end) {
      keys.push(getBucketKey(cursor, 'day'));
      cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
  }

  if (granularity === 'week') {
    while (cursor <= end) {
      keys.push(getBucketKey(cursor, 'week'));
      cursor.setDate(cursor.getDate() + 7);
    }
    return keys;
  }

  if (granularity === 'month') {
    cursor.setDate(1);
    while (cursor <= end) {
      keys.push(getBucketKey(cursor, 'month'));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return keys;
  }

  cursor.setMonth(Math.floor(cursor.getMonth() / 3) * 3, 1);
  while (cursor <= end) {
    keys.push(getBucketKey(cursor, 'quarter'));
    cursor.setMonth(cursor.getMonth() + 3);
  }
  return keys;
}

function buildTrendData(orders, start, end, granularity) {
  const grouped = new Map();

  for (const order of orders) {
    const orderDate = getOrderDate(order);
    if (orderDate < start || orderDate > end) continue;

    const key = getBucketKey(orderDate, granularity);
    if (!grouped.has(key)) {
      grouped.set(key, { revenue: 0, count: 0 });
    }

    const bucket = grouped.get(key);
    bucket.count += 1;

    if (normalizeStatus(order.status) === 'completed') {
      bucket.revenue += Number(order.total_amount || 0);
    }
  }

  const keys = generateBucketKeys(start, end, granularity);

  return {
    labels: keys.map(key => formatBucketLabel(key, granularity)),
    revenueData: keys.map(key => grouped.get(key)?.revenue || 0),
    countData: keys.map(key => grouped.get(key)?.count || 0)
  };
}

function buildStatusStats(orders) {
  const stats = {};
  for (const order of orders) {
    const status = normalizeStatus(order.status);
    stats[status] = (stats[status] || 0) + 1;
  }
  return stats;
}

function buildInventoryAlerts(variants, products) {
    // Tạo Map để tra cứu thông tin sản phẩm cha nhanh hơn
    const productsMap = new Map(
        products.map(product => [String(product._id), product])
    );

    // BƯỚC 1: Lọc và làm giàu dữ liệu (Gán vào biến enriched)
    const enriched = variants
        .filter(v => v.variant_status === 'active') // CHỈ LẤY BIẾN THỂ ĐANG BÁN
        .map(variant => {
            const parentProduct = productsMap.get(String(variant.product_id));
            
            // Ép kiểu về Number để so sánh chính xác
            const stock = Number(variant.stock_quantity || 0);
            const threshold = Number(variant.low_stock_threshold || 5);

            return {
                ...variant,
                parent_product_name: parentProduct ? parentProduct.name : 'Sản phẩm không xác định',
                stock: stock,
                threshold: threshold
            };
        });

    // BƯỚC 2: Phân loại dựa trên mảng 'enriched' đã hoàn tất khởi tạo
    const needRestockItems = enriched.filter(item => item.stock <= 3);
    
    const lowStockItems = enriched.filter(item => 
        item.stock > 3 && item.stock <= item.threshold
    );

    return { needRestockItems, lowStockItems };
}
async function buildTopSellingProducts(orders) {
  const completedOrders = orders.filter(
    order => normalizeStatus(order.status) === 'completed'
  );

  if (completedOrders.length === 0) {
    return [];
  }

  const orderIds = completedOrders.map(order => order._id);

  const orderDetails = await OrderDetail.find({
    order_id: { $in: orderIds }
  }).lean();

  if (!orderDetails.length) {
    return [];
  }

  const [variants, products] = await Promise.all([
    ProductVariant.find({}).lean(),
    Product.find({}, { _id: 1, name: 1 }).lean()
  ]);

  const productMap = new Map(
    products.map(product => [String(product._id), product])
  );

  const variantMap = new Map(
    variants.map(variant => [String(variant._id), variant])
  );

  const grouped = new Map();

  for (const detail of orderDetails) {
    const variantIdRaw = detail.product_variant_id || detail.variant_id;
    const variantId =
      typeof variantIdRaw === 'object'
        ? String(variantIdRaw._id || variantIdRaw.id || '')
        : String(variantIdRaw || '');

    if (!variantId) continue;

    const variant = variantMap.get(variantId);
    if (!variant) continue;

    let productIdRaw = variant.product_id;
    if (productIdRaw && typeof productIdRaw === 'object') {
      productIdRaw = productIdRaw._id || productIdRaw.id || productIdRaw;
    }

    const productId = String(productIdRaw || '');
    const product = productMap.get(productId);

    const quantity = Number(detail.quantity || 0);
    const lineRevenue =
      Number(detail.total_price ?? detail.subtotal ?? 0) ||
      Number(detail.price || 0) * quantity;

    if (!grouped.has(variantId)) {
      grouped.set(variantId, {
        parent_product_id: productId,
        product_name: product?.name || 'Sản phẩm chưa cập nhật tên',
        variant_name: variant?.name || 'Mặc định',
        sku: variant?.sku || 'N/A',
        sold_quantity: 0,
        revenue: 0
      });
    }

    const item = grouped.get(variantId);
    item.sold_quantity += quantity;
    item.revenue += lineRevenue;
  }

  return Array.from(grouped.values())
    .sort((a, b) => {
      if (b.sold_quantity !== a.sold_quantity) {
        return b.sold_quantity - a.sold_quantity;
      }
      return b.revenue - a.revenue;
    })
    .slice(0, 10);
}
exports.getOverview = async (req, res, next) => {
  try {
    const rangePreset = String(req.query.rangePreset || 'thisYear');
    const granularity = String(req.query.granularity || 'month');
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const { start, end } = resolveDateRange(rangePreset, startDate, endDate);

    const orderDateFilter = {
      $gte: start,
      $lte: end
    };

    const orders = await Order.find({
      $or: [
        { ordered_at: orderDateFilter },
        { createdAt: orderDateFilter },
        { created_at: orderDateFilter }
      ]
    }).lean();

    const [variants, products] = await Promise.all([
      ProductVariant.find({}).lean(),
      Product.find({}, { _id: 1, name: 1 }).lean()
    ]);

    const inventory = buildInventoryAlerts(variants, products);

    const totalRevenue = orders
      .filter(order => normalizeStatus(order.status) === 'completed')
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

    const processingOrdersCount = orders.filter(order =>
      IN_PROGRESS_ORDER_STATUSES.includes(normalizeStatus(order.status))
    ).length;


const installationOrders = await Order.find({
  is_installed: true,
  status: { $in: IN_PROGRESS_ORDER_STATUSES }
})
  .sort({ ordered_at: -1, createdAt: -1, created_at: -1 })
  .lean();
const topSellingProducts = await buildTopSellingProducts(orders);
    const trend = buildTrendData(orders, start, end, granularity);
    const statusStats = buildStatusStats(orders);

      const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  threeDaysAgo.setHours(0, 0, 0, 0);

  // Lọc đơn trong 3 ngày gần nhất từ tập đơn đã load
  const ordersInLast3Days = orders.filter(o => getOrderDate(o) >= threeDaysAgo);
  
  // Nếu số đơn trong 3 ngày < 10, lấy top 10 đơn mới nhất. Ngược lại lấy hết đơn 3 ngày.
  const recentOrdersCount = Math.max(10, ordersInLast3Days.length);
  const recentOrders = [...orders]
    .sort((a, b) => getOrderDate(b).getTime() - getOrderDate(a).getTime())
    .slice(0, recentOrdersCount);

    res.json({
      summary: {
        totalRevenue,
        totalOrders: orders.length,
        processingOrdersCount,
        needRestockCount: inventory.needRestockCount,
        lowStockCount: inventory.lowStockCount
      },
      trend,
      statusStats,
      lists: {
        recentOrders,
        installationOrders,
        topSellingProducts
      },
      inventoryAlerts: {
        needRestockItems: inventory.needRestockItems,
        lowStockItems: inventory.lowStockItems
      },
      meta: {
        rangePreset,
        granularity,
        startDate: formatDateInput(start),
        endDate: formatDateInput(end)
      }
    });
  } catch (error) {
    next(error);
  }
};