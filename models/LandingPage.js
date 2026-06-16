// models/LandingPage.js

const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema(
  {
    title: String,
    image: String,
    description: String,
  },
  { _id: true },
);

const policySectionSchema = new mongoose.Schema(
  {
    heading: String,
    content: String,
  },
  { timestamps: true },
);

const landingPageSchema = new mongoose.Schema(
  {
    // ================= HOME =================

    home: {
      banner: {
        title: String,
        description: String,
      },

      services: [sectionSchema],

      testimonials: [
        {
          name: String,
          position: String,
          content: String,
          image: String,
        },
      ],
    },

    // ================= ABOUT =================

    about: {
      about: {
        image: String,
        title: String,
        description: String,
        subdescription: String,
      },

      mission: {
        description: String,
      },

      vision: {
        description: String,
      },
    },

    // ================= GALLERY =================

    gallery: {
      gallery: [
        {
          image: String,
          alt: String,
        },
      ],
    },

    // ================= DOCUMENTS =================

    documents: {
      thumbnail: [
        {
          image: String,
        },
      ],

      pdf: [
        {
          file: String,
          fileName: String,
        },
      ],
    },

    // ================= CONTACT =================

    contact: {
      address: [
        {
          title: String,
          content: String,
          phone: String,
        },
      ],
    },

    // ================= FOOTER =================

    footer: {
      contact: [
        {
          title: String,
          content: String,
        },
      ],

      socialmedia: [
        {
          title: String,
          content: String,
        },
      ],
    },

    // ================= META =================

    meta: {
      home: {
        title: String,
        description: String,
        keywords: String,
        canonical: String,
      },

      about: {
        title: String,
        description: String,
        keywords: String,
        canonical: String,
      },

      gallery: {
        title: String,
        description: String,
        keywords: String,
        canonical: String,
      },

      documents: {
        title: String,
        description: String,
        keywords: String,
        canonical: String,
      },

      contact: {
        title: String,
        description: String,
        keywords: String,
        canonical: String,
      },
    },

    // ================= POLICIES =================

    policies: {
      privacy: {
        title: String,
        lastUpdated: String,
        sections: [policySectionSchema],
      },

      termcondition: {
        title: String,
        lastUpdated: String,
        sections: [policySectionSchema],
      },

      cancellationrefund: {
        title: String,
        lastUpdated: String,
        sections: [policySectionSchema],
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("LandingPage", landingPageSchema);
