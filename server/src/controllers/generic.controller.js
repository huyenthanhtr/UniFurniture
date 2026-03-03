const mongoose = require("mongoose");

function buildListHandler(Model) {
  return async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page || "1", 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 200);
      const skip = (page - 1) * limit;

      const filter = {};
      for (const [k, v] of Object.entries(req.query)) {
        if (["page", "limit", "sort"].includes(k)) continue;
        filter[k] = v;
      }

      const sort = {};
      if (req.query.sort) {
        const s = String(req.query.sort);
        if (s.startsWith("-")) sort[s.slice(1)] = -1;
        else sort[s] = 1;
      } else {
        sort.createdAt = -1;
      }

      const [items, total] = await Promise.all([
        Model.find(filter).sort(sort).skip(skip).limit(limit),
        Model.countDocuments(filter),
      ]);

      return res.json({
        page,
        limit,
        total,
        items,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  };
}

function buildGetByIdHandler(Model) {
  return async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const doc = await Model.findById(id);
      if (!doc) return res.status(404).json({ message: "Not found" });
      return res.json(doc);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  };
}

module.exports = { buildListHandler, buildGetByIdHandler };