const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    const s = document.documentElement.style;
    s.setProperty('--bg', tg.backgroundColor || '#ffffff');
    s.setProperty('--text', tg.textColor || '#000000');
    s.setProperty('--button', tg.buttonColor || '#3390ec');
    s.setProperty('--button-text', tg.buttonTextColor || '#ffffff');
    s.setProperty('--hint', tg.hintColor || '#999999');
    s.setProperty('--secondary-bg', tg.secondaryBackgroundColor || '#f0f0f0');
}
// ===== Хранилище =====
const cloudAvailable = !!(tg?.CloudStorage &&
    typeof tg.CloudStorage.getItem === 'function' &&
    typeof tg.CloudStorage.setItem === 'function');
function isLSAvailable() {
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; }
    catch (e) { return false; }
}
const lsAvailable = isLSAvailable();
console.log('cloud:', cloudAvailable, 'ls:', lsAvailable);
function cloudGet(key) {
    return new Promise((resolve) => {
        if (!cloudAvailable) return resolve(null);
        try {
            tg.CloudStorage.getItem(key, (err, val) => {
                if (err) { console.warn('cloud get err', err); return resolve(null); }
                resolve(val || null);
            });
        } catch (e) { console.warn(e); resolve(null); }
    });
}
function cloudSet(key, val) {
    return new Promise((resolve) => {
        if (!cloudAvailable) return resolve(false);
        try {
            tg.CloudStorage.setItem(key, val, (err, ok) => {
                if (err) { console.warn('cloud set err', err); return resolve(false); }
                resolve(!!ok);
            });
        } catch (e) { console.warn(e); resolve(false); }
    });
}
function cloudRemove(key) {
    return new Promise((resolve) => {
        if (!cloudAvailable) return resolve(false);
        try { tg.CloudStorage.removeItem(key, (err) => resolve(!err)); }
        catch (e) { resolve(false); }
    });
}
async function loadData(key) {
    if (cloudAvailable) {
        const v = await cloudGet(key);
        if (v !== null) {
            if (lsAvailable) localStorage.setItem(key, v);
            return v;
        }
    }
    return lsAvailable ? localStorage.getItem(key) : null;
}
async function saveData(key, value) {
    if (lsAvailable) localStorage.setItem(key, value);
    if (cloudAvailable) await cloudSet(key, value);
}
async function removeData(key) {
    if (lsAvailable) localStorage.removeItem(key);
    if (cloudAvailable) await cloudRemove(key);
}
// ===== DOM =====
const $ = (id) => document.getElementById(id);
const screenLoading = $('screen-loading');
const screenWelcome = $('screen-welcome');
const screenSetup = $('screen-setup');
const screenTracker = $('screen-tracker');
const screenSettings = $('screen-settings');
const welcomeTitle = $('welcome-title');
const customBlock = $('custom-block');
const customInput = $('custom-input');
const setupCustomBlock = $('setup-custom-block');
const setupNameInput = $('setup-name-input');
const emojiPicker = $('emoji-picker');
const habitLabel = $('habit-label');
const lastUseDatetime = $('last-use-datetime');
const dailyCostInput = $('daily-cost-input');
const cigPerDayInput = $('cig-per-day-input');
const cigPackCostInput = $('cig-pack-cost-input');
const vapeMonthlyCostInput = $('vape-monthly-cost-input');
const habitsContainer = $('habits-container');
const settingsListContainer = $('settings-list-container');
const totalMoneyEl = $('total-money');
const confirmModal = $('confirm-modal');
const confirmYes = $('confirm-yes');
const confirmNo = $('confirm-no');
const setupSaveBtn = $('setup-save-btn');
const setupBackBtn = $('setup-back-btn');
let habits = [];
let timerInterval = null;
let timerElements = [];
let userName = 'Друг';
let currentSetupHabit = null;
let fromSettings = false;
let editingHabitId = null;
let pendingResetId = null;
let selectedEmoji = '🎯';
const defaultEmojis = ['🚬', '💨', '🍺', '🍷', '🎮', '📱', '🍔', '💊', '🎯', '🏃', '📚', '💤'];
// ===== Экраны =====
function showScreen(name) {
    [screenLoading, screenWelcome, screenSetup, screenTracker, screenSettings]
        .forEach(s => s.classList.remove('active'));
    ({
        loading: screenLoading, welcome: screenWelcome, setup: screenSetup,
        tracker: screenTracker, settings: screenSettings
    })[name].classList.add('active');
    if (tg?.BackButton) {
        (name === 'setup' || name === 'settings') ? tg.BackButton.show() : tg.BackButton.hide();
    }
}
function goToWelcome() { showScreen('welcome'); customBlock.style.display = 'none'; }
function goToTracker() { renderHabits(); updateAllTimers();
