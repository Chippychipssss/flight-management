const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ GET: All flights
app.get('/api/flights', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'flights.json');
  try {
    const flights = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
    res.json(flights);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read flights data.' });
  }
});

// ✅ POST: Add new flight
app.post('/api/flights', (req, res) => {
  const { flightNumber, from, to, date } = req.body;

  const newFlight = {
    id: Date.now(),
    flightNumber,
    from,
    to,
    date
  };

  const filePath = path.join(__dirname, 'data', 'flights.json');
  let flights = [];

  try {
    flights = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
  } catch (error) {
    return res.status(500).json({ error: 'Failed to read existing flights.' });
  }

  flights.push(newFlight);

  try {
    fs.writeFileSync(filePath, JSON.stringify(flights, null, 2));
    res.send(`✅ Flight ${flightNumber} added successfully!`);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save flight.' });
  }
});

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`✈️ Flight Management server running at http://localhost:${PORT}`);
});
