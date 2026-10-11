const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, trim: true, maxlength: 50 },
  img: { type: String, default: '', trim: true },
  available: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
