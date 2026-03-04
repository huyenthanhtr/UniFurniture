const Product = require("../models/Product");

async function getProducts(req, res, next) {
    try {
        const {
            page = 1,
            limit = 20,
            sortBy = "createdAt",
            order = "desc",
            category,
            collection,
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        if (isNaN(pageNum) || isNaN(limitNum) || pageNum <= 0 || limitNum <= 0) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }
        if (!["asc", "desc"].includes(order)) {
            return res.status(400).json({ error: "Invalid order parameter" });
        }
        if (!["createdAt", "bestSelling"].includes(sortBy)) {
            return res.status(400).json({ error: "Invalid sortBy parameter" });
        }

        const sortDirection = order === "desc" ? -1 : 1;
        const skip = (pageNum - 1) * limitNum;

        const query = {};
        if (category) {
            const ids = String(category).split(',').map(s => s.trim()).filter(Boolean);
            query.category_id = ids.length === 1 ? ids[0] : { $in: ids };
        }
        if (collection) query.collection_id = collection;

        const sortOptions =
            sortBy === "bestSelling"
                ? { sold: sortDirection, createdAt: -1, _id: -1 }
                : { createdAt: sortDirection, _id: -1 };

        const [items, total] = await Promise.all([
            Product.find(query).sort(sortOptions).skip(skip).limit(limitNum),
            Product.countDocuments(query),
        ]);

        res.json({
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
            items,
        });
    } catch (err) {
        next(err);
    }
}

async function getProductById(req, res, next) {
    try {
        const doc = await Product.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: "Product not found" });
        res.json(doc);
    } catch (err) {
        next(err);
    }
}

module.exports = { getProducts, getProductById };
