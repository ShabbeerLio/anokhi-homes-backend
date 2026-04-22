// models/HomePage.js

const mongoose = require("mongoose");

const homePageSchema = new mongoose.Schema({

  banner: {
    title: String,
    description: String,
  },

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

  services: [
    {
      title: String,
      image: String,
    }
  ],

  testimonials: [
    {
      name: String,
      position: String,
      image: String,
      content: String,
    }
  ],

  gallery: [
    {
      image: String,
      alt: String,
    }
  ],

  thumbnails: [
    {
      image: String,
    }
  ],

  pdfs: [
    {
      image: String, // or file URL
    }
  ],

  contact: [
    {
      title: String,
      content: String,
    }
  ],

  socialMedia: [
    {
      title: String,
      content: String,
    }
  ],

  address: [
    {
      title: String,
      content: String,
      phone: String,
    }
  ],

}, { timestamps: true });

module.exports = mongoose.model("HomePage", homePageSchema);