const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const isVercel = !!process.env.VERCEL;

const UPLOADS_DIR = path.join(__dirname, "../uploads/tickets");

// Lokalda qovluğu yarat
if (!isVercel) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uuid = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid}${ext}`);
  },
});

const ALLOWED_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

const fileFilter = (req, file, cb) => cb(null, true);

const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 5,
  },
});

module.exports = uploadMiddleware;
module.exports.ALLOWED_MIMES = ALLOWED_MIMES;
module.exports.ALLOWED_EXTS = ALLOWED_EXTS;
module.exports.UPLOADS_DIR = UPLOADS_DIR;
