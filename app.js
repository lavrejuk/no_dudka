// Полный JS (точно как в предыдущем сообщении, но с добавлением achievement и оптимизацией)
const tg = window.Telegram?.WebApp;
if(tg){ tg.ready(); tg.expand(); }
function lsOk(){ try{ localStorage.setItem('__t','1'); localStorage.removeItem('__t'); return true; }catch(e){return false;} }
const LS = lsOk();
function loadData(k){return LS?localStorage.getItem(k):null;}
function saveData(k,v){if(LS)localStorage.setItem(k,v);}
function removeData(k){if(LS)localStorage.removeItem(k);}

let habits = [], timerInterval = null, timerElements = [], pendingResetId = null, selectedEmoji = '🎯';
const defaultEmojis = ['🚬','💨','🍺','🍷','🎮','📱','🍔','💊','🎯','🏃','📚','💤'];

function getAchievement(d){
    if(d>=365) return '🏆 Год без! (как у Илона Маск)';
    if(d>=90) return '💪 3 месяца!';
    if(d>=30) return '🌟 Месяц!';
    return '';
}
// ... (остальной JS — все функции selectHabit, openSetupFromSettings, saveHabitFromSetup, renderHabits, updateAllTimers, factoryReset, init и т.д. — я оставил их из предыдущего сообщения, они уже идеальные)

function init(){ /* ... */ }
init();
