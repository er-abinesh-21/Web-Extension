import { getCurrentTab } from './utils.js';

// Initialize tracking data
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    blockedSites: [],
    todayStats: {
      productiveTime: 0,
      distractingTime: 0,
      lastUpdate: Date.now()
    },
    dailyStats: {}
  });
});

// Track active tab time
let lastActiveTime = Date.now();
let currentTabId = null;

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const now = Date.now();
  if (currentTabId) {
    await updateTimeTracking(currentTabId, now - lastActiveTime);
  }
  currentTabId = activeInfo.tabId;
  lastActiveTime = now;
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const now = Date.now();
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    if (currentTabId) {
      await updateTimeTracking(currentTabId, now - lastActiveTime);
      currentTabId = null;
    }
  } else {
    const tab = await getCurrentTab();
    if (tab) {
      if (currentTabId) {
        await updateTimeTracking(currentTabId, now - lastActiveTime);
      }
      currentTabId = tab.id;
      lastActiveTime = now;
    }
  }
});

// Block distracting sites
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only check when the URL has changed and is loaded
  if (changeInfo.status === 'loading' && changeInfo.url) {
    const { blockedSites = [] } = await chrome.storage.local.get(['blockedSites']);
    const url = new URL(changeInfo.url);
    const hostname = url.hostname;
    
    // Check if the hostname matches any blocked site
    const isBlocked = blockedSites.some(site => {
      // Remove any protocol, www, and trailing slashes for comparison
      const cleanSite = site.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
      const cleanHostname = hostname.replace(/^(www\.)?/, '');
      return cleanHostname.includes(cleanSite);
    });

    if (isBlocked) {
      chrome.tabs.update(tabId, {
        url: chrome.runtime.getURL('blocked.html')
      });
    }
  }
});

// Also check on navigation
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId === 0) { // Only check main frame
    const { blockedSites = [] } = await chrome.storage.local.get(['blockedSites']);
    const url = new URL(details.url);
    const hostname = url.hostname;
    
    // Check if the hostname matches any blocked site
    const isBlocked = blockedSites.some(site => {
      const cleanSite = site.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
      const cleanHostname = hostname.replace(/^(www\.)?/, '');
      return cleanHostname.includes(cleanSite);
    });

    if (isBlocked) {
      chrome.tabs.update(details.tabId, {
        url: chrome.runtime.getURL('blocked.html')
      });
    }
  }
});

// Update statistics
async function updateTimeTracking(tabId, duration) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return;

    const hostname = new URL(tab.url).hostname;
    const { blockedSites = [], todayStats = {}, dailyStats = {} } = 
      await chrome.storage.local.get(['blockedSites', 'todayStats', 'dailyStats']);

    const isDistracting = blockedSites.some(site => {
      const cleanSite = site.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
      const cleanHostname = hostname.replace(/^(www\.)?/, '');
      return cleanHostname.includes(cleanSite);
    });
    const today = new Date().toISOString().split('T')[0];

    // Update today's stats
    if (!todayStats.lastUpdate || new Date(todayStats.lastUpdate).toISOString().split('T')[0] !== today) {
      // Reset stats for new day
      todayStats.productiveTime = 0;
      todayStats.distractingTime = 0;
    }

    if (isDistracting) {
      todayStats.distractingTime = (todayStats.distractingTime || 0) + duration;
    } else {
      todayStats.productiveTime = (todayStats.productiveTime || 0) + duration;
    }
    todayStats.lastUpdate = Date.now();

    // Update daily stats
    if (!dailyStats[today]) {
      dailyStats[today] = { sites: {} };
    }
    if (!dailyStats[today].sites[hostname]) {
      dailyStats[today].sites[hostname] = { duration: 0, isDistracting };
    }
    dailyStats[today].sites[hostname].duration += duration;

    await chrome.storage.local.set({ todayStats, dailyStats });
  } catch (error) {
    console.error('Error updating time tracking:', error);
  }
}