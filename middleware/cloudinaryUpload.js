const multer = require("multer");

const { CloudinaryStorage } = require("multer-storage-cloudinary");

const cloudinary = require("../utils/cloudinary");

/* ================= IMAGE ================= */

const imageStorage = new CloudinaryStorage({
  cloudinary,

  params: async (req, file) => ({
    folder: "landing-images",

    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  }),
});

/* ================= PDF ================= */

const pdfStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "documents",
    resource_type: "image",
    format: "pdf",
    public_id: Date.now() + "-" + file.originalname,
  }),
});

const uploadImage = multer({
  storage: imageStorage,
});

const uploadPdf = multer({
  storage: pdfStorage,
});

module.exports = {
  uploadImage,
  uploadPdf,
};
