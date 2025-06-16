const mongoose = require('mongoose');
const FlightSchema = new mongoose.Schema({
  flightNumber: String,
  from: String,
  to: String,
  date: String,
  time: String,
  route: String,
  class: String,
  price: String,
  seats: Number
});
module.exports = mongoose.model('Flight', FlightSchema);
