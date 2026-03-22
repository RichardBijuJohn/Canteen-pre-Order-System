const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/canteenDB')
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

// ✅ Test Route (VERY IMPORTANT)
app.get('/', (req, res) => {
  res.send("Server is running 🚀");
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/order'));
app.use('/api/admin', require('./routes/admin'));

// Server start
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});