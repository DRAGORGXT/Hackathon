/**
 * ClubPulse Frontend Client | IIIT Jabalpur
 * Connects to Node.js / Express REST API Backend with Club Auth
 * Zero External Dependencies (Vanilla ES6)
 */

(function () {
  'use strict';

  // --- API CONFIGURATION ---
  // If hosted on Express (same port), use relative path; otherwise default to localhost:5000
  const API_BASE = window.location.origin.includes(':5000')
    ? '/api'
    : 'http://localhost:5000/api';

  // Storage Keys
  const STORAGE_KEY_AUTH_TOKEN = 'clubpulse_auth_token';
  const STORAGE_KEY_AUTH_CLUB = 'clubpulse_auth_club';
  const STORAGE_KEY_REMINDERS = 'clubpulse_reminders';
  const STORAGE_KEY_NOTIFS = 'clubpulse_notif_logs';
  const STORAGE_KEY_OFFLINE_EVENTS = 'clubpulse_offline_events';

  // --- FALLBACK SEED EVENTS (Ensures demo works even if backend is offline) ---
  function getLocalFallbackEvents() {
    const now = new Date();
    const addHours = (h) => new Date(now.getTime() + h * 60 * 60 * 1000).toISOString();
    const futureDate = (dayOffset, hour, minute) => {
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(hour, minute, 0, 0);
      return d.toISOString();
    };

    return [
      {
        id: 'evt-iiitj-tpc',
        title: 'CodeRumble 2026: Inter-Batch DSA & Competitive Programming Sprint',
        club: 'The Programming Club',
        category: 'Technical',
        speaker: 'TPC Core Coordinators',
        venue: 'Computer Center (CC-1)',
        dateTime: addHours(2.5),
        capacity: 120,
        regLink: 'https://hackerrank.com/coderumble-iiitj',
        description: 'Test your problem-solving skills across 5 algorithmic challenges covering Graphs, DP, and Trees. Top freshers receive direct interview waivers for the club council!',
        avatar: '💻'
      },
      {
        id: 'evt-iiitj-ers',
        title: 'Autonomous Line-Follower & ROS2 Sensor Fusion Bootcamp',
        club: 'Electronics and Robotics Society',
        category: 'Technical',
        speaker: 'ERS Mechatronics Team',
        venue: 'Central Workshop & Mechatronics Lab',
        dateTime: addHours(5),
        capacity: 70,
        regLink: '',
        description: 'Hands-on hardware session: Interfacing ultrasonic and IR sensor arrays with ESP32 microcontrollers, PID tuning, and ROS2 simulation.',
        avatar: '🤖'
      },
      {
        id: 'evt-iiitj-jazbaat',
        title: 'Jazbaat Annual Nukkad Natak (Street Play) & Stage Auditions',
        club: 'Jazbaat',
        category: 'Cultural',
        speaker: 'Jazbaat Directorial Team',
        venue: 'Open Air Theatre (OAT)',
        dateTime: futureDate(1, 17, 0),
        capacity: 200,
        regLink: '',
        description: 'Calling all voice modulators, scriptwriters, beatboxers, and actors for the Tarang 2026 flagship street play squad. No prior experience required!',
        avatar: '🎭'
      },
      {
        id: 'evt-iiitj-saaz',
        title: 'Saaz Unplugged: Monsoon Acoustic Night & Jam Session',
        club: 'Saaz',
        category: 'Cultural',
        speaker: 'Saaz Core Band',
        venue: 'Student Activity Center (SAC Hall)',
        dateTime: futureDate(1, 19, 30),
        capacity: 180,
        regLink: '',
        description: 'Relax after lectures with live acoustic covers, classical fusion, and open-mic slots for guitars, keyboards, cajon, and vocalists.',
        avatar: '🎵'
      },
      {
        id: 'evt-iiitj-football',
        title: 'Inter-Hall Fresher League: Hall 3 vs Hall 4 Knockout Match',
        club: 'Football',
        category: 'Sports',
        speaker: 'Sports Council IIITDMJ',
        venue: 'Main Football Ground',
        dateTime: futureDate(2, 17, 30),
        capacity: 300,
        regLink: '',
        description: 'High-voltage inter-hostel football clash under floodlights. Come out and cheer for your hostel wing!',
        avatar: '⚽'
      }
    ];
  }

  // --- AUDIO CHIME GENERATOR ---
  function playNotificationChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.18);
      osc2.frequency.setValueAtTime(440.0, ctx.currentTime);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.log('Web Audio chime disabled:', e);
    }
  }

  // --- APPLICATION STATE ---
  let events = [];
  let reminders = [];
  let notifLogs = [];
  let authToken = localStorage.getItem(STORAGE_KEY_AUTH_TOKEN) || null;
  let currentClub = null;
  try {
    currentClub = JSON.parse(localStorage.getItem(STORAGE_KEY_AUTH_CLUB)) || null;
  } catch (e) {
    currentClub = null;
  }

  let serverOnline = false;
  let currentFilterCategory = 'All';
  let currentFilterClub = 'all';
  let currentSearchQuery = '';
  let currentTimeFilter = 'all';
  let selectedEventForDetail = null;
  let activeAlertEvent = null;

  // --- DOM ELEMENTS ---
  const serverStatusPill = document.getElementById('serverStatusPill');
  const serverStatusText = document.getElementById('serverStatusText');

  // Top Notification Bar
  const topNotificationBar = document.getElementById('topNotificationBar');
  const topNotifMessage = document.getElementById('topNotifMessage');
  const btnTopNotifView = document.getElementById('btnTopNotifView');
  const btnTopNotifClear = document.getElementById('btnTopNotifClear');

  // Auth UI
  const loggedOutView = document.getElementById('loggedOutView');
  const loggedInView = document.getElementById('loggedInView');
  const btnOpenLoginModal = document.getElementById('btnOpenLoginModal');
  const btnLogout = document.getElementById('btnLogout');
  const loggedClubBadge = document.getElementById('loggedClubBadge');
  const loggedClubIcon = document.getElementById('loggedClubIcon');
  const loggedClubName = document.getElementById('loggedClubName');
  const clubLoginModal = document.getElementById('clubLoginModal');
  const btnCloseLoginModal = document.getElementById('btnCloseLoginModal');
  const btnCancelLogin = document.getElementById('btnCancelLogin');
  const clubLoginForm = document.getElementById('clubLoginForm');
  const loginClubSelect = document.getElementById('loginClubSelect');
  const loginPassword = document.getElementById('loginPassword');
  const loginErrorMsg = document.getElementById('loginErrorMsg');

  // Post Event UI
  const btnOpenPostModal = document.getElementById('btnOpenPostModal');
  const btnOpenPostModalAuth = document.getElementById('btnOpenPostModalAuth');
  const btnEmptyPost = document.getElementById('btnEmptyPost');
  const postEventModal = document.getElementById('postEventModal');
  const btnClosePostModal = document.getElementById('btnClosePostModal');
  const btnCancelPost = document.getElementById('btnCancelPost');
  const postEventForm = document.getElementById('postEventForm');
  const postingAsClubName = document.getElementById('postingAsClubName');
  const eventCategory = document.getElementById('eventCategory');

  // Feed & Filters
  const eventsGrid = document.getElementById('eventsGrid');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const filterCategories = document.getElementById('filterCategories');
  const specificClubSelect = document.getElementById('specificClubSelect');
  const timeFilterSelect = document.getElementById('timeFilterSelect');
  const eventsCountBadge = document.getElementById('eventsCountBadge');
  const btnRefreshEvents = document.getElementById('btnRefreshEvents');
  const statEventsCount = document.getElementById('statEventsCount');
  const statRemindersCount = document.getElementById('statRemindersCount');

  // Notification Drawer
  const notifBadge = document.getElementById('notifBadge');
  const notifDropdown = document.getElementById('notifDropdown');
  const btnToggleNotif = document.getElementById('btnToggleNotif');
  const notifList = document.getElementById('notifList');
  const activeRemindersList = document.getElementById('activeRemindersList');
  const btnClearNotifs = document.getElementById('btnClearNotifs');
  const permissionStatus = document.getElementById('permissionStatus');
  const toastContainer = document.getElementById('toastContainer');
  const btnQuickDemoAlert = document.getElementById('btnQuickDemoAlert');
  const btnPanelDemoTrigger = document.getElementById('btnPanelDemoTrigger');

  // Details Modal
  const eventDetailModal = document.getElementById('eventDetailModal');
  const btnCloseDetailModal = document.getElementById('btnCloseDetailModal');
  const detailTitle = document.getElementById('detailTitle');
  const detailClub = document.getElementById('detailClub');
  const detailDate = document.getElementById('detailDate');
  const detailCountdown = document.getElementById('detailCountdown');
  const detailVenue = document.getElementById('detailVenue');
  const detailSpeaker = document.getElementById('detailSpeaker');
  const detailSeats = document.getElementById('detailSeats');
  const detailDescription = document.getElementById('detailDescription');
  const detailCategoryPill = document.getElementById('detailCategoryPill');
  const reminderLeadTime = document.getElementById('reminderLeadTime');
  const btnSubscribeReminder = document.getElementById('btnSubscribeReminder');
  const btnDownloadIcs = document.getElementById('btnDownloadIcs');
  const btnExternalReg = document.getElementById('btnExternalReg');

  // --- INITIALIZATION ---
  async function init() {
    loadLocalState();
    updateAuthUI();
    setupEventListeners();
    checkNotificationPermission();

    // Check backend connection and fetch events
    await verifyBackendConnection();
    await fetchEvents();

    renderAll();

    // Background checker for reminders every 15s
    setInterval(checkUpcomingReminders, 15000);
    // Refresh countdown badges every 60s
    setInterval(renderEvents, 60000);
  }

  // --- LOCAL STORAGE STATE ---
  function loadLocalState() {
    const rawReminders = localStorage.getItem(STORAGE_KEY_REMINDERS);
    reminders = rawReminders ? JSON.parse(rawReminders) : [];

    const rawLogs = localStorage.getItem(STORAGE_KEY_NOTIFS);
    notifLogs = rawLogs ? JSON.parse(rawLogs) : [];
  }

  function saveReminders() {
    localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(reminders));
    updateStats();
    renderNotificationPanel();
  }

  function saveNotifLogs() {
    localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(notifLogs));
    updateBadge();
    renderNotificationPanel();
  }

  // --- BACKEND API CALLS ---
  async function verifyBackendConnection() {
    try {
      const res = await fetch(`${API_BASE}/clubs`, { method: 'GET' });
      if (res.ok) {
        serverOnline = true;
        serverStatusPill.className = 'server-status-pill online';
        serverStatusText.textContent = 'Backend Online (Port 5000)';
      } else {
        throw new Error('Server returned ' + res.status);
      }
    } catch (err) {
      serverOnline = false;
      serverStatusPill.className = 'server-status-pill offline';
      serverStatusText.textContent = 'Backend Offline (Using Local Cache)';
    }

    // If token exists, verify with server
    if (authToken && serverOnline) {
      try {
        const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await verifyRes.json();
        if (!data.authenticated) {
          logoutClub(false);
        } else {
          currentClub = data.club;
          localStorage.setItem(STORAGE_KEY_AUTH_CLUB, JSON.stringify(currentClub));
          updateAuthUI();
        }
      } catch (e) {
        console.warn('Auth verify skipped:', e);
      }
    }
  }

  async function fetchEvents() {
    if (serverOnline) {
      try {
        const res = await fetch(`${API_BASE}/events`);
        const data = await res.json();
        if (data.success && Array.isArray(data.events)) {
          events = data.events;
          localStorage.setItem(STORAGE_KEY_OFFLINE_EVENTS, JSON.stringify(events));
          return;
        }
      } catch (err) {
        console.warn('Failed to fetch from API, falling back to cache:', err);
      }
    }

    // Fallback if offline
    const cached = localStorage.getItem(STORAGE_KEY_OFFLINE_EVENTS);
    if (cached) {
      try {
        events = JSON.parse(cached);
      } catch (e) {
        events = getLocalFallbackEvents();
      }
    } else {
      events = getLocalFallbackEvents();
    }
  }

  // --- AUTHENTICATION ACTIONS ---
  async function loginClub(username, password) {
    loginErrorMsg.classList.add('hidden');

    if (serverOnline) {
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (data.success && data.token) {
          authToken = data.token;
          currentClub = data.club;
          localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, authToken);
          localStorage.setItem(STORAGE_KEY_AUTH_CLUB, JSON.stringify(currentClub));

          updateAuthUI();
          clubLoginModal.classList.add('hidden');
          clubLoginForm.reset();
          showToast('Welcome, ' + currentClub.name + '! 🏛️', 'You can now publish and manage campus sessions.', 'toast-success', '🔓');
          return true;
        } else {
          loginErrorMsg.textContent = data.message || 'Invalid club credentials.';
          loginErrorMsg.classList.remove('hidden');
          return false;
        }
      } catch (err) {
        loginErrorMsg.textContent = 'Network error connecting to backend.';
        loginErrorMsg.classList.remove('hidden');
        return false;
      }
    } else {
      // Offline fallback: validate iiitdmj123
      if (password === 'iiitdmj123') {
        authToken = 'offline_token_' + Date.now();
        currentClub = {
          id: username.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name: username,
          category: 'Technical',
          icon: '🏛️'
        };
        localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, authToken);
        localStorage.setItem(STORAGE_KEY_AUTH_CLUB, JSON.stringify(currentClub));
        updateAuthUI();
        clubLoginModal.classList.add('hidden');
        clubLoginForm.reset();
        showToast('Logged in (Offline Mode)', `Logged in as ${username}`, 'toast-success', '🔓');
        return true;
      } else {
        loginErrorMsg.textContent = 'Incorrect password. Hint: Use "iiitdmj123".';
        loginErrorMsg.classList.remove('hidden');
        return false;
      }
    }
  }

  function logoutClub(showFeedback = true) {
    if (serverOnline && authToken) {
      fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      }).catch(() => {});
    }

    authToken = null;
    currentClub = null;
    localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEY_AUTH_CLUB);
    updateAuthUI();
    renderEvents();

    if (showFeedback) {
      showToast('Logged Out', 'You are now viewing in Student Mode.', 'toast-success', '🔒');
    }
  }

  function updateAuthUI() {
    if (authToken && currentClub) {
      loggedOutView.classList.add('hidden');
      loggedInView.classList.remove('hidden');
      loggedClubName.textContent = currentClub.name;
      loggedClubIcon.textContent = currentClub.icon || '🏛️';
    } else {
      loggedOutView.classList.remove('hidden');
      loggedInView.classList.add('hidden');
    }
  }

  // --- POST EVENT ACTION ---
  async function publishSession(eventData) {
    if (serverOnline && authToken) {
      try {
        const res = await fetch(`${API_BASE}/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(eventData)
        });

        const data = await res.json();
        if (data.success && data.event) {
          events.unshift(data.event);
          renderAll();
          showToast('Session Published! 📢', `"${eventData.title}" announced to IIIT Jabalpur.`, 'toast-success', '🎉');
          return true;
        } else {
          showToast('Error Publishing', data.message || 'Could not post session.', 'toast-alert', '❌');
          return false;
        }
      } catch (err) {
        console.error('API publish failed, saving locally:', err);
      }
    }

    // Fallback / Offline
    const localEvent = {
      id: 'evt-custom-' + Date.now(),
      title: eventData.title,
      club: currentClub ? currentClub.name : 'The Programming Club',
      category: currentClub ? currentClub.category : 'Technical',
      speaker: eventData.speaker,
      dateTime: eventData.dateTime,
      venue: eventData.venue,
      capacity: eventData.capacity,
      regLink: eventData.regLink,
      description: eventData.description,
      avatar: currentClub ? currentClub.icon : '🏛️'
    };

    events.unshift(localEvent);
    localStorage.setItem(STORAGE_KEY_OFFLINE_EVENTS, JSON.stringify(events));
    renderAll();
    showToast('Session Published (Local)', `"${eventData.title}" announced!`, 'toast-success', '🎉');
    return true;
  }

  // --- TOP NOTIFICATION BAR (Appears ONLY when an alert triggers) ---
  function showTopNotificationBar(title, message, eventObj) {
    activeAlertEvent = eventObj;
    topNotifMessage.innerHTML = `<strong>${escapeHtml(title)}:</strong> ${escapeHtml(message)}`;
    topNotificationBar.classList.remove('hidden');
  }

  function hideTopNotificationBar() {
    topNotificationBar.classList.add('hidden');
    activeAlertEvent = null;
  }

  // --- DISPATCH NOTIFICATION ---
  function dispatchNotification(title, message, eventObj) {
    playNotificationChime();

    // 1. Show Dynamic Top Notification Bar
    showTopNotificationBar(title, message, eventObj);

    // 2. Native Web Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏛️</text></svg>',
          tag: eventObj ? eventObj.id : 'iiitj-alert'
        });
      } catch (err) {
        console.warn('Native notification warning:', err);
      }
    }

    // 3. Floating Toast
    showToast(title, message, 'toast-alert', '🔔');

    // 4. Log to drawer
    const newLog = {
      id: 'notif-' + Date.now(),
      title: title,
      message: message,
      eventId: eventObj ? eventObj.id : null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
    notifLogs.unshift(newLog);
    if (notifLogs.length > 20) notifLogs.pop();
    saveNotifLogs();
  }

  // --- BACKGROUND REMINDER CHECKER ---
  function checkUpcomingReminders() {
    const now = new Date().getTime();

    reminders.forEach((rem) => {
      if (rem.notified) return;

      const event = events.find((e) => e.id === rem.eventId);
      if (!event) return;

      const eventTime = new Date(event.dateTime).getTime();
      const leadMs = (rem.leadMinutes || 15) * 60 * 1000;
      const triggerTime = eventTime - leadMs;

      if (now >= triggerTime && now <= eventTime + 45 * 60 * 1000) {
        rem.notified = true;
        saveReminders();

        const leadStr = formatLeadTimeText(rem.leadMinutes);
        dispatchNotification(
          `IIIT Jabalpur Session Alert: ${event.title}`,
          `By ${event.club} • Starts in ${leadStr} at ${event.venue}!`,
          event
        );
      }
    });
  }

  function formatLeadTimeText(mins) {
    if (mins >= 1440) return `${Math.round(mins / 1440)} day`;
    if (mins >= 60) return `${Math.round(mins / 60)} hour`;
    return `${mins} minutes`;
  }

  // --- TOAST ALERTS ---
  function showToast(title, msg, type = 'toast-alert', icon = '🔔') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-msg">${escapeHtml(msg)}</div>
      </div>
      <button class="toast-close" title="Dismiss">&times;</button>
    `;

    toast.querySelector('.toast-close').onclick = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    };

    toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 6000);
  }

  // --- PERMISSION CHECK ---
  function checkNotificationPermission() {
    if (!('Notification' in window)) {
      permissionStatus.textContent = 'Browser: Unsupported';
      permissionStatus.className = 'permission-pill denied';
      return;
    }

    if (Notification.permission === 'granted') {
      permissionStatus.textContent = 'Browser: Alerts Enabled';
      permissionStatus.className = 'permission-pill granted';
    } else if (Notification.permission === 'denied') {
      permissionStatus.textContent = 'Browser: Alerts Blocked';
      permissionStatus.className = 'permission-pill denied';
    } else {
      permissionStatus.textContent = 'Browser: Click to Allow';
      permissionStatus.className = 'permission-pill';
      permissionStatus.style.cursor = 'pointer';
      permissionStatus.onclick = () => Notification.requestPermission().then(checkNotificationPermission);
    }
  }

  // --- CALENDAR GENERATOR (.ICS) ---
  function generateIcsFile(event) {
    const startDate = new Date(event.dateTime);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    const pad = (n) => (n < 10 ? '0' + n : n);
    const toIcsDate = (date) =>
      date.getUTCFullYear() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      'T' +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      '00Z';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ClubPulse//IIIT Jabalpur Campus Events//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${event.id}-${Date.now()}@iiitdmj.ac.in`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(startDate)}`,
      `DTEND:${toIcsDate(endDate)}`,
      `SUMMARY:${event.title.replace(/\n/g, ' ')}`,
      `DESCRIPTION:${(event.club + ' at IIIT Jabalpur - ' + event.description).replace(/\n/g, '\\n')}`,
      `LOCATION:${(event.venue + ', PDPM IIITDM Jabalpur').replace(/\n/g, ' ')}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Calendar Synced', `Downloaded .ics for "${event.title}"!`, 'toast-success', '📅');
  }

  // --- TIME & COUNTDOWN FORMATTING ---
  function formatCountdown(dateTimeStr) {
    const eventTime = new Date(dateTimeStr).getTime();
    const now = new Date().getTime();
    const diff = eventTime - now;

    if (diff < 0) {
      if (diff > -2 * 60 * 60 * 1000) return { text: 'Happening Now 🔥', urgent: true };
      return { text: 'Past Session', urgent: false };
    }

    const diffHours = Math.floor(diff / (1000 * 60 * 60));
    const diffMins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 1) return { text: `In ${diffDays} days`, urgent: false };
    if (diffDays === 1) return { text: 'Tomorrow', urgent: false };
    if (diffHours > 0) return { text: `In ${diffHours}h ${diffMins}m`, urgent: diffHours <= 2 };
    return { text: `In ${diffMins} mins!`, urgent: true };
  }

  function formatDateTime(dateTimeStr) {
    const d = new Date(dateTimeStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // --- RENDER LOGIC ---
  function renderAll() {
    renderEvents();
    updateStats();
    updateBadge();
    renderNotificationPanel();
  }

  function renderEvents() {
    const filtered = events.filter((evt) => {
      // 1. Major Category
      if (currentFilterCategory !== 'All' && evt.category !== currentFilterCategory) {
        return false;
      }

      // 2. Specific Club
      if (currentFilterClub !== 'all' && evt.club.toLowerCase() !== currentFilterClub.toLowerCase()) {
        return false;
      }

      // 3. Search Query
      if (currentSearchQuery.trim() !== '') {
        const q = currentSearchQuery.toLowerCase();
        const matchTitle = (evt.title || '').toLowerCase().includes(q);
        const matchClub = (evt.club || '').toLowerCase().includes(q);
        const matchVenue = (evt.venue || '').toLowerCase().includes(q);
        const matchDesc = (evt.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchClub && !matchVenue && !matchDesc) return false;
      }

      // 4. Timing
      if (currentTimeFilter !== 'all') {
        const evtDate = new Date(evt.dateTime);
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        const isSameDay = (d1, d2) =>
          d1.getFullYear() === d2.getFullYear() &&
          d1.getMonth() === d2.getMonth() &&
          d1.getDate() === d2.getDate();

        if (currentTimeFilter === 'today' && !isSameDay(evtDate, today)) return false;
        if (currentTimeFilter === 'tomorrow' && !isSameDay(evtDate, tomorrow)) return false;
        if (currentTimeFilter === 'this_week') {
          const sevenDays = new Date();
          sevenDays.setDate(today.getDate() + 7);
          if (evtDate < today || evtDate > sevenDays) return false;
        }
      }

      return true;
    });

    filtered.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    eventsCountBadge.textContent = `${filtered.length} session${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      eventsGrid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    eventsGrid.innerHTML = filtered.map((evt) => createEventCardHtml(evt)).join('');

    attachCardListeners();
  }

  function createEventCardHtml(event) {
    const countdown = formatCountdown(event.dateTime);
    const isSubscribed = reminders.some((r) => r.eventId === event.id);
    const isMyClubEvent = currentClub && currentClub.name.toLowerCase() === event.club.toLowerCase();

    return `
      <div class="event-card" data-id="${event.id}">
        <div class="event-card-header">
          <div class="club-info">
            <div class="club-avatar">${event.avatar || '🏛️'}</div>
            <div>
              <div class="club-name">${escapeHtml(event.club)}</div>
              <div class="category-tag">${escapeHtml(event.category || 'Campus')} Club</div>
            </div>
          </div>
          <span class="countdown-badge ${countdown.urgent ? 'urgent' : ''}">${countdown.text}</span>
        </div>

        <div class="event-card-body">
          <h4 class="event-title" title="Click to view details">${escapeHtml(event.title)}</h4>
          
          <div class="event-details-list">
            <div class="detail-row time">
              <span class="row-icon">🕒</span>
              <span>${formatDateTime(event.dateTime)}</span>
            </div>
            <div class="detail-row venue">
              <span class="row-icon">📍</span>
              <span>${escapeHtml(event.venue)}</span>
            </div>
          </div>

          <p class="event-desc-snippet">${escapeHtml(event.description)}</p>
        </div>

        <div class="event-card-footer">
          <button class="btn-notify-card ${isSubscribed ? 'subscribed' : ''}" data-action="toggle-reminder" data-id="${event.id}">
            <span class="bell-icon">${isSubscribed ? '✅' : '🔔'}</span>
            <span>${isSubscribed ? 'Reminded' : 'Notify Me'}</span>
          </button>
          
          <div style="display:flex; align-items:center; gap:8px;">
            ${
              isMyClubEvent
                ? `<button class="btn-text" data-action="delete-event" data-id="${event.id}" style="color:var(--danger);" title="Delete your club session">🗑️</button>`
                : ''
            }
            <button class="btn-details-card" data-action="open-detail" data-id="${event.id}">
              Details &rarr;
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function attachCardListeners() {
    // Notify Me
    document.querySelectorAll('.btn-notify-card').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        toggleQuickReminder(btn.getAttribute('data-id'));
      };
    });

    // Details Modal
    document.querySelectorAll('.btn-details-card, .event-title').forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        const card = el.closest('.event-card');
        openDetailModal(card.getAttribute('data-id'));
      };
    });

    // Delete Event (Club Owner)
    document.querySelectorAll('[data-action="delete-event"]').forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const eventId = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this session?')) {
          if (serverOnline && authToken) {
            try {
              const res = await fetch(`${API_BASE}/events/${eventId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${authToken}` }
              });
              const data = await res.json();
              if (data.success) {
                events = events.filter((ev) => ev.id !== eventId);
                renderAll();
                showToast('Session Deleted', 'The session was removed from campus schedule.', 'toast-success', '🗑️');
                return;
              }
            } catch (err) {
              console.error('Delete failed:', err);
            }
          }
          // Local delete fallback
          events = events.filter((ev) => ev.id !== eventId);
          renderAll();
          showToast('Session Removed', 'Event removed locally.', 'toast-success', '🗑️');
        }
      };
    });
  }

  function updateStats() {
    statEventsCount.textContent = events.length;
    statRemindersCount.textContent = reminders.length;
  }

  function updateBadge() {
    const unreadCount = notifLogs.filter((n) => !n.read).length;
    notifBadge.textContent = unreadCount;
    notifBadge.style.display = unreadCount > 0 ? 'grid' : 'none';
  }

  function renderNotificationPanel() {
    // Active reminders
    if (reminders.length === 0) {
      activeRemindersList.innerHTML = '<div class="empty-notif-msg">No active reminders yet. Click "Notify Me" on any club event!</div>';
    } else {
      activeRemindersList.innerHTML = reminders
        .map((rem) => {
          const event = events.find((e) => e.id === rem.eventId);
          if (!event) return '';
          return `
            <div class="reminder-item">
              <div>
                <div class="rem-title">${escapeHtml(event.title)}</div>
                <div class="rem-meta">📍 ${escapeHtml(event.venue)} &bull; ${formatLeadTimeText(rem.leadMinutes)} prior</div>
              </div>
              <button class="btn-remove-rem" data-action="remove-rem" data-id="${rem.eventId}" title="Remove reminder">&times;</button>
            </div>
          `;
        })
        .join('');

      activeRemindersList.querySelectorAll('[data-action="remove-rem"]').forEach((btn) => {
        btn.onclick = () => removeReminder(btn.getAttribute('data-id'));
      });
    }

    // Recent notification history
    if (notifLogs.length === 0) {
      notifList.innerHTML = '<div class="empty-notif-msg">No recent alerts. Use "⚡ Test Alert" to demo!</div>';
    } else {
      notifList.innerHTML = notifLogs
        .map(
          (n) => `
          <div class="notif-item ${n.read ? '' : 'unread'}">
            <div class="notif-text">${escapeHtml(n.title)}</div>
            <div style="font-size:0.76rem; color:#475569; margin-bottom:2px;">${escapeHtml(n.message)}</div>
            <div class="notif-time">${n.timestamp}</div>
          </div>
        `
        )
        .join('');
    }
  }

  // --- REMINDER MANAGEMENT ---
  function toggleQuickReminder(eventId) {
    const existingIndex = reminders.findIndex((r) => r.eventId === eventId);
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    if (existingIndex > -1) {
      reminders.splice(existingIndex, 1);
      saveReminders();
      renderEvents();
      showToast('Reminder Removed', `Cancelled alert for "${event.title}"`, 'toast-success', '🔕');
    } else {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(checkNotificationPermission);
      }

      reminders.push({
        eventId: event.id,
        leadMinutes: 15,
        subscribedAt: new Date().toISOString(),
        notified: false
      });
      saveReminders();
      renderEvents();
      showToast('Reminder Set! 🔔', `You will be alerted 15m before "${event.title}" at ${event.venue}.`, 'toast-success', '🔔');
    }
  }

  function removeReminder(eventId) {
    const index = reminders.findIndex((r) => r.eventId === eventId);
    if (index > -1) {
      reminders.splice(index, 1);
      saveReminders();
      renderEvents();
    }
  }

  // --- DETAIL MODAL ---
  function openDetailModal(eventId) {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    selectedEventForDetail = event;

    detailTitle.textContent = event.title;
    detailClub.textContent = `${event.club} (${event.category || 'Campus'} Club)`;
    detailCategoryPill.textContent = event.category || 'Campus';
    detailDate.textContent = formatDateTime(event.dateTime);

    const countdown = formatCountdown(event.dateTime);
    detailCountdown.textContent = countdown.text;
    detailCountdown.style.color = countdown.urgent ? 'var(--danger)' : 'var(--text-muted)';

    detailVenue.textContent = event.venue;
    detailSpeaker.textContent = event.speaker || 'Club Coordinators';
    detailSeats.textContent = event.capacity > 0 ? `${event.capacity} seats limit` : 'Open Entry';
    detailDescription.textContent = event.description;

    const existingReminder = reminders.find((r) => r.eventId === event.id);
    if (existingReminder) {
      reminderLeadTime.value = String(existingReminder.leadMinutes);
      btnSubscribeReminder.textContent = '❌ Cancel Reminder';
      btnSubscribeReminder.classList.add('active');
    } else {
      reminderLeadTime.value = '15';
      btnSubscribeReminder.innerHTML = '<span class="bell-icon">🔔</span> Notify Me';
      btnSubscribeReminder.classList.remove('active');
    }

    if (event.regLink && event.regLink.startsWith('http')) {
      btnExternalReg.href = event.regLink;
      btnExternalReg.classList.remove('hidden');
    } else {
      btnExternalReg.classList.add('hidden');
    }

    eventDetailModal.classList.remove('hidden');
  }

  function closeDetailModal() {
    eventDetailModal.classList.add('hidden');
    selectedEventForDetail = null;
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Top Notification Bar Dismiss
    btnTopNotifClear.onclick = hideTopNotificationBar;

    btnTopNotifView.onclick = () => {
      if (activeAlertEvent) openDetailModal(activeAlertEvent.id);
    };

    // Refresh Button
    btnRefreshEvents.onclick = async () => {
      await fetchEvents();
      renderAll();
      showToast('Feed Updated', 'Loaded latest sessions.', 'toast-success', '🔄');
    };

    // Search Input
    searchInput.oninput = (e) => {
      currentSearchQuery = e.target.value;
      clearSearchBtn.classList.toggle('hidden', currentSearchQuery.length === 0);
      renderEvents();
    };

    clearSearchBtn.onclick = () => {
      searchInput.value = '';
      currentSearchQuery = '';
      clearSearchBtn.classList.add('hidden');
      renderEvents();
      searchInput.focus();
    };

    // Major Category Filter
    filterCategories.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;

      filterCategories.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilterCategory = chip.getAttribute('data-category');

      specificClubSelect.value = 'all';
      currentFilterClub = 'all';
      renderEvents();
    });

    // Specific Club Filter
    specificClubSelect.onchange = (e) => {
      currentFilterClub = e.target.value;
      renderEvents();
    };

    // Timing Filter
    timeFilterSelect.onchange = (e) => {
      currentTimeFilter = e.target.value;
      renderEvents();
    };

    // Notification Dropdown Toggle
    btnToggleNotif.onclick = (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('hidden');
      if (!notifDropdown.classList.contains('hidden')) {
        notifLogs.forEach((n) => (n.read = true));
        saveNotifLogs();
      }
    };

    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target) && !btnToggleNotif.contains(e.target)) {
        notifDropdown.classList.add('hidden');
      }
    });

    // Clear All Notifications
    btnClearNotifs.onclick = () => {
      notifLogs = [];
      saveNotifLogs();
      hideTopNotificationBar();
      showToast('Notifications Cleared', 'All alerts have been cleared.', 'toast-success', '🧹');
    };

    // --- AUTH MODAL HANDLERS ---
    const openLogin = () => {
      loginErrorMsg.classList.add('hidden');
      clubLoginModal.classList.remove('hidden');
    };

    btnOpenLoginModal.onclick = openLogin;
    btnCloseLoginModal.onclick = () => clubLoginModal.classList.add('hidden');
    btnCancelLogin.onclick = () => clubLoginModal.classList.add('hidden');
    clubLoginModal.querySelector('.modal-backdrop').onclick = () => clubLoginModal.classList.add('hidden');

    btnLogout.onclick = () => logoutClub(true);

    clubLoginForm.onsubmit = async (e) => {
      e.preventDefault();
      const clubName = loginClubSelect.value;
      const pass = loginPassword.value;
      await loginClub(clubName, pass);
    };

    // --- POST EVENT HANDLERS ---
    const tryOpenPostModal = () => {
      if (!authToken || !currentClub) {
        // Prompt login first!
        showToast('Club Login Required', 'Only verified IIIT Jabalpur clubs can announce sessions.', 'toast-alert', '🔐');
        openLogin();
        return;
      }

      postingAsClubName.textContent = currentClub.name;
      eventCategory.value = currentClub.category || 'Technical';

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(17, 0, 0, 0);
      const pad = (n) => (n < 10 ? '0' + n : n);
      document.getElementById('eventDateTime').value = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;

      postEventModal.classList.remove('hidden');
    };

    btnOpenPostModal.onclick = tryOpenPostModal;
    btnOpenPostModalAuth.onclick = tryOpenPostModal;
    btnEmptyPost.onclick = tryOpenPostModal;

    btnClosePostModal.onclick = () => postEventModal.classList.add('hidden');
    btnCancelPost.onclick = () => postEventModal.classList.add('hidden');
    postEventModal.querySelector('.modal-backdrop').onclick = () => postEventModal.classList.add('hidden');

    // Post Event Form Submit
    postEventForm.onsubmit = async (e) => {
      e.preventDefault();

      const eventData = {
        title: document.getElementById('eventTitle').value.trim(),
        speaker: document.getElementById('eventSpeaker').value.trim(),
        dateTime: document.getElementById('eventDateTime').value,
        venue: document.getElementById('eventVenue').value.trim(),
        capacity: parseInt(document.getElementById('eventCapacity').value, 10) || 0,
        regLink: document.getElementById('eventRegLink').value.trim(),
        description: document.getElementById('eventDesc').value.trim(),
        category: currentClub ? currentClub.category : 'Technical'
      };

      const success = await publishSession(eventData);
      if (success) {
        postEventForm.reset();
        postEventModal.classList.add('hidden');
      }
    };

    // Detail Modal Close
    btnCloseDetailModal.onclick = closeDetailModal;
    eventDetailModal.querySelector('.modal-backdrop').onclick = closeDetailModal;

    // Reminder Subscription in Details Modal
    btnSubscribeReminder.onclick = () => {
      if (!selectedEventForDetail) return;
      const eventId = selectedEventForDetail.id;
      const existingIndex = reminders.findIndex((r) => r.eventId === eventId);

      if (existingIndex > -1) {
        reminders.splice(existingIndex, 1);
        saveReminders();
        renderEvents();
        btnSubscribeReminder.innerHTML = '<span class="bell-icon">🔔</span> Notify Me';
        btnSubscribeReminder.classList.remove('active');
        showToast('Reminder Cancelled', `Alert removed for "${selectedEventForDetail.title}"`, 'toast-success', '🔕');
      } else {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(checkNotificationPermission);
        }

        const leadMins = parseInt(reminderLeadTime.value, 10) || 15;
        reminders.push({
          eventId: eventId,
          leadMinutes: leadMins,
          subscribedAt: new Date().toISOString(),
          notified: false
        });
        saveReminders();
        renderEvents();
        btnSubscribeReminder.textContent = '❌ Cancel Reminder';
        btnSubscribeReminder.classList.add('active');

        showToast(
          'Reminder Active! 🔔',
          `Alert set for ${formatLeadTimeText(leadMins)} before at ${selectedEventForDetail.venue}.`,
          'toast-success',
          '🔔'
        );
      }
    };

    // Download .ics Calendar File
    btnDownloadIcs.onclick = () => {
      if (selectedEventForDetail) generateIcsFile(selectedEventForDetail);
    };

    // Quick Hackathon Demo Trigger
    const triggerDemoAlert = () => {
      const demoEvt = events[0] || {
        id: 'demo-tpc',
        title: 'CodeRumble 2026 Contest',
        club: 'The Programming Club',
        venue: 'Computer Center (CC-1)'
      };

      dispatchNotification(
        `Upcoming Session Starting Soon!`,
        `"${demoEvt.title}" by ${demoEvt.club} starts in 15 minutes at ${demoEvt.venue}. Don't miss it!`,
        demoEvt
      );
    };

    btnQuickDemoAlert.onclick = triggerDemoAlert;
    btnPanelDemoTrigger.onclick = triggerDemoAlert;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
