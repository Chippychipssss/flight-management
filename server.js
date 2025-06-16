const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const sendConfirmationEmail = require('./utils/email'); // ✅ Email utility

const app = express();
const PORT = 3000;

// ✅ MongoDB connection
mongoose.connect('mongodb://localhost:27017/aeroconnect').then(() => {
  console.log("✅ MongoDB connected locally.");
}).catch(err => {
  console.error("❌ MongoDB connection failed:", err);
});

// ✅ Import Mongoose models
const User = require('./models/User');
const Flight = require('./models/Flight');
const Booking = require('./models/Booking');

// ✅ Middleware
app.use(session({
  secret: 'flight-secret',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static('public'));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Protect route middleware
const protect = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login.html');
  next();
};

// ✅ Static HTML Routes
app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/dashboard.html', protect, (_, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/add-flight.html', protect, (_, res) => res.sendFile(path.join(__dirname, 'public', 'add-flight.html')));
app.get('/view-bookings.html', protect, (_, res) => res.sendFile(path.join(__dirname, 'public', 'view-bookings.html')));

// ✅ Signup
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  const role = 'user';
  const exists = await User.findOne({ username });
  if (exists) return res.send("🚫 Username already exists.");
  await User.create({ username, password, role });
  req.session.user = { username, role };
  res.redirect('/dashboard.html');
});

// ✅ Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.send("❌ Invalid login.");
  req.session.user = { username, role: user.role };
  res.redirect('/dashboard.html');
});

// ✅ Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login.html'));
});

// ✅ Current user session
app.get('/api/me', (req, res) => res.json(req.session.user || {}));
app.get('/api/current-user', (req, res) => res.json(req.session.user || {}));

// ✅ Get all flights with booking count
app.get('/api/flights', async (req, res) => {
  const flights = await Flight.find();
  const bookings = await Booking.find();

  const enriched = flights.map(flight => {
    const matching = bookings.filter(b => b.flightNumber === flight.flightNumber && b.date === flight.date);
    return { ...flight._doc, bookings: matching };
  });

  res.json(enriched);
});

// ✅ Add new flight
app.post('/api/flights', async (req, res) => {
  const { flightNumber, from, to, date, route, class: travelClass, price, seats } = req.body;
  const [datePart, timePart] = date.split('T');
  await Flight.create({
    flightNumber,
    from,
    to,
    date: datePart,
    time: timePart,
    route,
    class: travelClass,
    price,
    seats: parseInt(seats)
  });
  res.send(`✅ Flight ${flightNumber} added.`);
});

// ✅ Book a flight
app.post('/api/bookings', async (req, res) => {
  const { flightNumber, passengerName, date } = req.body;
  const user = req.session.user;
  if (!user) return res.status(403).send("⛔ Please log in to book.");

  const flight = await Flight.findOne({ flightNumber, date });
  if (!flight) return res.status(404).send("❌ Flight not found.");

  const already = await Booking.findOne({ flightNumber, date, passengerName });
  if (already) return res.status(400).send("🚫 You’ve already booked this flight.");

  const bookings = await Booking.find({ flightNumber, date });
  if (bookings.length >= flight.seats) {
    return res.status(400).send("🚫 No seats available for this flight.");
  }

  const seatNumber = bookings.length + 1;
  await Booking.create({ passengerName, flightNumber, date, seatNumber });

  // ✅ Email confirmation (if username is an email)
  if (user.username.includes('@')) {
    try {
      await sendConfirmationEmail(user.username, {
        flightNumber,
        date,
        seatNumber
      });
      console.log(`📧 Confirmation email sent to ${user.username}`);
    } catch (err) {
      console.error("❌ Email send failed:", err);
    }
  }

  res.send(`✅ Booking confirmed. Seat ${seatNumber} assigned.`);
});

// ✅ View all bookings
app.get('/api/bookings', async (_, res) => {
  const bookings = await Booking.find();
  res.json(bookings);
});

// ✅ View my bookings
app.get('/api/my-bookings', async (req, res) => {
  const username = req.session.user?.username;
  if (!username) return res.status(403).json({ error: 'Not logged in' });
  const myBookings = await Booking.find({ passengerName: username });
  res.json(myBookings);
});

// ✅ Cancel booking
app.delete('/api/my-bookings/:id', async (req, res) => {
  const { id } = req.params;
  const username = req.session.user?.username;
  console.log("📦 Deleting booking ID:", id);

  if (!id || id.length !== 24) {
    return res.status(400).send("❌ Invalid booking ID.");
  }

  try {
    const booking = await Booking.findById(id);
    if (!booking || booking.passengerName !== username) {
      return res.status(403).send('⛔ Not allowed to delete this booking.');
    }
    await Booking.findByIdAndDelete(id);
    res.send('✅ Booking cancelled.');
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Failed to delete booking.");
  }
});

// ✅ Delete flight
app.delete('/api/flights/:id', async (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== 'admin') return res.status(403).send("🚫 Not authorized");
  await Flight.findByIdAndDelete(req.params.id);
  res.send("✅ Flight deleted.");
});

// ✅ Update flight
app.put('/api/flights/:id', async (req, res) => {
  const flightId = req.params.id;
  const updated = req.body;
  try {
    await Flight.findByIdAndUpdate(flightId, updated);
    res.send("✅ Flight updated.");
  } catch (err) {
    res.status(500).send("❌ Error updating flight.");
  }
});

// ✅ Dashboard session info
app.get('/dashboard-data', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ username: req.session.user.username, role: req.session.user.role });
});

// ✅ Update Account Info
app.post('/api/edit-account', async (req, res) => {
  const { newUsername, newPassword } = req.body;
  const currentUser = req.session.user;

  if (!currentUser) return res.status(401).send("⛔ Not logged in");

  const updates = {};

  // ✅ Allow password-only change
  if (newUsername && newUsername !== currentUser.username) {
    const exists = await User.findOne({ username: newUsername });
    if (exists) return res.send("🚫 Username already taken.");
    updates.username = newUsername;
  }

  if (newPassword) {
    updates.password = newPassword;
  }

  if (Object.keys(updates).length === 0) {
    return res.send("⚠️ No changes submitted.");
  }

  const updated = await User.findOneAndUpdate(
    { username: currentUser.username },
    { $set: updates },
    { new: true }
  );

  // ✅ Update session if username changed
  req.session.user = {
    username: updated.username,
    role: updated.role
  };

  res.send("✅ Account updated.");
});



app.listen(PORT, () => {
  console.log(`✈️ Flight Management server running at http://localhost:${PORT}`);
});
