const crypto = require("crypto");
const mongoose = require("mongoose");
const Profile = require("../models/Profile");

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

async function changePassword(req, res, next) {
  try {
    const { id } = req.params;
    const oldPassword = String(req.body?.old_password || "").trim();
    const newPassword = String(req.body?.new_password || "").trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID tài khoản không hợp lệ." });
    }

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Vui lòng nhập đủ mật khẩu cũ và mật khẩu mới." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự." });
    }

    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }

    const oldHash = hashValue(oldPassword);
    if (oldHash !== String(profile.password_hash || "")) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng." });
    }

    const nextHash = hashValue(newPassword);
    if (nextHash === String(profile.password_hash || "")) {
      return res.status(400).json({ message: "Mật khẩu mới phải khác mật khẩu hiện tại." });
    }

    profile.password_hash = nextHash;
    await profile.save();

    return res.status(200).json({ message: "Đổi mật khẩu thành công." });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  changePassword,
};
