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
        let done = false;
        const finish = (v) => { if (!done) { done = true; resolve(v); } };
        const timer = setTimeout(() => { console.warn('cloudGet timeout', key); finish(null); }, 3000);
        try {
            tg.CloudStorage.getItem(key, (err, val) => {
                clearTimeout(timer);
                if (err) { console.warn('cloud get err', err); return finish(null); }
                finish(val || null);
            });
        } catch (e) { clearTimeout(timer); console.warn(e); finish(null); }
    });
}
function cloudSet(key, val) {
    return new Promise((resolve) => {
        if (!cloudAvailable) return resolve(false);
        let done = false;
        const finish = (r) => { if (!done) { done = true; resolve(r); } };
        const timer = setTimeout(() => finish(false), 3000);
        try {
            tg.CloudStorage.setItem(key, val, (err, ok) => {
                clearTimeout(timer);
                if (err) { console.warn('cloud set err', err); return finish(false); }
                finish(!!ok);
            });
        } catch (e) { clearTimeout(timer); finish(false); }
    });
}
function cloudRemove(key) {
    return new Promise((resolve) => {
        if (!cloudAvailable) return resolve(false);
        let done = false;
        const finish = (r) => { if (!done) { done = true; resolve(r); } };
        const timer = setTimeout(() => finish(false), 3000);
        try {
            tg.CloudStorage.removeItem(key, (err) => { clearTimeout(timer); finish(!err); });
        } catch (e) { clearTimeout(timer); finish(false); }
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
function showScreen(name) {
    [screenLoading, screenWelcome, screenSetup, screenTracker, screenSettings]
        .forEach(sc => sc.classList.remove('active'));
    ({ loading: screenLoading, welcome: screenWelcome, setup: screenSetup,
       tracker: screenTracker, settings: screenSettings })[name].classList.add('active');
    if (tg?.BackButton) {
        (name === 'setup' || name === 'settings') ? tg.BackButton.show() : tg.BackButton.hide();
    }
}
function goToWelcome() { showScreen('welcome'); customBlock.style.display = 'none'; }
function goToTracker() { renderHabits(); updateAllTimers(); showScreen('tracker'); }
if (tg?.BackButton) {
    tg.BackButton.onClick(() => {
        if (screenSetup.classList.contains('active')) {
            if (fromSettings) { showScreen('settings'); renderSettingsList(); }
            else goToWelcome();
        } else if (screenSettings.classList.contains('active')) {
            goToTracker();
        }
    });
}
function resolveUserName() {
    if (tg?.initDataUnsafe?.user) {
        userName = tg.initDataUnsafe.user.first_name || tg.initDataUnsafe.user.username || 'Друг';
    } else { userName = 'Друг'; }
    welcomeTitle.textContent = 'Привет, ' + userName + '!';
}
function renderEmojiPicker(selected = '🎯') {
    selectedEmoji = selected;
    emojiPicker.innerHTML = '';
    defaultEmojis.forEach(emoji => {
        const span = document.createElement('span');
        span.className = 'emoji-option' + (emoji === selected ? ' selected' : '');
        span.textContent = emoji;
        span.addEventListener('click', () => renderEmojiPicker(emoji));
        emojiPicker.appendChild(span);
    });
}
function setDefaultDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    lastUseDatetime.value = now.toISOString().slice(0, 16);
}
function fillDateTime(ts) {
    const d = new Date(ts);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    lastUseDatetime.value = d.toISOString().slice(0, 16);
}
function clearSetupFields() {
    setupNameInput.value = '';
    dailyCostInput.value = '0';
    cigPerDayInput.value = '';
    cigPackCostInput.value = '';
    vapeMonthlyCostInput.value = '';
    $('cigarettes-cost-fields').style.display = 'none';
    $('vape-cost-fields').style.display = 'none';
    $('cost-block').style.display = 'block';
    habitLabel.style.display = 'none';
    setupCustomBlock.style.display = 'none';
    selectedEmoji = '🎯';
    renderEmojiPicker('🎯');
}
function selectHabit(type) {
    fromSettings = false; editingHabitId = null;
    const names = { cigarettes: 'Сигареты', vape: 'Вейп' };
    const icons = { cigarettes: '🚬', vape: '💨' };
    currentSetupHabit = { type, name: names[type] || type, icon: icons[type] || '🎯' };
    $('setup-title').textContent = 'Добавление';
    clearSetupFields();
    if (type === 'cigarettes') { $('cigarettes-cost-fields').style.display = 'block'; $('cost-block').style.display = 'none'; }
    else if (type === 'vape') { $('vape-cost-fields').style.display = 'block'; $('cost-block').style.display = 'none'; }
    if (type !== 'custom') {
        habitLabel.style.display = 'block';
        habitLabel.textContent = 'Привычка: ' + currentSetupHabit.icon + ' ' + currentSetupHabit.name;
    }
    setupSaveBtn.textContent = '➕ Добавить привычку';
    setupBackBtn.onclick = () => goToWelcome();
    showScreen('setup'); setDefaultDateTime();
}
function openSetupFromSettings() {
    fromSettings = true; editingHabitId = null; currentSetupHabit = null;
    $('setup-title').textContent = 'Новая привычка';
    clearSetupFields();
    setupCustomBlock.style.display = 'block';
    $('cost-block').style.display = 'block';
    setupSaveBtn.textContent = '➕ Добавить привычку';
    setupBackBtn.onclick = () => { showScreen('settings'); renderSettingsList(); };
    showScreen('setup'); setDefaultDateTime();
}
function openEditHabit(habit) {
    fromSettings = true; editingHabitId = habit.id; currentSetupHabit = { ...habit };
    $('setup-title').textContent = 'Редактирование';
    clearSetupFields();
    setupCustomBlock.style.display = 'block';
    $('cost-block').style.display = 'block';
    setupNameInput.value = habit.name;
    renderEmojiPicker(habit.icon);
    dailyCostInput.value = habit.costPerDay || 0;
    fillDateTime(habit.startTime);
    setupSaveBtn.textContent = '💾 Сохранить';
    setupBackBtn.onclick = () => { showScreen('settings'); renderSettingsList(); };
    showScreen('setup');
}
function showCustomInput() { customBlock.style.display = 'block'; customInput.focus(); }
function confirmCustom() {
    const val = customInput.value.trim();
    if (!val) return alert('Введи название привычки');
    fromSettings = false; editingHabitId = null;
    currentSetupHabit = { type: 'custom', name: val, icon: '🎯' };
    $('setup-title').textContent = 'Добавление';
    clearSetupFields();
    setupCustomBlock.style.display = 'block';
    setupNameInput.value = val;
    renderEmojiPicker('🎯');
    $('cost-block').style.display = 'block';
    setupSaveBtn.textContent = '➕ Добавить привычку';
    setupBackBtn.onclick = () => goToWelcome();
    showScreen('setup'); setDefaultDateTime();
}
async function saveHabitFromSetup() {
    const dtValue = lastUseDatetime.value;
    if (!dtValue) return alert('Укажи дату и время');
    let name, icon, costPerDay = 0;
    if (editingHabitId) {
        name = setupNameInput.value.trim();
        if (!name) return alert('Введи название');
        icon = selectedEmoji || '🎯';
        costPerDay = parseFloat(dailyCostInput.value) || 0;
    } else if (currentSetupHabit?.type === 'cigarettes') {
        name = 'Сигареты'; icon = '🚬';
        costPerDay = ((parseFloat(cigPerDayInput.value) || 0) / 20) * (parseFloat(cigPackCostInput.value) || 0);
    } else if (currentSetupHabit?.type === 'vape') {
        name = 'Вейп'; icon = '💨';
        costPerDay = (parseFloat(vapeMonthlyCostInput.value) || 0) / 30;
    } else {
        name = setupNameInput.value.trim();
        if (!name) return alert('Введи название привычки');
        icon = selectedEmoji || '🎯';
        costPerDay = parseFloat(dailyCostInput.value) || 0;
    }
    const startTime = new Date(dtValue).getTime();
    if (isNaN(startTime)) return alert('Неверная дата/время');
    if (startTime > Date.now()) return alert('Дата не может быть в будущем!');
    const habitData = { id: editingHabitId || Date.now(), type: 'custom', name, icon, startTime, costPerDay };
    if (editingHabitId) {
        const idx = habits.findIndex(h => h.id === editingHabitId);
        if (idx !== -1) habits[idx] = habitData;
    } else { habits.push(habitData); }
    await saveHabits();
    goToTracker();
}
function resetHabit(id) { pendingResetId = id; confirmModal.style.display = 'flex'; }
confirmYes.addEventListener('click', async () => {
    if (pendingResetId !== null) {
        const habit = habits.find(h => h.id === pendingResetId);
        if (habit) { habit.startTime = Date.now(); await saveHabits(); renderHabits(); updateAllTimers(); }
        pendingResetId = null;
    }
    confirmModal.style.display = 'none';
});
confirmNo.addEventListener('click', () => { pendingResetId = null; confirmModal.style.display = 'none'; });
async function deleteHabit(id) {
    if (!confirm('Точно удалить эту привычку?')) return;
    habits = habits.filter(h => h.id !== id);
    await saveHabits();
    renderSettingsList(); renderHabits(); updateAllTimers();
    if (habits.length === 0 && timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}
function formatTimeDiff(ms) {
    const t = Math.floor(ms / 1000);
    return `${Math.floor(t/86400)}д ${Math.floor((t%86400)/3600)}ч ${Math.floor((t%3600)/60)}м ${t%60}с`;
}
function getAchievement(days) {
    if (days >= 365) return '🏆 Год без!';
    if (days >= 180) return '🎉 Полгода!';
    if (days >= 90) return '💪 3 месяца!';
    if (days >= 30) return '🌟 Месяц!';
    if (days >= 7) return '🔥 Неделя!';
    if (days >= 1) return '👍 1 день!';
    return '';
}
function renderHabits() {
    if (habits.length === 0) {
        habitsContainer.innerHTML = '<p style="margin-top:20px;">У тебя пока нет привычек. Добавь их в настройках!</p>';
        totalMoneyEl.textContent = ''; timerElements = []; return;
    }
    habitsContainer.innerHTML = ''; timerElements = [];
    habits.forEach(h => {
        const diff = Math.max(0, Date.now() - h.startTime);
        const days = Math.floor(diff / 86400000);
        const moneySaved = (h.costPerDay || 0) * days;
        const achievement = getAchievement(days);
        const card = document.createElement('div'); card.className = 'habit-card';
        const iconDiv = document.createElement('div'); iconDiv.className = 'icon';
        iconDiv.style.fontSize = '32px'; iconDiv.style.marginBottom = '5px'; iconDiv.textContent = h.icon;
        const nameDiv = document.createElement('div'); nameD
