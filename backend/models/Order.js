const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    orderCode: { type: String, unique: true, sparse: true, index: true },
    userId: String,
    items: Array,
    totalAmount: Number,
    paymentMode: { type: String, enum: ['Cash'], default: 'Cash' },
    pickupTime: String,
    status: { type: String, default: "Pending" },
    pickedAt: Date,
    review: {
        rating: Number,
        createdAt: Date
    }
});

module.exports = mongoose.model('Order', OrderSchema);