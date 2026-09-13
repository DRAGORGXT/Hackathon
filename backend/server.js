/**
 * ClubPulse Backend Server (IIIT Jabalpur)
 * Node.js + Express REST API with JSON Database
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Data paths
const DATA_DIR = path.join(__dirname, 'data');
const CLUBS_FILE = path.join(DATA_DIR, 'clubs.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

// Middleware
app.use(cors());
app.use(express.json());

// In-memory active tokens mapping: token -> clubObj
const activeTokens = new Map();

// Helper: Read JSON file
function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return [];
  }
}

// Helper: Write JSON file
function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
    return false;
  }
}

// Helper: Authenticate token middleware
function requireClubAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Only verified IIIT Jabalpur clubs can perform this action.'
    });
  }

  const token = authHeader.split(' ')[1];
  const club = activeTokens.get(token);

  if (!club) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired session. Please log in again.'
    });
  }

  req.currentClub = club;
  next();
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

/**
 * POST /api/auth/login
 * Body: { username (club name), password }
 */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both Club Name and Password.'
    });
  }

  const clubs = readJson(CLUBS_FILE);
  const normalizedUser = username.trim().toLowerCase();

  // Find club by exact or normalized name
  const club = clubs.find(
    (c) => c.name.toLowerCase() === normalizedUser || c.id.toLowerCase() === normalizedUser
  );

  if (!club) {
    return res.status(404).json({
      success: false,
      message: `Club "${username}" is not recognized as an official IIIT Jabalpur club.`
    });
  }

  // Validate password (standardized to iiitdmj123)
  if (password !== club.password && password !== 'iiitdmj123') {
    return res.status(401).json({
      success: false,
      message: 'Incorrect club password. Hint: Default password is "iiitdmj123".'
    });
  }

  // Generate session token
  const token = `token_${club.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const clubSession = {
    id: club.id,
    name: club.name,
    category: club.category,
    icon: club.icon || '🏛️'
  };

  activeTokens.set(token, clubSession);

  return res.json({
    success: true,
    message: `Welcome back, ${club.name}!`,
    token: token,
    club: clubSession
  });
});

/**
 * GET /api/auth/verify
 * Header: Authorization: Bearer <token>
 */
app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, authenticated: false });
  }

  const token = authHeader.split(' ')[1];
  const club = activeTokens.get(token);

  if (!club) {
    return res.status(401).json({ success: false, authenticated: false });
  }

  return res.json({ success: true, authenticated: true, club: club });
});

/**
 * POST /api/auth/logout
 */
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeTokens.delete(token);
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// ==========================================
// CLUBS & VENUES DATA ROUTES
// ==========================================

/**
 * GET /api/clubs
 * List all 25 IIIT Jabalpur clubs
 */
app.get('/api/clubs', (req, res) => {
  const clubs = readJson(CLUBS_FILE);
  // Return public club details without password
  const publicClubs = clubs.map(({ id, name, category, icon }) => ({
    id,
    name,
    category,
    icon
  }));
  return res.json({ success: true, clubs: publicClubs });
});

// ==========================================
// EVENTS REST API ROUTES
// ==========================================

/**
 * GET /api/events
 * Fetch all upcoming campus sessions
 */
app.get('/api/events', (req, res) => {
  const events = readJson(EVENTS_FILE);
  return res.json({ success: true, events: events });
});

/**
 * POST /api/events
 * Protected: Only authenticated clubs can publish sessions
 */
app.post('/api/events', requireClubAuth, (req, res) => {
  const { title, speaker, dateTime, venue, capacity, regLink, description, category } = req.body;

  if (!title || !dateTime || !venue || !description) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields (title, date/time, venue, description).'
    });
  }

  const currentClub = req.currentClub;
  const events = readJson(EVENTS_FILE);

  const newEvent = {
    id: `evt-${currentClub.id}-${Date.now()}`,
    title: title.trim(),
    club: currentClub.name,
    category: category || currentClub.category,
    speaker: (speaker || '').trim(),
    dateTime: dateTime,
    venue: venue.trim(),
    capacity: parseInt(capacity, 10) || 0,
    regLink: (regLink || '').trim(),
    description: description.trim(),
    avatar: currentClub.icon || '🏛️',
    createdAt: new Date().toISOString()
  };

  events.unshift(newEvent);
  writeJson(EVENTS_FILE, events);

  return res.status(201).json({
    success: true,
    message: `Session "${newEvent.title}" published successfully for ${currentClub.name}!`,
    event: newEvent
  });
});

/**
 * DELETE /api/events/:id
 * Protected: Only the organizing club can delete its event
 */
app.delete('/api/events/:id', requireClubAuth, (req, res) => {
  const { id } = req.params;
  const currentClub = req.currentClub;
  const events = readJson(EVENTS_FILE);

  const eventIndex = events.findIndex((e) => e.id === id);
  if (eventIndex === -1) {
    return res.status(404).json({ success: false, message: 'Event not found.' });
  }

  const event = events[eventIndex];
  // Verify ownership
  if (event.club.toLowerCase() !== currentClub.name.toLowerCase()) {
    return res.status(403).json({
      success: false,
      message: `Unauthorized. Only ${event.club} can remove this session.`
    });
  }

  events.splice(eventIndex, 1);
  writeJson(EVENTS_FILE, events);

  return res.json({
    success: true,
    message: `Session "${event.title}" has been removed.`
  });
});

// ==========================================
// STATIC FRONTEND SERVING
// ==========================================
const frontendPath = path.join(__dirname, '../frontend');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🎓 ClubPulse Backend Running on http://localhost:${PORT}`);
  console.log(`🏛️  Serving IIIT Jabalpur Campus Events & Club Auth`);
  console.log(`==================================================\n`);
});
