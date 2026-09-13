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
  const STORAGE_KEY_AUTH_USER = 'clubpulse_auth_user';
  const STORAGE_KEY_REMINDERS = 'clubpulse_reminders';
  const STORAGE_KEY_NOTIFS = 'clubpulse_notif_logs';
  const STORAGE_KEY_OFFLINE_EVENTS = 'clubpulse_offline_events';
  const STORAGE_KEY_INTERESTED = 'clubpulse_interested_events';

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
        avatar: '💻',
        status: 'active',
        interestedCount: 38,
        closedBy: null,
        closedReason: null
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
        avatar: '🤖',
        status: 'active',
        interestedCount: 24,
        closedBy: null,
        closedReason: null
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
        avatar: '🎭',
        status: 'active',
        interestedCount: 65,
        closedBy: null,
        closedReason: null
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
        avatar: '🎵',
        status: 'active',
        interestedCount: 52,
        closedBy: null,
        closedReason: null
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
        avatar: '⚽',
        status: 'active',
        interestedCount: 94,
        closedBy: null,
        closedReason: null
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
  let interestedEvents = new Set();
  let campusAnnouncements = [];
  // SECURITY: Use sessionStorage instead of localStorage for authentication credentials.
  // This guarantees that authentication is strictly bound to the active login session.
  // Opening a new tab, new window, incognito tab, or copying the URL will NOT transfer
  // the login session or allow unauthorized access.
  let authToken = sessionStorage.getItem(STORAGE_KEY_AUTH_TOKEN) || null;
  let currentUser = null;
  try {
    currentUser = JSON.parse(sessionStorage.getItem(STORAGE_KEY_AUTH_USER)) || null;
  } catch (e) {
    currentUser = null;
  }

  let serverOnline = false;
  let currentFilterCategory = 'All';
  let currentFilterClub = 'all';
  let currentSearchQuery = '';
  let currentTimeFilter = 'all';
  let selectedEventForDetail = null;
  let activeAlertEvent = null;

  // Active Admin / Club state
  let adminAllEvents = [];
  let adminCurrentFilter = 'all';
  let adminSearchQuery = '';
  let currentLoginTabRole = 'club';

  // --- DOM ELEMENTS ---
  const serverStatusPill = document.getElementById('serverStatusPill');
  const serverStatusText = document.getElementById('serverStatusText');

  // Top Notification Bar
  const topNotificationBar = document.getElementById('topNotificationBar');
  const topNotifMessage = document.getElementById('topNotifMessage');
  const btnTopNotifView = document.getElementById('btnTopNotifView');
  const btnTopNotifClear = document.getElementById('btnTopNotifClear');

  // Auth UI (Navbar)
  const loggedOutView = document.getElementById('loggedOutView');
  const loggedInClubView = document.getElementById('loggedInClubView');
  const loggedInAdminView = document.getElementById('loggedInAdminView');
  const btnOpenLoginModal = document.getElementById('btnOpenLoginModal');
  const btnLogout = document.getElementById('btnLogout');
  const btnAdminLogout = document.getElementById('btnAdminLogout');
  const loggedClubIcon = document.getElementById('loggedClubIcon');
  const loggedClubName = document.getElementById('loggedClubName');
  const btnOpenClubManageModal = document.getElementById('btnOpenClubManageModal');
  const btnOpenAdminDashboard = document.getElementById('btnOpenAdminDashboard');

  // Login Modal
  const clubLoginModal = document.getElementById('clubLoginModal');
  const btnCloseLoginModal = document.getElementById('btnCloseLoginModal');
  const btnCancelLogin = document.getElementById('btnCancelLogin');
  const clubLoginForm = document.getElementById('clubLoginForm');
  const tabClubLogin = document.getElementById('tabClubLogin');
  const tabAdminLogin = document.getElementById('tabAdminLogin');
  const clubLoginFields = document.getElementById('clubLoginFields');
  const adminLoginFields = document.getElementById('adminLoginFields');
  const loginClubSelect = document.getElementById('loginClubSelect');
  const loginPassword = document.getElementById('loginPassword');
  const loginAdminUsername = document.getElementById('loginAdminUsername');
  const loginAdminPassword = document.getElementById('loginAdminPassword');
  const btnLoginSubmit = document.getElementById('btnLoginSubmit');
  const loginErrorMsg = document.getElementById('loginErrorMsg');

  // Post Event UI
  const btnOpenPostModal = document.getElementById('btnOpenPostModal');
  const btnOpenPostModalAuth = document.getElementById('btnOpenPostModalAuth');
  const btnOpenPostModalAdmin = document.getElementById('btnOpenPostModalAdmin');
  const btnEmptyPost = document.getElementById('btnEmptyPost');
  const postEventModal = document.getElementById('postEventModal');
  const btnClosePostModal = document.getElementById('btnClosePostModal');
  const btnCancelPost = document.getElementById('btnCancelPost');
  const postEventForm = document.getElementById('postEventForm');
  const postingAsClubName = document.getElementById('postingAsClubName');
  const eventCategory = document.getElementById('eventCategory');

  // Admin Dashboard Modal
  const adminDashboardModal = document.getElementById('adminDashboardModal');
  const btnCloseAdminModal = document.getElementById('btnCloseAdminModal');
  const btnCloseAdminDashboardBtn = document.getElementById('btnCloseAdminDashboardBtn');
  const adminTotalSessionsCount = document.getElementById('adminTotalSessionsCount');
  const adminActiveSessionsCount = document.getElementById('adminActiveSessionsCount');
  const adminClosedSessionsCount = document.getElementById('adminClosedSessionsCount');
  const adminFilterGroup = document.getElementById('adminFilterGroup');
  const adminSearchInput = document.getElementById('adminSearchInput');
  const adminSessionsTableBody = document.getElementById('adminSessionsTableBody');
  const adminEmptyState = document.getElementById('adminEmptyState');
  const btnOpenAdminAnnouncementModal = document.getElementById('btnOpenAdminAnnouncementModal');
  const btnAdminDashNewAnnouncement = document.getElementById('btnAdminDashNewAnnouncement');

  // Admin Announcement Modal
  const adminAnnouncementModal = document.getElementById('adminAnnouncementModal');
  const btnCloseAnnouncementModal = document.getElementById('btnCloseAnnouncementModal');
  const btnCancelAnnouncement = document.getElementById('btnCancelAnnouncement');
  const adminAnnouncementForm = document.getElementById('adminAnnouncementForm');
  const announcementCategory = document.getElementById('announcementCategory');
  const announcementTag = document.getElementById('announcementTag');
  const announcementTitle = document.getElementById('announcementTitle');
  const btnSubmitAnnouncement = document.getElementById('btnSubmitAnnouncement');
  const adminAnnouncementsList = document.getElementById('adminAnnouncementsList');

  // Club Sessions Management Modal
  const clubSessionsModal = document.getElementById('clubSessionsModal');
  const btnCloseClubMgmtModal = document.getElementById('btnCloseClubMgmtModal');
  const btnCloseClubMgmtBtn = document.getElementById('btnCloseClubMgmtBtn');
  const btnClubMgmtNewSession = document.getElementById('btnClubMgmtNewSession');
  const clubSessionsList = document.getElementById('clubSessionsList');
  const clubMgmtSubtitle = document.getElementById('clubMgmtSubtitle');

  // Edit Event Modal
  const editSessionModal = document.getElementById('editSessionModal');
  const btnCloseEditModal = document.getElementById('btnCloseEditModal');
  const btnCancelEdit = document.getElementById('btnCancelEdit');
  const editEventForm = document.getElementById('editEventForm');
  const editEventId = document.getElementById('editEventId');
  const editEventTitle = document.getElementById('editEventTitle');
  const editEventCategory = document.getElementById('editEventCategory');
  const editEventSpeaker = document.getElementById('editEventSpeaker');
  const editEventCapacity = document.getElementById('editEventCapacity');
  const editEventDateTime = document.getElementById('editEventDateTime');
  const editEventVenue = document.getElementById('editEventVenue');
  const editEventRegLink = document.getElementById('editEventRegLink');
  const editEventDesc = document.getElementById('editEventDesc');

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

  // Ticker
  const tickerTrack = document.getElementById('tickerTrack');

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

  // Detail Modal Interested & Offline Sync
  const btnToggleDetailInterested = document.getElementById('btnToggleDetailInterested');
  const detailInterestedBtnText = document.getElementById('detailInterestedBtnText');
  const detailInterestedCount = document.getElementById('detailInterestedCount');
  const btnGoogleCalendarSync = document.getElementById('btnGoogleCalendarSync');
  const gmailReminderForm = document.getElementById('gmailReminderForm');
  const inputReminderEmail = document.getElementById('inputReminderEmail');
  const selectGmailLeadTime = document.getElementById('selectGmailLeadTime');
  const btnSubmitGmailReminder = document.getElementById('btnSubmitGmailReminder');
  const gmailReminderFeedback = document.getElementById('gmailReminderFeedback');

  // --- INITIALIZATION ---
  async function init() {
    // SECURITY: Sanitize URL immediately.
    // If a user copies a logged-in tab URL or enters malicious query parameters/hashes,
    // strip them completely so credentials/tokens cannot be leaked or injected via URL.
    if (window.location.search || window.location.hash) {
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.warn('URL sanitization fallback:', e);
      }
    }

    loadLocalState();
    updateAuthUI();
    setupEventListeners();
    checkNotificationPermission();

    // Check backend connection, announcements, and fetch events
    await verifyBackendConnection();
    await fetchAnnouncements();
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

    try {
      const rawInterested = localStorage.getItem(STORAGE_KEY_INTERESTED);
      const parsed = rawInterested ? JSON.parse(rawInterested) : [];
      interestedEvents = new Set(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      interestedEvents = new Set();
    }
  }

  function saveInterestedEvents() {
    localStorage.setItem(STORAGE_KEY_INTERESTED, JSON.stringify(Array.from(interestedEvents)));
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

    // SECURITY: Purge any legacy tokens stored in localStorage from older versions
    localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);

    // If token exists in this tab's sessionStorage, verify with server
    if (authToken && serverOnline) {
      try {
        const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await verifyRes.json();
        if (!data.authenticated || !data.user) {
          logoutUser(false);
        } else {
          currentUser = data.user;
          sessionStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(currentUser));
          updateAuthUI();
        }
      } catch (e) {
        console.warn('Auth verify skipped:', e);
      }
    } else if (!authToken) {
      // Unauthenticated tab / copied URL -> enforce guest student mode
      currentUser = null;
      updateAuthUI();
    }
  }

  // --- ANNOUNCEMENTS TICKER API & RENDER ---
  async function fetchAnnouncements() {
    if (serverOnline) {
      try {
        const res = await fetch(`${API_BASE}/announcements`);
        const data = await res.json();
        if (data.success && Array.isArray(data.announcements)) {
          campusAnnouncements = data.announcements.filter((a) => a.active);
          renderAnnouncements();
          return;
        }
      } catch (err) {
        console.warn('Failed to fetch announcements:', err);
      }
    }

    // Default campus notices fallback
    campusAnnouncements = [
      { id: 'ann-1', tag: 'Tarang', category: 'tarang', title: 'Tarang 2026 Theme Revealed: "Aura of Echoes" • Cultural Registrations Live' },
      { id: 'ann-2', tag: 'Senate', category: 'senate', title: 'Student Senate Gymkhana: Academic Slot Allocations for Clubs Finalized for 2026' },
      { id: 'ann-3', tag: 'Abhikalpan', category: 'abhikalpan', title: 'Abhikalpan 2026: Techfest Flagship Hackathon & RoboWars Problem Statements Released' },
      { id: 'ann-4', tag: 'Gusto', category: 'gusto', title: 'Gusto 2026: Inter-IIIT Annual Sports Meet Trials Begin This Weekend' }
    ];
    renderAnnouncements();
  }

  function renderAnnouncements() {
    if (!tickerTrack) return;
    if (!campusAnnouncements || campusAnnouncements.length === 0) {
      tickerTrack.innerHTML = '<div class="ticker-item"><span>🏛️ Welcome to PDPM IIITDM Jabalpur Campus Club Hub</span></div>';
      return;
    }

    // Duplicate array items to create seamless infinite scrolling marquee
    const marqueeItems = [...campusAnnouncements, ...campusAnnouncements];
    tickerTrack.innerHTML = marqueeItems
      .map(
        (a) => `
        <div class="ticker-item">
          <span class="ticker-tag ${escapeHtml(a.category || 'senate')}">${escapeHtml(a.tag || 'Notice')}</span>
          <span>${escapeHtml(a.title)}</span>
          <span class="ticker-separator">&bull;</span>
        </div>
      `
      )
      .join('');
  }

  async function fetchEvents() {
    if (serverOnline) {
      try {
        const res = await fetch(`${API_BASE}/events`);
        const data = await res.json();
        if (data.success && Array.isArray(data.events)) {
          // Public feed only includes active events
          events = data.events.filter((e) => (e.status || 'active') === 'active');
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
        const parsed = JSON.parse(cached);
        events = parsed.filter((e) => (e.status || 'active') === 'active');
      } catch (e) {
        events = getLocalFallbackEvents();
      }
    } else {
      events = getLocalFallbackEvents();
    }
  }

  // --- AUTHENTICATION ACTIONS ---
  async function loginUser(role, username, password) {
    loginErrorMsg.classList.add('hidden');

    if (!username || !password) {
      loginErrorMsg.textContent = 'Please enter both username and password.';
      loginErrorMsg.classList.remove('hidden');
      return false;
    }

    if (serverOnline) {
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, username, password })
        });

        const data = await res.json();
        if (data.success && data.token && data.user) {
          authToken = data.token;
          currentUser = data.user;
          // SECURITY: Save in sessionStorage only (scoped exclusively to this browser tab)
          sessionStorage.setItem(STORAGE_KEY_AUTH_TOKEN, authToken);
          sessionStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(currentUser));
          // Clean legacy localStorage
          localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
          localStorage.removeItem(STORAGE_KEY_AUTH_USER);

          updateAuthUI();
          clubLoginModal.classList.add('hidden');
          clubLoginForm.reset();

          const welcomeMsg = currentUser.role === 'admin'
            ? 'Logged in as Campus Administrator 🛡️'
            : `Welcome back, ${currentUser.name}! 🏛️`;
          const subMsg = currentUser.role === 'admin'
            ? 'You have full management control over campus sessions.'
            : 'You can now publish and manage your club sessions.';

          showToast(welcomeMsg, subMsg, 'toast-success', currentUser.icon || '🔓');
          await fetchEvents();
          renderAll();
          return true;
        } else {
          loginErrorMsg.textContent = data.message || 'Invalid credentials. Please verify your username and password.';
          loginErrorMsg.classList.remove('hidden');
          return false;
        }
      } catch (err) {
        loginErrorMsg.textContent = 'Network error connecting to backend authentication server.';
        loginErrorMsg.classList.remove('hidden');
        return false;
      }
    } else {
      // Offline fallback: authenticates securely without exposed default hints
      loginErrorMsg.textContent = 'Backend server is offline. Please start the backend service to log in.';
      loginErrorMsg.classList.remove('hidden');
      return false;
    }
  }

  function logoutUser(showFeedback = true) {
    if (serverOnline && authToken) {
      fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      }).catch(() => {});
    }

    authToken = null;
    currentUser = null;
    sessionStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_AUTH_USER);
    localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    updateAuthUI();
    renderEvents();

    if (showFeedback) {
      showToast('Logged Out', 'You are now viewing ClubPulse in Student Mode.', 'toast-success', '🔒');
    }
  }

  function updateAuthUI() {
    if (authToken && currentUser) {
      loggedOutView.classList.add('hidden');
      if (currentUser.role === 'admin') {
        loggedInClubView.classList.add('hidden');
        loggedInAdminView.classList.remove('hidden');
      } else {
        loggedInAdminView.classList.add('hidden');
        loggedInClubView.classList.remove('hidden');
        loggedClubName.textContent = currentUser.name;
        loggedClubIcon.textContent = currentUser.icon || '🏛️';
      }
    } else {
      loggedOutView.classList.remove('hidden');
      loggedInClubView.classList.add('hidden');
      loggedInAdminView.classList.add('hidden');
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
      club: currentUser ? currentUser.name : 'The Programming Club',
      category: currentUser ? currentUser.category : 'Technical',
      speaker: eventData.speaker,
      dateTime: eventData.dateTime,
      venue: eventData.venue,
      capacity: eventData.capacity,
      regLink: eventData.regLink,
      description: eventData.description,
      avatar: currentUser ? (currentUser.icon || '🏛️') : '🏛️',
      status: 'active',
      closedBy: null,
      closedReason: null
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
    const isMyClubEvent = currentUser && currentUser.role === 'club' && currentUser.name.toLowerCase() === event.club.toLowerCase();
    const isAdmin = currentUser && currentUser.role === 'admin';

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
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="btn-notify-card ${isSubscribed ? 'subscribed' : ''}" data-action="toggle-reminder" data-id="${event.id}">
              <span class="bell-icon">${isSubscribed ? '✅' : '🔔'}</span>
              <span>${isSubscribed ? 'Reminded' : 'Notify'}</span>
            </button>
            
            <button class="btn-interested ${interestedEvents.has(event.id) ? 'interested-active' : ''}" data-action="toggle-interested" data-id="${event.id}" title="Indicate interest in this session">
              <span class="star-icon">⭐</span>
              <span class="interested-pill-count">${event.interestedCount || 0}</span>
            </button>
          </div>
          
          <div style="display:flex; align-items:center; gap:8px;">
            ${
              isAdmin
                ? `<button class="btn-manage-badge" data-action="admin-manage-card" data-id="${event.id}" title="Manage as Campus Administrator">🛡️ Admin</button>`
                : isMyClubEvent
                ? `<button class="btn-manage-badge" data-action="club-manage-card" data-id="${event.id}" title="Manage this session">⚙️ Manage</button>`
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

    // Interested Toggle
    document.querySelectorAll('.btn-interested').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        toggleEventInterest(btn.getAttribute('data-id'));
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

    // Club Manage Session Button on Card
    document.querySelectorAll('[data-action="club-manage-card"]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openClubSessionsModal();
      };
    });

    // Admin Manage Session Button on Card
    document.querySelectorAll('[data-action="admin-manage-card"]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openAdminDashboard();
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

  // --- INTERESTED REACTION TOGGLE ---
  async function toggleEventInterest(eventId) {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    const isNowInterested = !interestedEvents.has(eventId);
    if (isNowInterested) {
      interestedEvents.add(eventId);
    } else {
      interestedEvents.delete(eventId);
    }
    saveInterestedEvents();

    // Call backend API to persist across campus
    if (serverOnline) {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}/interested`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interested: isNowInterested })
        });
        const data = await res.json();
        if (data.success && typeof data.interestedCount === 'number') {
          event.interestedCount = data.interestedCount;
        }
      } catch (err) {
        console.warn('Could not sync interest with server:', err);
      }
    } else {
      // Local counter simulation
      const current = event.interestedCount || 0;
      event.interestedCount = Math.max(0, isNowInterested ? current + 1 : current - 1);
    }

    renderEvents();
    if (selectedEventForDetail && selectedEventForDetail.id === eventId) {
      updateDetailInterestedUI(event);
    }

    if (isNowInterested) {
      showToast('Marked as Interested! ⭐', `The club organizers will factor your interest into seating and logistics.`, 'toast-success', '⭐');
    } else {
      showToast('Interest Removed', `Removed your interest for "${event.title}".`, 'toast-alert', '⭐');
    }
  }

  function updateDetailInterestedUI(event) {
    if (!btnToggleDetailInterested || !detailInterestedCount) return;
    const isInterested = interestedEvents.has(event.id);
    detailInterestedCount.textContent = event.interestedCount || 0;
    if (isInterested) {
      btnToggleDetailInterested.classList.add('interested-active');
      detailInterestedBtnText.textContent = 'Interested ✓';
    } else {
      btnToggleDetailInterested.classList.remove('interested-active');
      detailInterestedBtnText.textContent = "I'm Interested";
    }
  }

  // --- GOOGLE CALENDAR URL GENERATOR ---
  function getGoogleCalendarUrl(event) {
    const startDate = new Date(event.dateTime);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    const pad = (n) => (n < 10 ? '0' + n : n);
    const toGCalDate = (d) =>
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      'T' +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      '00Z';

    const dates = `${toGCalDate(startDate)}/${toGCalDate(endDate)}`;
    const title = encodeURIComponent(`[IIITDMJ] ${event.club}: ${event.title}`);
    const details = encodeURIComponent(
      `${event.description}\n\nOrganizer: ${event.club}\nSpeaker/Host: ${event.speaker || 'Council'}\nSession on ClubPulse Campus Portal.`
    );
    const location = encodeURIComponent(`${event.venue}, PDPM IIITDM Jabalpur Campus`);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
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

    // Update Interested Button in detail modal
    updateDetailInterestedUI(event);

    // Google Calendar Direct Sync URL
    if (btnGoogleCalendarSync) {
      btnGoogleCalendarSync.href = getGoogleCalendarUrl(event);
    }

    // Reset Gmail feedback
    if (gmailReminderFeedback) {
      gmailReminderFeedback.className = 'gmail-feedback hidden';
      gmailReminderFeedback.textContent = '';
    }

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

  // ==========================================
  // ADMINISTRATOR DASHBOARD
  // ==========================================

  async function openAdminDashboard() {
    if (!currentUser || currentUser.role !== 'admin') {
      showToast('Administrator Access Required', 'Please log in as Campus Administrator.', 'toast-alert', '🛡️');
      return;
    }

    adminDashboardModal.classList.remove('hidden');
    await fetchAdminEvents();
    renderAdminDashboard();
  }

  async function fetchAdminEvents() {
    if (serverOnline && authToken) {
      try {
        const res = await fetch(`${API_BASE}/admin/events`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.events)) {
          adminAllEvents = data.events;
          return;
        }
      } catch (err) {
        console.error('Failed to fetch admin events:', err);
      }
    }
    // Fallback: use all cached events
    adminAllEvents = events.slice();
  }

  function renderAdminDashboard() {
    // 1. Update Metrics
    const totalCount = adminAllEvents.length;
    const activeCount = adminAllEvents.filter((e) => (e.status || 'active') === 'active').length;
    const closedCount = adminAllEvents.filter((e) => e.status === 'closed' && e.closedBy === 'admin').length;

    adminTotalSessionsCount.textContent = totalCount;
    adminActiveSessionsCount.textContent = activeCount;
    adminClosedSessionsCount.textContent = closedCount;

    // 2. Filter list
    let filtered = adminAllEvents.filter((evt) => {
      const status = evt.status || 'active';
      if (adminCurrentFilter === 'active' && status !== 'active') return false;
      if (adminCurrentFilter === 'closed_admin' && (status !== 'closed' || evt.closedBy !== 'admin')) return false;
      if (adminCurrentFilter === 'closed_club' && (status !== 'closed' || evt.closedBy !== 'club')) return false;

      if (adminSearchQuery.trim() !== '') {
        const q = adminSearchQuery.toLowerCase();
        const matchTitle = (evt.title || '').toLowerCase().includes(q);
        const matchClub = (evt.club || '').toLowerCase().includes(q);
        const matchVenue = (evt.venue || '').toLowerCase().includes(q);
        if (!matchTitle && !matchClub && !matchVenue) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      adminSessionsTableBody.innerHTML = '';
      adminEmptyState.classList.remove('hidden');
      return;
    }

    adminEmptyState.classList.add('hidden');
    adminSessionsTableBody.innerHTML = filtered.map((evt) => {
      const status = evt.status || 'active';
      let statusBadge = '';

      if (status === 'closed') {
        if (evt.closedBy === 'admin') {
          statusBadge = '<span class="status-pill status-closed-admin">🔴 Closed by Administrator</span>';
        } else {
          statusBadge = '<span class="status-pill status-closed-club">⚪ Closed by Club</span>';
        }
      } else {
        statusBadge = '<span class="status-pill status-active">🟢 Active on Feed</span>';
      }

      const isActive = status === 'active';

      return `
        <tr data-id="${evt.id}">
          <td>
            <span class="admin-session-title">${escapeHtml(evt.title)}</span>
            <span class="admin-session-cat">${escapeHtml(evt.category || 'General')} &bull; ${evt.capacity > 0 ? evt.capacity + ' seats' : 'Open Entry'}</span>
          </td>
          <td>
            <div class="admin-club-cell">
              <span>${evt.avatar || '🏛️'}</span>
              <span>${escapeHtml(evt.club)}</span>
            </div>
          </td>
          <td>
            <div><strong>${formatDateTime(evt.dateTime)}</strong></div>
            <small style="color:var(--text-muted);">📍 ${escapeHtml(evt.venue)}</small>
          </td>
          <td>
            <div style="font-weight:700; color:#b45309; display:flex; align-items:center; gap:4px;">
              <span>⭐</span> <span>${evt.interestedCount || 0} students</span>
            </div>
          </td>
          <td>
            ${statusBadge}
          </td>
          <td>
            <div class="admin-action-btns">
              <button class="btn-action-view" data-action="admin-row-view" data-id="${evt.id}">Details</button>
              ${
                isActive
                  ? `<button class="btn-action-close" data-action="admin-row-close" data-id="${evt.id}" title="Close session immediately">Close Session</button>`
                  : `<button class="btn-action-reopen" data-action="admin-row-reopen" data-id="${evt.id}" title="Reopen session to active campus feed">Reopen</button>`
              }
              <button class="btn-action-delete" data-action="admin-row-delete" data-id="${evt.id}" title="Permanently delete session">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    attachAdminTableListeners();
  }

  function attachAdminTableListeners() {
    // View Details
    adminSessionsTableBody.querySelectorAll('[data-action="admin-row-view"]').forEach((btn) => {
      btn.onclick = () => {
        const eventId = btn.getAttribute('data-id');
        openDetailModal(eventId);
      };
    });

    // Administrator Force-Close Session
    adminSessionsTableBody.querySelectorAll('[data-action="admin-row-close"]').forEach((btn) => {
      btn.onclick = async () => {
        const eventId = btn.getAttribute('data-id');
        await adminForceCloseSession(eventId);
      };
    });

    // Administrator Reopen Session
    adminSessionsTableBody.querySelectorAll('[data-action="admin-row-reopen"]').forEach((btn) => {
      btn.onclick = async () => {
        const eventId = btn.getAttribute('data-id');
        await adminReopenSession(eventId);
      };
    });

    // Administrator Delete Session
    adminSessionsTableBody.querySelectorAll('[data-action="admin-row-delete"]').forEach((btn) => {
      btn.onclick = async () => {
        const eventId = btn.getAttribute('data-id');
        await adminDeleteSession(eventId);
      };
    });
  }

  async function adminForceCloseSession(eventId) {
    if (serverOnline && authToken) {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}/close`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.success) {
          // Immediately update admin state
          const target = adminAllEvents.find((e) => e.id === eventId);
          if (target) {
            target.status = 'closed';
            target.closedBy = 'admin';
            target.closedReason = 'Closed by Administrator';
          }
          // Immediately remove from active campus feed
          events = events.filter((e) => e.id !== eventId);
          renderAll();
          renderAdminDashboard();
          showToast('Session Closed by Administrator', 'The session was closed and immediately removed from the active campus feed.', 'toast-alert', '🛡️');
          return;
        } else {
          showToast('Error', data.message || 'Could not close session.', 'toast-alert', '❌');
          return;
        }
      } catch (err) {
        console.error('Admin close failed:', err);
      }
    }

    // Local fallback
    const target = adminAllEvents.find((e) => e.id === eventId);
    if (target) {
      target.status = 'closed';
      target.closedBy = 'admin';
    }
    events = events.filter((e) => e.id !== eventId);
    renderAll();
    renderAdminDashboard();
    showToast('Session Closed (Offline)', 'Marked as Closed by Administrator.', 'toast-alert', '🛡️');
  }

  async function adminReopenSession(eventId) {
    if (serverOnline && authToken) {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}/reopen`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.success) {
          const target = adminAllEvents.find((e) => e.id === eventId);
          if (target) {
            target.status = 'active';
            target.closedBy = null;
          }
          await fetchEvents();
          renderAll();
          renderAdminDashboard();
          showToast('Session Reopened', 'The session is now active again on the campus feed.', 'toast-success', '🟢');
          return;
        } else {
          showToast('Error', data.message || 'Could not reopen session.', 'toast-alert', '❌');
          return;
        }
      } catch (err) {
        console.error('Admin reopen failed:', err);
      }
    }

    // Local fallback
    const target = adminAllEvents.find((e) => e.id === eventId);
    if (target) {
      target.status = 'active';
      target.closedBy = null;
      if (!events.some((e) => e.id === target.id)) {
        events.push(target);
      }
    }
    renderAll();
    renderAdminDashboard();
    showToast('Session Reopened (Offline)', 'The session is active again on feed.', 'toast-success', '🟢');
  }

  async function adminDeleteSession(eventId) {
    if (!confirm('Are you sure you want to permanently delete/cancel this campus session?')) return;

    if (serverOnline && authToken) {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.success) {
          adminAllEvents = adminAllEvents.filter((e) => e.id !== eventId);
          events = events.filter((e) => e.id !== eventId);
          renderAll();
          renderAdminDashboard();
          showToast('Session Deleted', 'Session has been permanently removed.', 'toast-success', '🗑️');
          return;
        }
      } catch (err) {
        console.error('Admin delete failed:', err);
      }
    }

    adminAllEvents = adminAllEvents.filter((e) => e.id !== eventId);
    events = events.filter((e) => e.id !== eventId);
    renderAll();
    renderAdminDashboard();
    showToast('Session Removed (Offline)', 'Event deleted locally.', 'toast-success', '🗑️');
  }

  // ==========================================
  // ADMINISTRATOR ANNOUNCEMENT MANAGEMENT
  // ==========================================

  function openAdminAnnouncementModal() {
    if (!currentUser || currentUser.role !== 'admin') {
      showToast('Administrator Access Required', 'Please log in as Campus Administrator.', 'toast-alert', '🛡️');
      return;
    }

    adminAnnouncementForm.reset();
    announcementTag.value = 'CAMPUS NOTICE';
    renderAdminAnnouncements();
    adminAnnouncementModal.classList.remove('hidden');
  }

  function renderAdminAnnouncements() {
    if (!adminAnnouncementsList) return;
    if (!campusAnnouncements || campusAnnouncements.length === 0) {
      adminAnnouncementsList.innerHTML = `
        <div style="font-size:0.82rem; color:var(--text-muted); padding:10px; text-align:center; background:#f8fafc; border-radius:8px;">
          No active announcements. Broadcast your first notice above!
        </div>
      `;
      return;
    }

    adminAnnouncementsList.innerHTML = campusAnnouncements
      .map(
        (a) => `
        <div style="display:flex; align-items:center; justify-content:space-between; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px; flex:1; overflow:hidden;">
            <span class="ticker-tag ${escapeHtml(a.category || 'senate')}">${escapeHtml(a.tag || 'NOTICE')}</span>
            <span style="font-size:0.82rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#0f172a;">${escapeHtml(a.title)}</span>
          </div>
          <button class="btn-action-delete" data-action="delete-announcement" data-id="${a.id}" title="Remove this announcement from marquee" style="padding:4px 8px; font-size:0.75rem;">
            🗑️ Remove
          </button>
        </div>
      `
      )
      .join('');

    adminAnnouncementsList.querySelectorAll('[data-action="delete-announcement"]').forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        await deleteCampusAnnouncement(id);
      };
    });
  }

  async function deleteCampusAnnouncement(id) {
    if (!confirm('Are you sure you want to remove this announcement from the ticker marquee?')) return;

    if (serverOnline && authToken) {
      try {
        const res = await fetch(`${API_BASE}/announcements/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.success) {
          campusAnnouncements = campusAnnouncements.filter((a) => a.id !== id);
          renderAnnouncements();
          renderAdminAnnouncements();
          showToast('Announcement Removed', 'Removed from ticker marquee.', 'toast-success', '🗑️');
          return;
        }
      } catch (err) {
        console.error('Delete announcement error:', err);
      }
    }

    // Local fallback
    campusAnnouncements = campusAnnouncements.filter((a) => a.id !== id);
    renderAnnouncements();
    renderAdminAnnouncements();
    showToast('Announcement Removed (Offline)', 'Removed locally.', 'toast-success', '🗑️');
  }

  // ==========================================
  // CLUB SESSION MANAGEMENT
  // ==========================================

  async function openClubSessionsModal() {
    if (!currentUser || currentUser.role !== 'club') {
      showToast('Club Login Required', 'Please log in with your official club credentials.', 'toast-alert', '🔐');
      return;
    }

    clubMgmtSubtitle.textContent = `Review, edit, or close sessions published by ${currentUser.name}.`;
    clubSessionsModal.classList.remove('hidden');

    let clubEvents = [];
    if (serverOnline && authToken) {
      try {
        const res = await fetch(`${API_BASE}/club/events`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.events)) {
          clubEvents = data.events;
        }
      } catch (err) {
        console.error('Failed to fetch club events:', err);
      }
    }

    if (clubEvents.length === 0) {
      // Fallback
      clubEvents = events.filter((e) => (e.club || '').toLowerCase() === currentUser.name.toLowerCase());
    }

    renderClubSessions(clubEvents);
  }

  function renderClubSessions(clubEvents) {
    if (clubEvents.length === 0) {
      clubSessionsList.innerHTML = `
        <div class="empty-state" style="padding: 30px;">
          <div class="empty-icon">📢</div>
          <h4>No sessions posted by ${escapeHtml(currentUser.name)} yet.</h4>
          <p>Use "Post New Session" to announce workshops or auditions to the campus!</p>
        </div>
      `;
      return;
    }

    clubSessionsList.innerHTML = clubEvents.map((evt) => {
      const status = evt.status || 'active';
      const isClosedByAdmin = status === 'closed' && evt.closedBy === 'admin';
      const isClosedByClub = status === 'closed' && evt.closedBy === 'club';

      let statusPill = '<span class="status-pill status-active">🟢 Active on Feed</span>';
      if (isClosedByAdmin) {
        statusPill = '<span class="status-pill status-closed-admin">🔴 Closed by Administrator</span>';
      } else if (isClosedByClub) {
        statusPill = '<span class="status-pill status-closed-club">⚪ Closed by Club</span>';
      }

      return `
        <div class="club-mgmt-card" data-id="${evt.id}">
          <div class="club-mgmt-info" style="flex:1;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
              <span class="club-mgmt-title">${escapeHtml(evt.title)}</span>
              ${statusPill}
            </div>
            <div class="club-mgmt-meta">
              <span>🕒 ${formatDateTime(evt.dateTime)}</span>
              <span>📍 ${escapeHtml(evt.venue)}</span>
              <span>👤 ${escapeHtml(evt.speaker || 'Club Lead')}</span>
              <span>👥 ${evt.capacity > 0 ? evt.capacity + ' seats limit' : 'Open Entry'}</span>
              <span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-weight:700;">⭐ ${evt.interestedCount || 0} Students Interested</span>
            </div>
            ${
              isClosedByAdmin
                ? `<div class="admin-locked-banner">
                    <span>🔒</span>
                    <span><strong>Administrator Action:</strong> This session was closed by Campus Administration. The club cannot reopen or edit this session without administrator authorization.</span>
                  </div>`
                : ''
            }
          </div>

          <div class="admin-action-btns" style="margin-left: 14px;">
            ${
              isClosedByAdmin
                ? `<button class="btn-action-view" data-action="club-card-view" data-id="${evt.id}">View Details</button>`
                : `
                  <button class="btn-action-edit" data-action="club-card-edit" data-id="${evt.id}">✏️ Edit</button>
                  ${
                    status === 'active'
                      ? `<button class="btn-action-close" data-action="club-card-close" data-id="${evt.id}">Close Session</button>`
                      : `<button class="btn-action-reopen" data-action="club-card-reopen" data-id="${evt.id}">Reopen</button>`
                  }
                  <button class="btn-action-delete" data-action="club-card-delete" data-id="${evt.id}" title="Delete session">🗑️</button>
                `
            }
          </div>
        </div>
      `;
    }).join('');

    attachClubMgmtListeners();
  }

  function attachClubMgmtListeners() {
    // View
    clubSessionsList.querySelectorAll('[data-action="club-card-view"]').forEach((btn) => {
      btn.onclick = () => {
        openDetailModal(btn.getAttribute('data-id'));
      };
    });

    // Edit
    clubSessionsList.querySelectorAll('[data-action="club-card-edit"]').forEach((btn) => {
      btn.onclick = () => {
        openEditSessionModal(btn.getAttribute('data-id'));
      };
    });

    // Close
    clubSessionsList.querySelectorAll('[data-action="club-card-close"]').forEach((btn) => {
      btn.onclick = async () => {
        const eventId = btn.getAttribute('data-id');
        await clubCloseSession(eventId);
      };
    });

    // Reopen
    clubSessionsList.querySelectorAll('[data-action="club-card-reopen"]').forEach((btn) => {
      btn.onclick = async () => {
        const eventId = btn.getAttribute('data-id');
        await clubReopenSession(eventId);
      };
    });

    // Delete
    clubSessionsList.querySelectorAll('[data-action="club-card-delete"]').forEach((btn) => {
      btn.onclick = async () => {
        const eventId = btn.getAttribute('data-id');
        await clubDeleteSession(eventId);
      };
    });
  }

  async function clubCloseSession(eventId) {
    if (serverOnline && authToken) {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}/close`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.success) {
          events = events.filter((e) => e.id !== eventId);
          renderAll();
          await openClubSessionsModal();
          showToast('Session Closed', 'Session has been marked as closed and removed from the active campus feed.', 'toast-success', '⏸️');
          return;
        } else {
          showToast('Error', data.message || 'Could not close session.', 'toast-alert', '❌');
          return;
        }
      } catch (err) {
        console.error('Club close error:', err);
      }
    }
  }

  async function clubReopenSession(eventId) {
    if (serverOnline && authToken) {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}/reopen`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.success) {
          await fetchEvents();
          renderAll();
          await openClubSessionsModal();
          showToast('Session Reopened', 'Session is active again on campus feed.', 'toast-success', '🟢');
          return;
        } else {
          showToast('Reopen Denied', data.message || 'Could not reopen session.', 'toast-alert', '❌');
          return;
        }
      } catch (err) {
        console.error('Club reopen error:', err);
      }
    }
  }

  async function clubDeleteSession(eventId) {
    if (!confirm('Are you sure you want to permanently delete this session?')) return;

    if (serverOnline && authToken) {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.success) {
          events = events.filter((e) => e.id !== eventId);
          renderAll();
          await openClubSessionsModal();
          showToast('Session Deleted', 'Session was removed.', 'toast-success', '🗑️');
          return;
        } else {
          showToast('Error', data.message || 'Could not delete session.', 'toast-alert', '❌');
          return;
        }
      } catch (err) {
        console.error('Club delete error:', err);
      }
    }
  }

  // ==========================================
  // EDIT SESSION MODAL
  // ==========================================

  function openEditSessionModal(eventId) {
    let evt = events.find((e) => e.id === eventId) || adminAllEvents.find((e) => e.id === eventId);
    if (!evt) return;

    editEventId.value = evt.id;
    editEventTitle.value = evt.title || '';
    editEventCategory.value = evt.category || 'Technical';
    editEventSpeaker.value = evt.speaker || '';
    editEventCapacity.value = evt.capacity || 0;
    editEventDateTime.value = evt.dateTime ? evt.dateTime.substring(0, 16) : '';
    editEventVenue.value = evt.venue || '';
    editEventRegLink.value = evt.regLink || '';
    editEventDesc.value = evt.description || '';

    editSessionModal.classList.remove('hidden');
  }

  // ==========================================
  // EVENT LISTENERS INITIALIZATION
  // ==========================================

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

    // --- AUTH ROLE TABS & MODAL ---
    const openLogin = () => {
      loginErrorMsg.classList.add('hidden');
      clubLoginModal.classList.remove('hidden');
    };

    btnOpenLoginModal.onclick = openLogin;
    btnCloseLoginModal.onclick = () => clubLoginModal.classList.add('hidden');
    btnCancelLogin.onclick = () => clubLoginModal.classList.add('hidden');
    clubLoginModal.querySelector('.modal-backdrop').onclick = () => clubLoginModal.classList.add('hidden');

    tabClubLogin.onclick = () => {
      currentLoginTabRole = 'club';
      tabClubLogin.classList.add('active');
      tabAdminLogin.classList.remove('active');
      clubLoginFields.classList.remove('hidden');
      adminLoginFields.classList.add('hidden');
      btnLoginSubmit.textContent = 'Log In as Club';
      loginErrorMsg.classList.add('hidden');
    };

    tabAdminLogin.onclick = () => {
      currentLoginTabRole = 'admin';
      tabAdminLogin.classList.add('active');
      tabClubLogin.classList.remove('active');
      adminLoginFields.classList.remove('hidden');
      clubLoginFields.classList.add('hidden');
      btnLoginSubmit.textContent = 'Log In as Administrator';
      loginErrorMsg.classList.add('hidden');
    };

    btnLogout.onclick = () => logoutUser(true);
    btnAdminLogout.onclick = () => logoutUser(true);

    clubLoginForm.onsubmit = async (e) => {
      e.preventDefault();
      if (currentLoginTabRole === 'club') {
        const clubName = loginClubSelect.value;
        const pass = loginPassword.value;
        await loginUser('club', clubName, pass);
      } else {
        const adminUser = loginAdminUsername.value.trim();
        const adminPass = loginAdminPassword.value;
        await loginUser('admin', adminUser, adminPass);
      }
    };

    // --- POST EVENT HANDLERS ---
    const tryOpenPostModal = () => {
      if (!authToken || !currentUser) {
        showToast('Login Required', 'Please log in to publish a campus event.', 'toast-alert', '🔐');
        openLogin();
        return;
      }

      postingAsClubName.textContent = currentUser.name;
      eventCategory.value = currentUser.category || 'Technical';

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(17, 0, 0, 0);
      const pad = (n) => (n < 10 ? '0' + n : n);
      document.getElementById('eventDateTime').value = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;

      postEventModal.classList.remove('hidden');
    };

    btnOpenPostModal.onclick = tryOpenPostModal;
    btnOpenPostModalAuth.onclick = tryOpenPostModal;
    btnOpenPostModalAdmin.onclick = tryOpenPostModal;
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
        category: currentUser ? (currentUser.category || 'Technical') : 'Technical'
      };

      const success = await publishSession(eventData);
      if (success) {
        postEventForm.reset();
        postEventModal.classList.add('hidden');
      }
    };

    // --- ADMIN DASHBOARD HANDLERS ---
    btnOpenAdminDashboard.onclick = openAdminDashboard;
    btnCloseAdminModal.onclick = () => adminDashboardModal.classList.add('hidden');
    btnCloseAdminDashboardBtn.onclick = () => adminDashboardModal.classList.add('hidden');
    adminDashboardModal.querySelector('.modal-backdrop').onclick = () => adminDashboardModal.classList.add('hidden');

    adminFilterGroup.addEventListener('click', (e) => {
      const pill = e.target.closest('.admin-filter-pill');
      if (!pill) return;
      adminFilterGroup.querySelectorAll('.admin-filter-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      adminCurrentFilter = pill.getAttribute('data-filter');
      renderAdminDashboard();
    });

    adminSearchInput.oninput = (e) => {
      adminSearchQuery = e.target.value;
      renderAdminDashboard();
    };

    // --- ADMIN ANNOUNCEMENT MODAL HANDLERS ---
    btnOpenAdminAnnouncementModal.onclick = openAdminAnnouncementModal;
    btnAdminDashNewAnnouncement.onclick = openAdminAnnouncementModal;
    btnCloseAnnouncementModal.onclick = () => adminAnnouncementModal.classList.add('hidden');
    btnCancelAnnouncement.onclick = () => adminAnnouncementModal.classList.add('hidden');
    adminAnnouncementModal.querySelector('.modal-backdrop').onclick = () => adminAnnouncementModal.classList.add('hidden');

    adminAnnouncementForm.onsubmit = async (e) => {
      e.preventDefault();
      const titleVal = announcementTitle.value.trim();
      const catVal = announcementCategory.value;
      const tagVal = announcementTag.value.trim().toUpperCase() || 'CAMPUS NOTICE';

      if (!titleVal) {
        showToast('Required', 'Please enter announcement message.', 'toast-alert', '⚠️');
        return;
      }

      btnSubmitAnnouncement.disabled = true;
      btnSubmitAnnouncement.textContent = 'Broadcasting...';

      if (serverOnline && authToken) {
        try {
          const res = await fetch(`${API_BASE}/announcements`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({
              title: titleVal,
              category: catVal,
              tag: tagVal
            })
          });

          const data = await res.json();
          if (data.success && data.announcement) {
            campusAnnouncements.unshift(data.announcement);
            renderAnnouncements();
            renderAdminAnnouncements();
            adminAnnouncementForm.reset();
            announcementTag.value = 'CAMPUS NOTICE';
            showToast('Announcement Published! 📢', 'Broadcast live to campus sliding ticker bar.', 'toast-success', '📢');
            btnSubmitAnnouncement.disabled = false;
            btnSubmitAnnouncement.textContent = '🚀 Broadcast to Marquee';
            return;
          } else {
            showToast('Failed', data.message || 'Could not publish announcement.', 'toast-alert', '❌');
          }
        } catch (err) {
          console.error('Submit announcement error:', err);
          showToast('Error', 'Server connection failed.', 'toast-alert', '❌');
        }
      } else {
        // Local simulation fallback
        const localAnn = {
          id: `ann-${Date.now()}`,
          category: catVal,
          tag: tagVal,
          title: titleVal,
          active: true,
          date: new Date().toISOString().split('T')[0]
        };
        campusAnnouncements.unshift(localAnn);
        renderAnnouncements();
        renderAdminAnnouncements();
        adminAnnouncementForm.reset();
        announcementTag.value = 'CAMPUS NOTICE';
        showToast('Announcement Published (Offline)', 'Added to local sliding ticker.', 'toast-success', '📢');
      }

      btnSubmitAnnouncement.disabled = false;
      btnSubmitAnnouncement.textContent = '🚀 Broadcast to Marquee';
    };

    // --- CLUB SESSIONS MODAL HANDLERS ---
    btnOpenClubManageModal.onclick = openClubSessionsModal;
    btnCloseClubMgmtModal.onclick = () => clubSessionsModal.classList.add('hidden');
    btnCloseClubMgmtBtn.onclick = () => clubSessionsModal.classList.add('hidden');
    clubSessionsModal.querySelector('.modal-backdrop').onclick = () => clubSessionsModal.classList.add('hidden');
    btnClubMgmtNewSession.onclick = () => {
      clubSessionsModal.classList.add('hidden');
      tryOpenPostModal();
    };

    // --- EDIT SESSION FORM HANDLER ---
    btnCloseEditModal.onclick = () => editSessionModal.classList.add('hidden');
    btnCancelEdit.onclick = () => editSessionModal.classList.add('hidden');
    editSessionModal.querySelector('.modal-backdrop').onclick = () => editSessionModal.classList.add('hidden');

    editEventForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = editEventId.value;
      const updatePayload = {
        title: editEventTitle.value.trim(),
        category: editEventCategory.value,
        speaker: editEventSpeaker.value.trim(),
        capacity: parseInt(editEventCapacity.value, 10) || 0,
        dateTime: editEventDateTime.value,
        venue: editEventVenue.value.trim(),
        regLink: editEventRegLink.value.trim(),
        description: editEventDesc.value.trim()
      };

      if (serverOnline && authToken) {
        try {
          const res = await fetch(`${API_BASE}/events/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify(updatePayload)
          });
          const data = await res.json();
          if (data.success) {
            editSessionModal.classList.add('hidden');
            await fetchEvents();
            renderAll();
            if (!adminDashboardModal.classList.contains('hidden')) {
              await fetchAdminEvents();
              renderAdminDashboard();
            }
            if (!clubSessionsModal.classList.contains('hidden')) {
              await openClubSessionsModal();
            }
            showToast('Session Updated', `"${updatePayload.title}" updated successfully.`, 'toast-success', '✏️');
            return;
          } else {
            showToast('Update Failed', data.message || 'Could not update session.', 'toast-alert', '❌');
            return;
          }
        } catch (err) {
          console.error('Update session failed:', err);
        }
      }

      // Local fallback
      const ev = events.find((item) => item.id === id);
      if (ev) Object.assign(ev, updatePayload);
      editSessionModal.classList.add('hidden');
      renderAll();
      showToast('Session Updated (Offline)', 'Saved locally.', 'toast-success', '✏️');
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

    // Toggle Interested inside Details Modal
    btnToggleDetailInterested.onclick = () => {
      if (selectedEventForDetail) {
        toggleEventInterest(selectedEventForDetail.id);
      }
    };

    // Submit Gmail / Email Reminder
    gmailReminderForm.onsubmit = async (e) => {
      e.preventDefault();
      if (!selectedEventForDetail) return;

      const email = inputReminderEmail.value.trim();
      const leadMinutes = parseInt(selectGmailLeadTime.value, 10) || 60;

      if (!email || !email.includes('@')) {
        gmailReminderFeedback.className = 'gmail-feedback error';
        gmailReminderFeedback.textContent = 'Please provide a valid Gmail/email address.';
        gmailReminderFeedback.classList.remove('hidden');
        return;
      }

      btnSubmitGmailReminder.disabled = true;
      btnSubmitGmailReminder.textContent = 'Scheduling...';

      if (serverOnline) {
        try {
          const res = await fetch(`${API_BASE}/reminders/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventId: selectedEventForDetail.id,
              email: email,
              leadMinutes: leadMinutes
            })
          });

          const data = await res.json();
          if (data.success) {
            gmailReminderFeedback.className = 'gmail-feedback success';
            gmailReminderFeedback.innerHTML = `
              <div><strong>✅ Queued:</strong> Reminder logged for <strong>${escapeHtml(email)}</strong> (${formatLeadTimeText(leadMinutes)} before).</div>
              <div style="margin-top:6px; font-size:0.78rem;">📲 <strong>Want instant alerts on your phone right now?</strong> Click the <em>"📅 Instant 1-Click Google Calendar &amp; Gmail Sync"</em> button above!</div>
            `;
            gmailReminderFeedback.classList.remove('hidden');
            showToast('Reminder Queued! ✉️', `Alert queued for ${email}. Sync Google Calendar for instant phone alarms!`, 'toast-success', '✉️');
            inputReminderEmail.value = '';
          } else {
            gmailReminderFeedback.className = 'gmail-feedback error';
            gmailReminderFeedback.textContent = data.message || 'Failed to schedule reminder.';
            gmailReminderFeedback.classList.remove('hidden');
          }
        } catch (err) {
          console.error('Gmail reminder error:', err);
          gmailReminderFeedback.className = 'gmail-feedback error';
          gmailReminderFeedback.textContent = 'Server error. Please try again.';
          gmailReminderFeedback.classList.remove('hidden');
        } finally {
          btnSubmitGmailReminder.disabled = false;
          btnSubmitGmailReminder.textContent = '📧 Queue Email Reminder';
        }
      } else {
        // Offline simulation
        gmailReminderFeedback.className = 'gmail-feedback success';
        gmailReminderFeedback.innerHTML = `
          <div><strong>✅ Queued (Offline):</strong> Reminder saved for <strong>${escapeHtml(email)}</strong> (${formatLeadTimeText(leadMinutes)} before).</div>
          <div style="margin-top:6px; font-size:0.78rem;">📲 Click the <em>"📅 Instant 1-Click Google Calendar &amp; Gmail Sync"</em> button above to sync alarms directly to your Google account!</div>
        `;
        gmailReminderFeedback.classList.remove('hidden');
        showToast('Reminder Saved', `Alert queued for ${email}`, 'toast-success', '✉️');
        btnSubmitGmailReminder.disabled = false;
        btnSubmitGmailReminder.textContent = '📧 Queue Email Reminder';
        inputReminderEmail.value = '';
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
