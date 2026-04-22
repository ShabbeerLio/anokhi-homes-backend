// models/MetaData.js

const mongoose = require("mongoose");

const pageMetaSchema = new mongoose.Schema({
  title: String,
  description: String,
  keywords: String,
  canonical: String,
}, { _id: false });

const metaDataSchema = new mongoose.Schema({

  home: pageMetaSchema,
  about: pageMetaSchema,
  gallery: pageMetaSchema,
  documents: pageMetaSchema,
  contact: pageMetaSchema,

}, { timestamps: true });

module.exports = mongoose.model("MetaData", metaDataSchema);