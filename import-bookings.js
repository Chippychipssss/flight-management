// import-bookings.js
const mongoose = require('mongoose');
const fs = require('fs');

const Booking = require('./models/Booking');

mongoose.connect('mongodb://localhost:27017/aeroconnect', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log("✅ Connected to MongoDB");

  const data = JSON.parse(fs.readFileSync('./data/bookings.json', 'utf8'));

  // Clean up data if needed
  const cleaned = data.map(b => ({
    passengerName: typeof b.passengerName === 'string' ? b.passengerName : b.passengerName.username || 'Unknown',
    flightNumber: b.flightNumber,
    date: b.date
  }));

  await Booking.insertMany(cleaned);
  console.log(`✅ ${cleaned.length} bookings inserted!`);
  mongoose.disconnect();
}).catch(err => {
  console.error("❌ MongoDB connection error:", err);
});
