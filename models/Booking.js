const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  passengerName: String,
  flightNumber: String,
  date: String,
  seatNumber: String  // 👈 Add this field
});

module.exports = mongoose.model('Booking', BookingSchema);
