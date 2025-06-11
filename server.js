const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const PORT = 3000;

app.use(session({
  secret: 'flight-secret',
  resave: false,
  saveUninitialized: true
}));

app.use(express.static('public'));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

const protect = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login.html');
  next();
};

app.get('/dashboard.html', protect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/add-flight.html', protect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'add-flight.html')));
app.get('/view-bookings.html', protect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'view-bookings.html')));

// ✅ Signup
app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  const role = "user";
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
  if (!validUser) return res.send("❌ Invalid login.");

  req.session.user = { username, role: validUser.role };
  res.redirect('/dashboard.html');
});

// ✅ Logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    res.redirect('/login.html');
  });
});

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

// ✅ Add new flight with seats
app.post('/api/flights', (req, res) => {
  const { flightNumber, from, to, date, route, class: travelClass, price, seats } = req.body;

  const [datePart, timePart] = date.split('T');
  const newFlight = {
    id: Date.now(),
    flightNumber,
    from,
    to,
    route,
    class: travelClass,
    price,
    seats: parseInt(seats),
    date: datePart,
    time: timePart
  };

  const filePath = path.join(__dirname, 'data', 'flights.json');
  const flights = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
  flights.push(newFlight);
  fs.writeFileSync(filePath, JSON.stringify(flights, null, 2));

  res.send(`✅ Flight ${flightNumber} added with class ${travelClass} and price ${price}!`);
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

// ✅ Bookings - POST with double-booking prevention
app.post('/api/bookings', (req, res) => {
  const { flightNumber, passengerName, date } = req.body;
  const user = req.session.user;

  if (!user) return res.status(403).send("⛔ Please log in to book.");

  const flightFile = path.join(__dirname, 'data', 'flights.json');
  const bookingFile = path.join(__dirname, 'data', 'bookings.json');

  let flights = JSON.parse(fs.readFileSync(flightFile, 'utf8') || '[]');
  let bookings = JSON.parse(fs.readFileSync(bookingFile, 'utf8') || '[]');

  // ✅ Find flight by number AND date
  const flight = flights.find(f => f.flightNumber === flightNumber && f.date === date);
  if (!flight) return res.status(404).send("❌ Flight not found.");

  // ✅ Check if user already booked this flight
  const alreadyBooked = bookings.find(
    b => b.flightNumber === flightNumber &&
         b.date === date &&
         b.passengerName === (passengerName || user.username)
  );
  if (alreadyBooked) return res.status(400).send("🚫 You’ve already booked this flight.");

  // ✅ Check seat availability
  const bookedCount = bookings.filter(
    b => b.flightNumber === flightNumber && b.date === date
  ).length;

  if (bookedCount >= flight.seats) {
    return res.status(400).send("🚫 No seats available for this flight.");
  }

  const newBooking = {
    id: Date.now(),
    passengerName: passengerName || user.username,
    flightNumber,
    date
  };

  bookings.push(newBooking);
  fs.writeFileSync(bookingFile, JSON.stringify(bookings, null, 2));

  res.send(`✅ Booking confirmed. ${flight.seats - bookedCount - 1} seat(s) remaining.`);
});

// ✅ My bookings
app.get('/api/my-bookings', (req, res) => {
  const username = req.session.user?.username;
  if (!username) return res.status(403).json({ error: 'Not logged in' });

  const filePath = path.join(__dirname, 'data', 'bookings.json');
  const bookings = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');

  const userBookings = bookings.filter(b => b.passengerName === username);
  res.json(userBookings);
});

// ✅ Cancel booking
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

// ✅ Dashboard info
app.get('/dashboard-data', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ username: req.session.user.username, role: req.session.user.role });
});

// ✅ Delete flight
app.delete('/api/flights/:id', (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== 'admin') return res.status(403).send("🚫 Not authorized");

  const filePath = path.join(__dirname, 'data', 'flights.json');
  const flights = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
  const updatedFlights = flights.filter(f => f.id !== parseInt(req.params.id));
  fs.writeFileSync(filePath, JSON.stringify(updatedFlights, null, 2));
  res.send("✅ Flight deleted.");
});

// ✅ Update flight
app.put('/api/flights/:id', (req, res) => {
  const flightId = parseInt(req.params.id);
  const filePath = path.join(__dirname, 'data', 'flights.json');
  try {
    let flights = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
    const index = flights.findIndex(f => f.id === flightId);
    if (index === -1) return res.status(404).send("Flight not found.");

    const updatedFlight = {
      ...flights[index],
      flightNumber: req.body.flightNumber,
      from: req.body.from,
      to: req.body.to,
      date: req.body.date,
      time: req.body.time,
      route: req.body.route || flights[index].route,
      class: req.body.class || flights[index].class,
      price: req.body.price || flights[index].price,
      seats: req.body.seats ? parseInt(req.body.seats) : flights[index].seats
    };

    flights[index] = updatedFlight;
    fs.writeFileSync(filePath, JSON.stringify(flights, null, 2));
    res.send("✅ Flight updated successfully.");
  } catch (err) {
    res.status(500).send("❌ Error updating flight.");
  }
});

app.get('/api/current-user', (req, res) => {
  if (!req.session.user) return res.json({});
  res.json(req.session.user);
});

app.get('/api/me', (req, res) => {
  res.json(req.session.user || {});
});

app.listen(PORT, () => {
  console.log(`✈️ Flight Management server running at http://localhost:${PORT}`);
});
