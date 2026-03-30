const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    role: { type: String, default: "user" }
});

module.exports = mongoose.model('User', UserSchema);