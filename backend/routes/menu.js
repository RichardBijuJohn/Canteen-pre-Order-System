const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');

// GET menu
router.get('/', async (req, res) => {
    const items = await MenuItem.find();
    res.json(items);
});

// ADD menu item
router.post('/bulk', async (req, res) => {
  await MenuItem.insertMany(req.body);
  res.json({ msg: "Multiple items added" });
});

module.exports = router;