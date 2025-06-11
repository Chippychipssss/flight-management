const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const PORT = 3000;

// 🔐 Session setup
app.use(session({
  secret: 'flight-secret',
  resave: false,
  saveUninitialized: true
}));

// 🛠 Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 🏠 Redirect "/" to login.html
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// 🔒 Middleware to protect pages
const protect = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login.html');
  next();
};

// 🔒 Protect sensitive HTML pages
app.get('/dashboard.html', protect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/add-flight.html', protect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'add-flight.html')));
app.get('/view-bookings.html', protect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'view-bookings.html')));

// ✅ POST: Signup (locked to user only)
app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  const role = "user"; // 🚫 force role to user no matter what

  const userFile = path.join(__dirname, 'data', 'users.json');
  const users = JSON.parse(fs.readFileSync(userFile, 'utf8') || '[]');

  if (users.find(u => u.username === username)) {
    return res.send("🚫 Username already exists.");
  }

  users.push({ username, password, role });
  fs.writeFileSync(userFile, JSON.stringify(users, null, 2));

  req.session.user = { username, role };
  res.redirect('/dashboard.html');
});

// ✅ Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const userFile = path.join(__dirname, 'data', 'users.json');
  const users = JSON.parse(fs.readFileSync(userFile, 'utf8') || '[]');

  const validUser = users.find(u => u.username === username && u.password === password);
  if (!validUser) {
    return res.send("❌ Invalid login.");
  }

  req.session.user = { username, role: validUser.role }; // Save role
  res.redirect('/dashboard.html');
});

// 🔓 Logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    res.redirect('/login.html');
  });
});

// 🧠 Session info API
app.get('/session-info', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ username: req.session.user, role: req.session.role });
  } else {
    res.status(401).json({ error: 'Not logged in' });
  }
});

// ✅ Get all flights
app.get('/api/flights', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'flights.json');
  try {
    const flights = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
    res.json(flights);
  } catch {
    res.status(500).json({ error: 'Failed to load flights.' });
  }
});

// ✅ Add new flight (includes time)
app.post('/api/flights', (req, res) => {
  const { flightNumber, from, to, date, time } = req.body;
  const newFlight = { id: Date.now(), flightNumber, from, to, date, time };

  const filePath = path.join(__dirname, 'data', 'flights.json');
  const flights = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
  flights.push(newFlight);
  fs.writeFileSync(filePath, JSON.stringify(flights, null, 2));
  res.send(`✅ Flight ${flightNumber} added!`);
});

// ✅ Bookings - GET
app.get('/api/bookings', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'bookings.json');
  try {
    const bookings = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
    res.json(bookings);
  } catch {
    res.status(500).json({ error: 'Failed to read bookings.' });
  }
});

// ✅ Bookings - POST
app.post('/api/bookings', (req, res) => {
  const { flightNumber, passengerName } = req.body;

  const newBooking = {
    id: Date.now(),
    passengerName: passengerName || req.session.user?.username,
    flightNumber,
    date: new Date().toISOString().split('T')[0]
  };

  const filePath = path.join(__dirname, 'data', 'bookings.json');
  const bookings = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
  bookings.push(newBooking);
  fs.writeFileSync(filePath, JSON.stringify(bookings, null, 2));
  res.send(`✅ Booking for ${passengerName} successful!`);
});

// ✅ View current user's bookings
app.get('/api/my-bookings', (req, res) => {
  const username = req.session.user?.username;
  if (!username) return res.status(403).json({ error: 'Not logged in' });

  const filePath = path.join(__dirname, 'data', 'bookings.json');
  const bookings = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');

  const userBookings = bookings.filter(b => b.passengerName === username);
  res.json(userBookings);
});

// ✅ DELETE: Cancel booking (only if it belongs to logged-in user)
app.delete('/api/my-bookings/:id', (req, res) => {
  const username = req.session.user?.username;
  if (!username) return res.status(403).send('Not logged in');

  const bookingId = parseInt(req.params.id);
  const filePath = path.join(__dirname, 'data', 'bookings.json');
  const bookings = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');

  const booking = bookings.find(b => b.id === bookingId);
  if (!booking || booking.passengerName !== username) {
    return res.status(403).send('⛔ Not allowed to delete this booking.');
  }

  const updated = bookings.filter(b => b.id !== bookingId);
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
  res.send('✅ Booking cancelled.');
});

app.get('/dashboard-data', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ username: req.session.user.username, role: req.session.user.role });
});

// ✅ DELETE a flight (admin only)
app.delete('/api/flights/:id', (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== 'admin') {
    return res.status(403).send("🚫 Not authorized");
  }

  const filePath = path.join(__dirname, 'data', 'flights.json');
  const flights = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
  const updatedFlights = flights.filter(f => f.id !== parseInt(req.params.id));
  fs.writeFileSync(filePath, JSON.stringify(updatedFlights, null, 2));
  res.send("✅ Flight deleted.");
});

// ✅ Update (Edit) flight
app.put('/api/flights/:id', (req, res) => {
  const flightId = parseInt(req.params.id);
  const filePath = path.join(__dirname, 'data', 'flights.json');
  try {
    let flights = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
    const index = flights.findIndex(f => f.id === flightId);
    if (index === -1) return res.status(404).send("Flight not found.");

    flights[index] = { ...flights[index], ...req.body };
    fs.writeFileSync(filePath, JSON.stringify(flights, null, 2));
    res.send("✅ Flight updated successfully.");
  } catch (err) {
    res.status(500).send("❌ Error updating flight.");
  }
});

// ✅ Who is logged in?
app.get('/api/current-user', (req, res) => {
  if (!req.session.user) return res.json({});
  res.json(req.session.user);
});

app.get('/api/me', (req, res) => {
  res.json(req.session.user || {});
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✈️ Flight Management server running at http://localhost:${PORT}`);
});
