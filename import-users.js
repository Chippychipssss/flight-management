// import-users.js
const mongoose = require('mongoose');
const fs = require('fs');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/aeroconnect', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log("✅ Connected to MongoDB");

  const data = JSON.parse(fs.readFileSync('./data/users.json', 'utf8'));

  // Add default role if missing
  const cleaned = data.map(u => ({
    username: u.username,
    password: u.password,
    role: u.role || 'user'
  }));

  await User.insertMany(cleaned);
  console.log(`✅ ${cleaned.length} users inserted!`);
  mongoose.disconnect();
}).catch(err => {
  console.error("❌ MongoDB connection error:", err);
});
