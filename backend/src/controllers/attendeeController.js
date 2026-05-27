const { Attendee, Event, Ticket, User } = require('../models');
const { getCache, setCache, delCache } = require('../config/cache');

// Get all tickets/attendees owned by the current user
const getUserTickets = async (req, res) => {
  try {
    const user_id = req.user.id;
    const attendees = await Attendee.findAll({
      where: { user_id },
      include: [
        { model: Event, attributes: ['title', 'event_date', 'venue'] },
        { model: Ticket, attributes: ['category'] }
      ]
    });

    res.json({ success: true, data: attendees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Validate QR Code (used by Gatekeeper) - Using Redis Cache for speed
const validateQR = async (req, res) => {
  try {
    const { qrCode } = req.params;
    
    // Check Cache
    const cacheKey = `qr_validation_${qrCode}`;
    const cachedAttendee = await getCache(cacheKey);

    if (cachedAttendee) {
      return res.json({ 
        success: true, 
        data: cachedAttendee, 
        source: 'cache' 
      });
    }

    // If not in cache, query DB
    const attendee = await Attendee.findOne({
      where: { qr_code: qrCode },
      include: [
        { model: Event, attributes: ['title', 'event_date'] },
        { model: Ticket, attributes: ['category'] },
        { model: User, attributes: ['full_name', 'email'] }
      ]
    });

    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Invalid QR Code' });
    }

    // Set cache for 5 minutes (to speed up subsequent scans if gate is crowded)
    await setCache(cacheKey, attendee, 300);

    res.json({ success: true, data: attendee, source: 'db' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Check in Attendee
const checkIn = async (req, res) => {
  try {
    const { qrCode } = req.params;

    const attendee = await Attendee.findOne({ where: { qr_code: qrCode } });

    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Invalid QR Code' });
    }

    if (attendee.check_in_status === 'checked_in') {
      return res.status(400).json({ success: false, message: 'Ticket already checked in' });
    }

    await attendee.update({ 
      check_in_status: 'checked_in',
      check_in_time: new Date()
    });

    // Invalidate Cache for this QR to reflect updated status
    await delCache(`qr_validation_${qrCode}`);

    res.json({ success: true, message: 'Check-in successful', data: attendee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getUserTickets,
  validateQR,
  checkIn
};
