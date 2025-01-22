import { formatTime, getCurrentTab } from './utils.js';

let currentTab = 'dashboard';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  setupTabNavigation();
  await loadDashboard();
  setupBlocklist();
  setupReports();
});

function setupTabNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  // Update active tab button
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update active content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === tabName);
  });

  currentTab = tabName;
}

async function loadDashboard() {
  const stats = await chrome.storage.local.get(['todayStats']);
  const productiveTime = document.getElementById('productive-time');
  const distractingTime = document.getElementById('distracting-time');
  const currentSite = document.getElementById('current-site');

  if (stats.todayStats) {
    productiveTime.textContent = formatTime(stats.todayStats.productiveTime || 0);
    distractingTime.textContent = formatTime(stats.todayStats.distractingTime || 0);
  }

  const tab = await getCurrentTab();
  if (tab && tab.url) {
    const hostname = new URL(tab.url).hostname;
    currentSite.textContent = `Current site: ${hostname}`;
  }
}

function setupBlocklist() {
  const addSiteBtn = document.getElementById('add-site');
  const newSiteInput = document.getElementById('new-site');

  // Add site on button click
  addSiteBtn.addEventListener('click', () => addBlockedSite());

  // Add site on Enter key
  newSiteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addBlockedSite();
    }
  });

  updateBlockedSitesList();
}

async function addBlockedSite() {
  const newSiteInput = document.getElementById('new-site');
  let site = newSiteInput.value.trim();
  
  if (site) {
    // Remove protocol and www if present
    site = site.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    
    const { blockedSites = [] } = await chrome.storage.local.get(['blockedSites']);
    
    // Check if site is already blocked
    if (!blockedSites.includes(site)) {
      blockedSites.push(site);
      await chrome.storage.local.set({ blockedSites });
      updateBlockedSitesList();
    }
    
    newSiteInput.value = '';
  }
}

async function updateBlockedSitesList() {
  const blockedSitesList = document.getElementById('blocked-sites');
  const { blockedSites = [] } = await chrome.storage.local.get(['blockedSites']);

  blockedSitesList.innerHTML = '';
  blockedSites.forEach(site => {
    const li = document.createElement('li');
    li.className = 'blocked-site';
    li.innerHTML = `
      <span>${site}</span>
      <button class="remove-site" data-site="${site}">Remove</button>
    `;
    blockedSitesList.appendChild(li);
  });

  // Add remove handlers
  document.querySelectorAll('.remove-site').forEach(btn => {
    btn.addEventListener('click', async () => {
      const site = btn.dataset.site;
      const { blockedSites = [] } = await chrome.storage.local.get(['blockedSites']);
      const updatedSites = blockedSites.filter(s => s !== site);
      await chrome.storage.local.set({ blockedSites: updatedSites });
      updateBlockedSitesList();
    });
  });
}

function setupReports() {
  const selectedDate = document.getElementById('selected-date');
  const prevDay = document.getElementById('prev-day');
  const nextDay = document.getElementById('next-day');

  let currentDate = new Date();
  updateDateDisplay();

  prevDay.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1);
    updateDateDisplay();
    loadReportData();
  });

  nextDay.addEventListener('click', () => {
    const today = new Date();
    if (currentDate < today) {
      currentDate.setDate(currentDate.getDate() + 1);
      updateDateDisplay();
      loadReportData();
    }
  });

  function updateDateDisplay() {
    selectedDate.textContent = currentDate.toLocaleDateString();
    loadReportData();
  }

  async function loadReportData() {
    const dateKey = currentDate.toISOString().split('T')[0];
    const { dailyStats = {} } = await chrome.storage.local.get(['dailyStats']);
    const dayStats = dailyStats[dateKey] || { sites: {} };

    // Update chart and breakdown
    updateChart(dayStats);
    updateSiteBreakdown(dayStats);
  }
}

function updateChart(dayStats) {
  const chartContainer = document.getElementById('daily-chart');
  // Implement chart visualization using the dayStats data
  // You could use a library like Chart.js here, or create a simple visualization
}

function updateSiteBreakdown(dayStats) {
  const breakdownContainer = document.getElementById('site-breakdown');
  const sites = Object.entries(dayStats.sites || {})
    .sort(([, a], [, b]) => b.duration - a.duration);

  breakdownContainer.innerHTML = `
    <h3>Site Breakdown</h3>
    ${sites.map(([site, data]) => `
      <div class="site-stat">
        <span>${site}</span>
        <span>${formatTime(data.duration)}</span>
      </div>
    `).join('')}
  `;
}