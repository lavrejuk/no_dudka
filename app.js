(function(){
'use strict';
const tg = window.Telegram ? window.Telegram.WebApp : null;

if(tg){
    tg.ready();
    tg.expand();
    const s=document.documentElement.style;
    s.setProperty('--bg',tg.backgroundColor||'#fff');
    s.setProperty('--text',tg.textColor||'#000');
    s.setProperty('--button',tg.buttonColor||'#3390ec');
    s.setProperty('--button-text',tg.buttonTextColor||'#fff');
    s.setProperty('--hint',tg.hintColor||'#999');
    s.setProperty('--secondary-bg',tg.secondaryBackgroundColor||'#f0f0f0');
}

function lsOk(){try{localStorage.setItem('__t','1');localStorage.removeItem('__t');return true;}catch(e){return false;}}
const LS=lsOk();
function loadData(k){return LS?localStorage.getItem(k):null;}
function saveData(k,v){if(LS)localStorage.setItem(k,v);}
function removeData(k){if(LS)localStorage.removeItem(k);}

const $=id=>document.getElementById(id);
const scW=$('screen-welcome'),scS=$('screen-setup'),scT=$('screen-tracker'),scSet=$('screen-settings');
const welcomeTitle=$('welcome-title'),customBlock=$('custom-block'),customInput=$('custom-input');
const setupCustomBlock=$('setup-custom-block'),setupNameInput=$('setup-name-input'),emojiPicker=$('emoji-picker');
const habitLabel=$('habit-label'),lastUseDatetime=$('last-use-datetime'),dailyCostInput=$('daily-cost-input');
const cigPerDayInput=$('cig-per-day-input'),cigPackCostInput=$('cig-pack-cost-input'),vapeMonthlyCostInput=$('vape-monthly-cost-input');
const habitsContainer=$('habits-container'),settingsListContainer=$('settings-list-container'),totalMoneyEl=$('total-money');
const confirmModal=$('confirm-modal'),confirmYes=$('confirm-yes'),confirmNo=$('confirm-no');
const setupSaveBtn=$('setup-save-btn'),setupBackBtn=$('setup-back-btn');

let habits=[],timerInterval=null,timerElements=[],userName='Друг';
let currentSetupHabit=null,fromSettings=false,editingHabitId=null,pendingResetId=null,selectedEmoji='🎯';
const defaultEmojis=['🚬','💨','🍺','🍷','🎮','📱','🍔','💊','🎯','🏃','📚','💤'];

function showScreen(n){
    [scW,scS,scT,scSet].forEach(s=>s.classList.remove('active'));
    ({welcome:scW,setup:scS,tracker:scT,settings:scSet})[n].classList.add('active');
    if(tg && tg.BackButton){(n==='setup'||n==='settings')?tg.BackButton.show():tg.BackButton.hide();}
}

function goToWelcome(){showScreen('welcome');customBlock.style.display='none';}
function goToTracker(){renderHabits();updateAllTimers();showScreen('tracker');}

if(tg && tg.BackButton){
    tg.BackButton.onClick(()=>{
        if(scS.classList.contains('active')){fromSettings?(showScreen('settings'),renderSettingsList()):goToWelcome();}
        else if(scSet.classList.contains('active')){goToTracker();}
    });
}

function resolveUserName(){
    userName = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.first_name) || 
               (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.username) || 'Друг';
    welcomeTitle.textContent='Привет, '+userName+'!';
}

function renderEmojiPicker(sel='🎯'){
    selectedEmoji=sel;emojiPicker.innerHTML='';
    defaultEmojis.forEach(e=>{
        const sp=document.createElement('span');
        sp.className='emoji-option'+(e===sel?' selected':'');
        sp.textContent=e;
        sp.addEventListener('click',()=>renderEmojiPicker(e));
        emojiPicker.appendChild(sp);
    });
}

function setDefaultDateTime(){
    const n=new Date();
    n.setMinutes(n.getMinutes()-n.getTimezoneOffset());
    lastUseDatetime.value=n.toISOString().slice(0,16);
}

function fillDateTime(ts){
    const d=new Date(ts);
    d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
    lastUseDatetime.value=d.toISOString().slice(0,16);
}

function clearSetupFields(){
    setupNameInput.value='';dailyCostInput.value='0';cigPerDayInput.value='';cigPackCostInput.value='';vapeMonthlyCostInput.value='';
    $('cigarettes-cost-fields').style.display='none';$('vape-cost-fields').style.display='none';$('cost-block').style.display='block';
    habitLabel.style.display='none';setupCustomBlock.style.display='none';selectedEmoji='🎯';renderEmojiPicker('🎯');
}

function selectHabit(type){
    fromSettings=false;editingHabitId=null;
    const names={cigarettes:'Сигареты',vape:'Вейп'},icons={cigarettes:'🚬',vape:'💨'};
    currentSetupHabit={type,name:names[type]||type,icon:icons[type]||'🎯'};
    $('setup-title').textContent='Добавление';clearSetupFields();
    
    if(type==='cigarettes'){$('cigarettes-cost-fields').style.display='block';$('cost-block').style.display='none';}
    else if(type==='vape'){$('vape-cost-fields').style.display='block';$('cost-block').style.display='none';}
    
    if(type!=='custom'){habitLabel.style.display='block';habitLabel.textContent='Привычка: '+currentSetupHabit.icon+' '+currentSetupHabit.name;}
    setupSaveBtn.textContent='➕ Добавить привычку';setupBackBtn.onclick=goToWelcome;
    showScreen('setup');setDefaultDateTime();
}

function openSetupFromSettings(){
    fromSettings=true;editingHabitId=null;currentSetupHabit=null;
    $('setup-title').textContent='Новая привычка';clearSetupFields();setupCustomBlock.style.display='block';$('cost-block').style.display='block';
    setupSaveBtn.textContent='➕ Добавить привычку';setupBackBtn.onclick=()=>{showScreen('settings');renderSettingsList();};
    showScreen('setup');setDefaultDateTime();
}

function openEditHabit(h){
    fromSettings=true;editingHabitId=h.id;currentSetupHabit=Object.assign({}, h);
    $('setup-title').textContent='Редактирование';clearSetupFields();setupCustomBlock.style.display='block';$('cost-block').style.display='block';
    setupNameInput.value=h.name;renderEmojiPicker(h.icon);dailyCostInput.value=h.costPerDay||0;fillDateTime(h.startTime);
    setupSaveBtn.textContent='💾 Сохранить';setupBackBtn.onclick=()=>{showScreen('settings');renderSettingsList();};
    showScreen('setup');
}

function showCustomInput(){customBlock.style.display='block';customInput.focus();}

function confirmCustom(){
    const v=customInput.value.trim();if(!v)return alert('Введи название привычки');
    fromSettings=false;editingHabitId=null;currentSetupHabit={type:'custom',name:v,icon:'🎯'};
    $('setup-title').textContent='Добавление';clearSetupFields();setupCustomBlock.style.display='block';setupNameInput.value=v;
    renderEmojiPicker('🎯');$('cost-block').style.display='block';
    setupSaveBtn.textContent='➕ Добавить привычку';setupBackBtn.onclick=goToWelcome;
    showScreen('setup');setDefaultDateTime();
}

function saveHabitFromSetup(){
    const dt=lastUseDatetime.value;if(!dt)return alert('Укажи дату и время');
    let name,icon,costPerDay=0;
    
    if(editingHabitId){
        name=setupNameInput.value.trim();if(!name)return alert('Введи название');
        icon=selectedEmoji||'🎯';costPerDay=parseFloat(dailyCostInput.value)||0;
    }
    else if(currentSetupHabit && currentSetupHabit.type==='cigarettes'){
        name='Сигареты';icon='🚬';costPerDay=((parseFloat(cigPerDayInput.value)||0)/20)*(parseFloat(cigPackCostInput.value)||0);
    }
    else if(currentSetupHabit && currentSetupHabit.type==='vape'){
        name='Вейп';icon='💨';costPerDay=(parseFloat(vapeMonthlyCostInput.value)||0)/30;
    }
    else{
        name=setupNameInput.value.trim();if(!name)return alert('Введи название привычки');
        icon=selectedEmoji||'🎯';costPerDay=parseFloat(dailyCostInput.value)||0;
    }
    
    const startTime=new Date(dt).getTime();if(isNaN(startTime))return alert('Неверная дата/время');
    if(startTime>Date.now())return alert('Дата не может быть в будущем!');
    
    const hd={id:editingHabitId||Date.now(),type:'custom',name:name,icon:icon,startTime:startTime,costPerDay:costPerDay};
    
    if(editingHabitId){const i=habits.findIndex(h=>h.id===editingHabitId);if(i!==-1)habits[i]=hd;}
    else{habits.push(hd);}
    
    saveHabits();goToTracker();
}

function resetHabit(id){pendingResetId=id;confirmModal.style.display='flex';}

confirmYes.addEventListener('click',()=>{
    if(pendingResetId!==null){
        const h=habits.find(x=>x.id===pendingResetId);
        if(h){h.startTime=Date.now();saveHabits();renderHabits();updateAllTimers();}
        pendingResetId=null;
    }
    confirmModal.style.display='none';
});

confirmNo.addEventListener('click',()=>{pendingResetId=null;confirmModal.style.display='none';});

function deleteHabit(id){
    if(!confirm('Точно удалить эту привычку?'))return;
    habits=habits.filter(h=>h.id!==id);saveHabits();renderSettingsList();renderHabits();updateAllTimers();
    if(habits.length===0&&timerInterval){clearInterval(timerInterval);timerInterval=null;}
}

function formatTimeDiff(ms){
    const t=Math.floor(ms/1000);
    return `${Math.floor(t/86400)}д ${Math.floor((t%86400)/3600)}ч ${Math.floor((t%3600)/60)}м ${t%60}с`;
}

function getAchievement(d){
    if(d>=365)return'🏆 Год без!';if(d>=180)return'🎉 Полгода!';if(d>=90)return'💪 3 месяца!';
    if(d>=30)return'🌟 Месяц!';if(d>=7)return'🔥 Неделя!';if(d>=1)return'👍 1 день!';return'';
}

function renderHabits(){
    if(habits.length===0){
        habitsContainer.innerHTML='<p style="margin-top:20px;">У тебя пока нет привычек. Добавь их в настройках!</p>';
        totalMoneyEl.textContent='';timerElements=[];return;
    }
    habitsContainer.innerHTML='';timerElements=[];
    habits.forEach(h=>{
        const diff=Math.max(0,Date.now()-h.startTime),days=Math.floor(diff/86400000);
        const moneySaved=(h.costPerDay||0)*days,ach=getAchievement(days);
        const card=document.createElement('div');card.className='habit-card';
        
        const ic=document.createElement('div');ic.className='icon';ic.style.fontSize='32px';ic.style.marginBottom='5px';ic.textContent=h.icon;
        const nm=document.createElement('div');nm.className='habit-name';nm.textContent=h.name;
        const tm=document.createElement('div');tm.className='timer';tm.dataset.id=h.id;tm.textContent=formatTimeDiff(diff);
        
        card.appendChild(ic);card.appendChild(nm);card.appendChild(tm);
        
        if(moneySaved>0){const m=document.createElement('div');m.className='money';m.textContent=`💰 Сэкономлено ≈ ${Math.round(moneySaved)} ₽`;card.appendChild(m);}
        
        const rb=document.createElement('button');rb.className='reset-btn';rb.textContent='😞 Я сорвался';
        rb.addEventListener('click',e=>{e.stopPropagation();resetHabit(h.id);});
        
        card.appendChild(rb);
        habitsContainer.appendChild(card);
        timerElements.push({element:tm,id:h.id});
    });
}

function renderSettingsList(){
    if(habits.length===0){settingsListContainer.innerHTML='<p style="margin-top:10px;">Список пуст.</p>';return;}
    settingsListContainer.innerHTML='';
    habits.forEach(h=>{
        const item=document.createElement('div');item.className='settings-list-item';
        const sp=document.createElement('span');sp.textContent=h.icon+' '+h.name;
        const bg=document.createElement('div');bg.className='btn-group';
        
        const eb=document.createElement('button');eb.textContent='✏️';eb.addEventListener('click',()=>openEditHabit(h));
        const db=document.createElement('button');db.className='del-btn';db.textContent='Удалить';db.addEventListener('click',()=>deleteHabit(h.id));
        
        bg.appendChild(eb);bg.appendChild(db);item.appendChild(sp);item.appendChild(bg);
        settingsListContainer.appendChild(item);
    });
}

function showSettings(){renderSettingsList();showScreen('settings');}

function updateAllTimers(){
    let total=0;
    timerElements.forEach(({element,id})=>{
        const h=habits.find(x=>x.id==id);
        if(h){
            const diff=Math.max(0,Date.now()-h.startTime);element.textContent=formatTimeDiff(diff);
            total+=(h.costPerDay||0)*(diff/86400000);
        }
    });
    if(totalMoneyEl)totalMoneyEl.textContent=total>0?`Общая экономия: ≈ ${Math.round(total)} ₽`:'';
}

function saveHabits(){saveData('habitsData',JSON.stringify(habits));}
function loadHabits(){const d=loadData('habitsData');try{habits=d?JSON.parse(d):[];}catch(e){habits=[];}}

function factoryReset(){
    if(!confirm('⚠️ Ты уверен? Все привычки будут удалены.'))return;
    removeData('habitsData');habits=[];
    if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
    timerElements=[];resolveUserName();goToWelcome();
}

function init(){
    resolveUserName();loadHabits();
    if(habits.length>0)goToTracker();else goToWelcome();
    if(timerInterval)clearInterval(timerInterval);
    timerInterval=setInterval(()=>{if(scT.classList.contains('active'))updateAllTimers();},1000);
}

$('btn-cigarettes').addEventListener('click',()=>selectHabit('cigarettes'));
$('btn-vape').addEventListener('click',()=>selectHabit('vape'));
$('btn-custom').addEventListener('click',showCustomInput);
$('btn-confirm-custom').addEventListener('click',confirmCustom);
setupSaveBtn.addEventListener('click',saveHabitFromSetup);
$('btn-open-settings').addEventListener('click',showSettings);
$('btn-add-from-settings').addEventListener('click',openSetupFromSettings);
$('btn-back-to-tracker').addEventListener('click',goToTracker);
$('btn-factory-reset').addEventListener('click',factoryReset);
init();
})();
