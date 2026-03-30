const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({ name, email, password: hashed });
    await user.save();

    res.json({ msg: "User Registered" });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ msg: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ msg: "Wrong password" });

    res.json({ msg: "Login Success", user });
});

router.post('/forgot-password', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email) {
        return res.status(400).json({ msg: 'Email is required.' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ msg: 'If this email exists, a reset token has been created.' });
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        return res.json({
            msg: 'Reset token generated. Use it within 15 minutes.',
            resetToken
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Unable to start password reset right now.' });
    }
});

router.post('/reset-password', async (req, res) => {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!token || !newPassword) {
        return res.status(400).json({ msg: 'Reset token and new password are required.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ msg: 'Password must be at least 6 characters.' });
    }

    try {
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ msg: 'Reset token is invalid or expired.' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        return res.json({ msg: 'Password reset successful. Please login.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Unable to reset password right now.' });
    }
});

module.exports = router;