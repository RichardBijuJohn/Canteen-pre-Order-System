const mongoose = require('mongoose');

const MenuSchema = new mongoose.Schema({
    name: String,
    price: Number,
    category: String,
    available: Boolean,
    rating: Number,
    preparationTime: String
});

module.exports = mongoose.model('MenuItem', MenuSchema);