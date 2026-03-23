const mongoose = require("mongoose");

function buildListHandler(Model) {
  return async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page || "1", 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 200);
      const skip = (page - 1) * limit;

      const filter = {};
      for (const [k, v] of Object.entries(req.query)) {
        if (["page", "limit", "sort", "fields", "exclude"].includes(k)) continue;
        filter[k] = v;
      }

      let projection = undefined;
      if (req.query.fields) {
        const fields = String(req.query.fields)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (fields.length) projection = fields.join(" ");
      } else if (req.query.exclude) {
        const exclude = String(req.query.exclude)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((f) => `-${f}`);
        if (exclude.length) projection = exclude.join(" ");
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
        Model.find(filter).select(projection).sort(sort).skip(skip).limit(limit),
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

function buildCreateHandler(Model) {
  return async (req, res) => {
    try {
      const doc = await Model.create(req.body);
      return res.status(201).json(doc);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ message: "Create failed" });
    }
  };
}

function buildUpdateHandler(Model) {
  return async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const doc = await Model.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: false,
      });
      if (!doc) return res.status(404).json({ message: "Not found" });
      return res.json(doc);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ message: "Update failed" });
    }
  };
}

function buildPatchHandler(Model) {
  return async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const doc = await Model.findByIdAndUpdate(id, { $set: req.body }, { new: true });
      if (!doc) return res.status(404).json({ message: "Not found" });
      return res.json(doc);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ message: "Patch failed" });
    }
  };
}

function buildDeleteHandler(Model) {
  return async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const doc = await Model.findByIdAndDelete(id);
      if (!doc) return res.status(404).json({ message: "Not found" });
      return res.json({ success: true, deleted: doc });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Delete failed" });
    }
  };
}

module.exports = {
  buildListHandler,
  buildGetByIdHandler,
  buildCreateHandler,
  buildUpdateHandler,
  buildPatchHandler,
  buildDeleteHandler,
};