const express = require("express");
const router = express.Router();
const LandingPage = require("../models/LandingPage");
const { uploadImage, uploadPdf } = require("../middleware/cloudinaryUpload");
const cloudinary = require("../utils/cloudinary");
const sharp = require("sharp");
const streamifier = require("streamifier");

/* =================================
   GET LANDING PAGE
================================= */

router.get("/", async (req, res) => {
  try {
    let data = await LandingPage.findOne();

    if (!data) {
      data = await LandingPage.create({});
    }

    res.json(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   UPDATE FULL LANDING PAGE
================================= */

router.put("/update", async (req, res) => {
  try {
    let data = await LandingPage.findOne();

    if (!data) {
      data = await LandingPage.create(req.body);
    } else {
      data = await LandingPage.findByIdAndUpdate(data._id, req.body, {
        returnDocument: "after",
      });
    }

    res.json(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   UPDATE HOME
================================= */

router.put("/home", async (req, res) => {
  try {
    const data = await LandingPage.findOneAndUpdate(
      {},
      {
        $set: {
          home: req.body,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
      },
    );

    res.json(data.home);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   UPDATE ABOUT
================================= */

router.put("/about", async (req, res) => {
  try {
    const data = await LandingPage.findOneAndUpdate(
      {},
      {
        $set: {
          about: req.body,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
      },
    );

    res.json(data.about);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   UPDATE GALLERY
================================= */

router.put("/gallery", async (req, res) => {
  try {
    const data = await LandingPage.findOneAndUpdate(
      {},
      {
        $set: {
          gallery: req.body,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
      },
    );

    res.json(data.gallery);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   UPDATE DOCUMENTS
================================= */

router.put("/documents", async (req, res) => {
  try {
    const data = await LandingPage.findOneAndUpdate(
      {},
      {
        $set: {
          documents: req.body,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
      },
    );

    res.json(data.documents);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});
/* =================================
   UPLOAD PDF
================================= */

router.post(
  "/upload/pdf",
  uploadPdf.single("file"),

  async (req, res) => {
    try {
      res.json({
        file: req.file.path,
        fileName: req.file.originalname,
        public_id: req.file.filename,
      });
    } catch (error) {
      console.log(error);

      res.status(500).send("Server Error");
    }
  },
);

/* =================================
   UPDATE CONTACT
================================= */

router.put("/contact", async (req, res) => {
  try {
    const data = await LandingPage.findOneAndUpdate(
      {},
      {
        $set: {
          contact: req.body,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
      },
    );

    res.json(data.contact);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   UPDATE FOOTER
================================= */

router.put("/footer", async (req, res) => {
  try {
    const data = await LandingPage.findOneAndUpdate(
      {},
      {
        $set: {
          footer: req.body,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
      },
    );

    res.json(data.footer);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   UPDATE META
================================= */

router.put("/meta", async (req, res) => {
  try {
    const data = await LandingPage.findOneAndUpdate(
      {},
      {
        $set: {
          meta: req.body,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
      },
    );

    res.json(data.meta);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   UPDATE POLICIES
================================= */

router.put("/policies", async (req, res) => {
  try {
    const data = await LandingPage.findOneAndUpdate(
      {},
      {
        $set: {
          policies: req.body,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
      },
    );

    res.json(data.policies);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   DELETE HOME SERVICE
================================= */

router.delete("/home/service/:id", async (req, res) => {
  try {
    const data = await LandingPage.findOne();

    data.home.services = data.home.services.filter(
      (item) => item._id.toString() !== req.params.id,
    );

    await data.save();

    res.json({
      message: "Service deleted successfully",
      services: data.home.services,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   DELETE TESTIMONIAL
================================= */

router.delete("/home/testimonial/:id", async (req, res) => {
  try {
    const data = await LandingPage.findOne();

    data.home.testimonials = data.home.testimonials.filter(
      (item) => item._id.toString() !== req.params.id,
    );

    await data.save();

    res.json({
      message: "Testimonial deleted successfully",
      testimonials: data.home.testimonials,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   DELETE GALLERY IMAGE
================================= */

router.delete("/gallery/:id", async (req, res) => {
  try {
    const data = await LandingPage.findOne();

    data.gallery.gallery = data.gallery.gallery.filter(
      (item) => item._id.toString() !== req.params.id,
    );

    await data.save();

    res.json({
      message: "Gallery image deleted successfully",
      gallery: data.gallery.gallery,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   DELETE DOCUMENT THUMBNAIL
================================= */

router.delete("/documents/thumbnail/:id", async (req, res) => {
  try {
    const data = await LandingPage.findOne();

    data.documents.thumbnail = data.documents.thumbnail.filter(
      (item) => item._id.toString() !== req.params.id,
    );

    await data.save();

    res.json({
      message: "Thumbnail deleted successfully",
      thumbnail: data.documents.thumbnail,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   DELETE DOCUMENT PDF
================================= */

router.delete("/documents/pdf/:id", async (req, res) => {
  try {
    const data = await LandingPage.findOne();

    data.documents.pdf = data.documents.pdf.filter(
      (item) => item._id.toString() !== req.params.id,
    );

    await data.save();

    res.json({
      message: "PDF deleted successfully",
      pdf: data.documents.pdf,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   DELETE CONTACT ADDRESS
================================= */

router.delete("/contact/address/:id", async (req, res) => {
  try {
    const data = await LandingPage.findOne();

    data.contact.address = data.contact.address.filter(
      (item) => item._id.toString() !== req.params.id,
    );

    await data.save();

    res.json({
      message: "Address deleted successfully",
      address: data.contact.address,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   DELETE FOOTER CONTACT
================================= */

router.delete("/footer/contact/:id", async (req, res) => {
  try {
    const data = await LandingPage.findOne();

    data.footer.contact = data.footer.contact.filter(
      (item) => item._id.toString() !== req.params.id,
    );

    await data.save();

    res.json({
      message: "Footer contact deleted successfully",
      contact: data.footer.contact,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   DELETE SOCIAL MEDIA
================================= */

router.delete("/footer/socialmedia/:id", async (req, res) => {
  try {
    const data = await LandingPage.findOne();

    data.footer.socialmedia = data.footer.socialmedia.filter(
      (item) => item._id.toString() !== req.params.id,
    );

    await data.save();

    res.json({
      message: "Social media deleted successfully",
      socialmedia: data.footer.socialmedia,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   DELETE POLICY SECTION
================================= */

router.delete("/policies/:type/:sectionId", async (req, res) => {
  try {
    const { type, sectionId } = req.params;
    const data = await LandingPage.findOne();
    if (!data.policies[type]) {
      return res.status(404).json({
        message: "Policy type not found",
      });
    }

    data.policies[type].sections = data.policies[type].sections.filter(
      (item) => item._id.toString() !== sectionId,
    );
    await data.save();
    res.json({
      message: "Policy section deleted successfully",
      sections: data.policies[type].sections,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =================================
   UPLOAD IMAGE
================================= */
router.post("/upload/image", uploadImage.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No image uploaded",
      });
    }

    let quality = 85;
    let compressedBuffer;

    // Compress until under 700KB
    do {
      compressedBuffer = await sharp(req.file.buffer)
        .rotate()
        .resize({
          width: 1920,
          withoutEnlargement: true,
        })
        .jpeg({
          quality,
          mozjpeg: true,
        })
        .toBuffer();

      quality -= 5;
    } while (compressedBuffer.length > 700 * 1024 && quality >= 30);

    console.log(
      "Final Size:",
      (compressedBuffer.length / 1024).toFixed(2),
      "KB",
    );

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "landing-images",
          resource_type: "image",
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      streamifier.createReadStream(compressedBuffer).pipe(uploadStream);
    });

    res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      size: `${(compressedBuffer.length / 1024).toFixed(2)} KB`,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});
module.exports = router;
