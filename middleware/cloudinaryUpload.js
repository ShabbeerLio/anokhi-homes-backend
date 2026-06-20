const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../utils/cloudinary");

// ================= IMAGE =================
// Store image in memory first
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

// ================= PDF =================

const pdfStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "documents",
    resource_type: "image",
    format: "pdf",
    public_id: Date.now() + "-" + file.originalname,
  }),
});

const uploadPdf = multer({
  storage: pdfStorage,
});

module.exports = {
  uploadImage,
  uploadPdf,
};