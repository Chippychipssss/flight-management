// import-flights.js
const mongoose = require('mongoose');
const fs = require('fs');
const Flight = require('./models/Flight');

mongoose.connect('mongodb://localhost:27017/aeroconnect', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log("✅ Connected to MongoDB");

  const data = JSON.parse(fs.readFileSync('./data/flights.json', 'utf8'));

  const cleaned = data.map(f => ({
    flightNumber: f.flightNumber,
    from: f.from,
    to: f.to,
    date: f.date,
    time: f.time || '',
    route: f.route || '',
    class: f.class || '',
    price: f.price || '',
    seats: parseInt(f.seats) || 0
  }));

  await Flight.insertMany(cleaned);
  console.log(`✅ ${cleaned.length} flights inserted!`);
  mongoose.disconnect();
}).catch(err => {
  console.error("❌ MongoDB connection error:", err);
});
