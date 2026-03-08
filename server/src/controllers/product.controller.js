const Product = require("../models/Product");

async function getProducts(req, res, next) {
    try {
        const {
            page = 1,
            limit = 20,
            sortBy = "createdAt",
            order = "desc",
            category,
            category_id,
            collection,
            collection_id,
            sort,
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        if (isNaN(pageNum) || isNaN(limitNum) || pageNum <= 0 || limitNum <= 0) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }
        if (!["asc", "desc"].includes(order)) {
            return res.status(400).json({ error: "Invalid order parameter" });
        }
        const hasSortBy = Boolean(sortBy);
        if (hasSortBy && !["createdAt", "bestSelling"].includes(sortBy)) {
            return res.status(400).json({ error: "Invalid sortBy parameter" });
        }

        const normalizedSort = String(sort || "");
        let resolvedSortBy = String(sortBy || "createdAt");
        let resolvedOrder = String(order || "desc");

        // Support generic-style sorting (sort=-createdAt / sort=-sold)
        if (normalizedSort) {
            if (normalizedSort === "sold" || normalizedSort === "-sold") {
                resolvedSortBy = "bestSelling";
                resolvedOrder = normalizedSort.startsWith("-") ? "desc" : "asc";
            } else if (normalizedSort === "createdAt" || normalizedSort === "-createdAt") {
                resolvedSortBy = "createdAt";
                resolvedOrder = normalizedSort.startsWith("-") ? "desc" : "asc";
            }
        }

        const sortDirection = resolvedOrder === "desc" ? -1 : 1;
        const skip = (pageNum - 1) * limitNum;

        const query = {};
        const categoryParam = category || category_id;
        if (categoryParam) {
            const ids = String(categoryParam).split(',').map(s => s.trim()).filter(Boolean);
            query.category_id = ids.length === 1 ? ids[0] : { $in: ids };
        }
        const collectionParam = collection || collection_id;
        if (collectionParam) query.collection_id = collectionParam;

        const sortOptions =
            resolvedSortBy === "bestSelling"
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
