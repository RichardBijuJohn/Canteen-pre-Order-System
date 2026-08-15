const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const app = express();
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
const frontendIndexPath = path.join(frontendBuildPath, 'index.html');

const hasFrontendBuild = fs.existsSync(frontendIndexPath);

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/canteenDB')
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

if (hasFrontendBuild) {
  app.use(express.static(frontendBuildPath));
}

// ✅ Test Route (VERY IMPORTANT)
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/order'));
app.use('/api/admin', require('./routes/admin'));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ msg: 'API route not found' });
  }

  if (req.method === 'GET' && hasFrontendBuild) {
    return res.sendFile(frontendIndexPath);
  }

  next();
});

app.use((req, res) => {
  res.status(404).json({ msg: 'Route not found' });
});

// Server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});