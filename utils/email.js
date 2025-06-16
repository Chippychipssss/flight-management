// utils/email.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: '2101551@students.kcau.ac.ke', // 👈 replace with your Gmail
    pass: 'hdho dfio bwpe xajm'   // 👈 the app password you sent
  }
});

function sendConfirmationEmail(to, flightDetails) {
  const mailOptions = {
    from: 'AeroConnect <yourgmail@gmail.com>',
    to,
    subject: '✈️ Flight Booking Confirmation',
    text: `Dear ${to},\n\nYour flight booking is confirmed!\n\nFlight: ${flightDetails.flightNumber}\nDate: ${flightDetails.date}\nSeat: ${flightDetails.seatNumber || 'Not assigned'}\n\nThank you for choosing AeroConnect!\n\n`
  };

  return transporter.sendMail(mailOptions);
}

module.exports = sendConfirmationEmail;
