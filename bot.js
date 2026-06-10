const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

// ======================== AVTORLIK HUQUQI VA LITSENZIYA ========================
const LICENSE_KEY = "ISUZU_DOCTOR_BOT_V2";
const BOT_OWNER = "Erkinjon Shukurov";
const BOT_OWNER_TELEGRAM = "@Erkinjon_Shukurov";
let currentVersion = "2.9";

// ======================== LINKLAR ========================
const NEW_BOT_LINK = "https://t.me/Isuzu_doctor_bot";
const INSTAGRAM_LINK = "https://www.instagram.com/isuzudoctor.979247888/";
const TELEGRAM_GROUP_LINK = "https://t.me/+piY0W4XrGqFkN2Iy";

// ======================== ADMIN BILAN BOG'LANISH UCHUN XABAR ========================
const CONTACT_ADMIN_MESSAGE = `
Assalomu alaykum! 👋

🚗 *Isuzu Doctor* xizmatiga savollaringizni berishingiz mumkin.

✅ Doctor xabarni yuborishingiz bilan sizga javob beradi.

📝 Iltimos, savolingizni yoki muammoingizni yozib qoldiring.

📍 Lokatsiya yuborishingiz ham mumkin.

🔙 "Bekor qilish" tugmasini bossangiz, asosiy menyuga qaytasiz.
`;

// -------------------- VAQT ZONASI --------------------
function getTashkentTime(date) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Date(dateObj.getTime() + 5 * 60 * 60 * 1000);
}

function formatTashkentDateTime(date) {
    const d = getTashkentTime(date);
    return d.toLocaleString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// -------------------- KARTA MA'LUMOTLARI --------------------
const CARD_NUMBER = "9860040115220143";
const CARD_OWNER = "Erkinjon Shukurov";
const BANK_NAME = "Xalq Bank";

function getCardInfoMessage() {
    return `🏦 *KARTA MA'LUMOTLARI*\n\n💳 *Karta raqami:* \`${CARD_NUMBER}\`\n👤 *Karta egasi:* ${CARD_OWNER}\n🏛 *Bank:* ${BANK_NAME}`;
}

// -------------------- ADMIN --------------------
const BOT_TOKEN = process.env.BOT_TOKEN || '8779251766:AAH12INusgBCawsk5awqIjcyHnNLiq5A33A';
const ADMIN_PHONE = "+998979247888";
const ADMIN_IDS = [1437230485];
const SUPER_ADMIN_ID = 1437230485;
const DIAGNOSTIC_PRICE = 250000;
const MAX_CARS_PER_USER = 20;

// -------------------- PAPKALAR --------------------
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const BACKUP_DIR = path.join(VOLUME_PATH, 'backups');
const REPORTS_DIR = path.join(VOLUME_PATH, 'reports');

const USERS_FILE = path.join(VOLUME_PATH, 'users.json');
const DIAGNOSTICS_FILE = path.join(VOLUME_PATH, 'diagnostics.json');
const ERRORS_FILE = path.join(VOLUME_PATH, 'errors.json');
const VERSION_FILE = path.join(VOLUME_PATH, 'version.json');
const ADMIN_SETTINGS_FILE = path.join(VOLUME_PATH, 'admin_settings.json');
const VIDEOS_FILE = path.join(VOLUME_PATH, 'videos.json');
const CONVERSATIONS_FILE = path.join(VOLUME_PATH, 'conversations.json');

// -------------------- MUHOQOT TIZIMI --------------------
let conversations = [];

function loadConversations() {
    try {
        if (fs.existsSync(CONVERSATIONS_FILE)) conversations = JSON.parse(fs.readFileSync(CONVERSATIONS_FILE, "utf8"));
        else conversations = [];
    } catch(e) { conversations = []; }
}

function saveConversations() { fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2)); }

function getOrCreateConversation(userId, adminId = ADMIN_IDS[0]) {
    let conv = conversations.find(c => c.userId === userId);
    if (!conv) {
        conv = { id: Date.now(), userId, adminId, messages: [], createdAt: new Date().toISOString(), isActive: true, userUnreadCount: 0, adminUnreadCount: 0 };
        conversations.push(conv);
        saveConversations();
    }
    return conv;
}

function addMessage(userId, adminId, message, type = "text", location = null) {
    const conv = getOrCreateConversation(userId, adminId);
    conv.messages.push({ id: Date.now(), fromUserId: userId, toUserId: adminId, message, type, location, timestamp: new Date().toISOString(), isRead: false });
    if (userId === conv.userId) conv.adminUnreadCount = (conv.adminUnreadCount || 0) + 1;
    else conv.userUnreadCount = (conv.userUnreadCount || 0) + 1;
    saveConversations();
    return true;
}

function addAdminReply(adminId, userId, message, type = "text", location = null) {
    const conv = getOrCreateConversation(userId, adminId);
    conv.messages.push({ id: Date.now(), fromUserId: adminId, toUserId: userId, message, type, location, timestamp: new Date().toISOString(), isRead: false });
    conv.userUnreadCount = (conv.userUnreadCount || 0) + 1;
    saveConversations();
    return true;
}

function getUserUnreadCount(userId) {
    const conv = conversations.find(c => c.userId === userId);
    return conv ? conv.userUnreadCount || 0 : 0;
}

function getTotalUnreadForAdmin(adminId) {
    return conversations.reduce((sum, c) => sum + (c.adminUnreadCount || 0), 0);
}

function getAllConversations() {
    return conversations.filter(c => c.isActive).sort((a,b) => {
        const la = a.messages[a.messages.length-1];
        const lb = b.messages[b.messages.length-1];
        if(!la||!lb) return 0;
        return new Date(lb.timestamp) - new Date(la.timestamp);
    });
}

function markMessagesAsRead(conversationId, userId) {
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
        if (userId === conv.userId) conv.userUnreadCount = 0;
        else conv.adminUnreadCount = 0;
        saveConversations();
    }
}

// ========== MUHOQOTLARNI O'CHIRISH ==========
function deleteConversation(conversationId, adminId) {
    const index = conversations.findIndex(c => c.id === conversationId);
    if (index === -1) return { success: false, message: "❌ Muloqot topilmadi!" };
    const conversation = conversations[index];
    const user = getUserByUserId(conversation.userId);
    const userName = user ? (user.fullName || user.phone || `ID:${conversation.userId}`) : "Noma'lum foydalanuvchi";
    conversations.splice(index, 1);
    saveConversations();
    addSecurityLog("CONVERSATION_DELETED", adminId, `Muloqot o'chirildi: ${userName}`);
    return { success: true, message: `✅ "${userName}" bilan muloqot o'chirildi!` };
}

// ========== LOKATSIYA ==========
function parseMapUrl(text) {
    let match = text.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    match = text.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    match = text.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    return null;
}

async function showConversation(chatId, userId, isAdminView = false, targetUserId = null) {
    let conversation, otherUserName;
    if (isAdminView && targetUserId) {
        conversation = getOrCreateConversation(targetUserId, chatId);
        const tu = getUserByUserId(targetUserId);
        otherUserName = tu ? (tu.fullName || tu.phone) : "Foydalanuvchi";
    } else {
        conversation = getOrCreateConversation(userId, ADMIN_IDS[0]);
        otherUserName = "Admin";
    }
    
    if (!conversation || conversation.messages.length === 0) {
        const msg = isAdminView ? "💬 *Hali xabar yo'q*\n\nFoydalanuvchiga xabar yozishingiz mumkin." : CONTACT_ADMIN_MESSAGE;
        let keyboard = null;
        if (!isAdminView) {
            keyboard = { reply_markup: { keyboard: [[{text:"📍 Lokatsiya yuborish", request_location:true}],[{text:"🔙 Bekor qilish"}]], resize_keyboard:true } };
        }
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", ...keyboard });
        return;
    }
    
    markMessagesAsRead(conversation.id, chatId);
    let msg = `💬 *${otherUserName} bilan muloqot*\n━━━━━━━━━━━━━━━━━━\n\n`;
    const lastMessages = conversation.messages.slice(-20);
    
    for (const m of lastMessages) {
        const sender = m.fromUserId === conversation.userId ? "👤 Siz" : "👑 Admin";
        const time = formatTashkentDateTime(m.timestamp);
        if (m.type === "location" && m.location) {
            const lat = m.location.latitude;
            const lng = m.location.longitude;
            msg += `📍 *${sender}* (${time}): Локация\n`;
            msg += `   🗺️ [Google Maps](https://www.google.com/maps?q=${lat},${lng})\n`;
            msg += `   🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${lng},${lat}&z=15)\n`;
            msg += `   🗺️ [2GIS](https://2gis.uz/search/${lat},${lng})\n`;
            msg += `   🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15)\n`;
            msg += `   🗺️ [Bing Maps](https://www.bing.com/maps?cp=${lat}~${lng}&lvl=15)\n`;
        } else {
            msg += `💬 *${sender}* (${time}):\n   ${m.message}\n`;
        }
        msg += "━━━━━━━━━━━━━━━━━━\n";
    }
    
    if (isAdminView) {
        msg += "\n✏️ *Javob yozing*\n📍 *Lokatsiya yuborish:*\n";
        msg += "   • 📍 Joriy lokatsiyam\n";
        msg += "   • 🗺️ Xaritadan tanlash (link yoki koordinata)\n";
        msg += "━━━━━━━━━━━━━━━━━━\n";
        msg += "🗑️ Bu muloqotni o'chirish\n🔙 Muloqotlar ro'yxati";
        const keyboard = { reply_markup: { keyboard: [
            [{ text: "📍 Joriy lokatsiyam", request_location: true }],
            [{ text: "🗺️ Xaritadan lokatsiya tanlash" }],
            [{ text: "🗑️ Bu muloqotni o'chirish" }],
            [{ text: "🔙 Muloqotlar ro'yxati" }]
        ], resize_keyboard: true } };
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", disable_web_page_preview: true, ...keyboard });
    } else {
        msg += "\n✏️ *Xabaringizni yozing*\n📍 Lokatsiya yuborish mumkin\n🔙 Asosiy menyu";
        const keyboard = { reply_markup: { keyboard: [[{text:"📍 Lokatsiya yuborish", request_location:true}],[{text:"🔙 Asosiy menyu"}]], resize_keyboard:true } };
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", disable_web_page_preview: true, ...keyboard });
    }
}

async function showAllConversations(chatId, page = 0) {
    const all = getAllConversations();
    const itemsPerPage = 10;
    const start = page * itemsPerPage;
    const pageConvs = all.slice(start, start + itemsPerPage);
    
    if (all.length === 0) {
        await bot.sendMessage(chatId, "💬 *MUHOQOTLAR*\n\nHozircha muloqot yo'q.", { parse_mode: "Markdown" });
        return;
    }
    
    let msg = `💬 *MUHOQOTLAR RO'YXATI*\n━━━━━━━━━━━━━━━━━━\n📊 Jami: ${all.length} ta\n📄 Sahifa ${page+1}/${Math.ceil(all.length/itemsPerPage)}\n━━━━━━━━━━━━━━━━━━\n\n`;
    const keyboard = [];
    for (let i=0; i<pageConvs.length; i++) {
        const conv = pageConvs[i];
        const user = getUserByUserId(conv.userId);
        const userName = user ? (user.fullName || user.phone || `ID:${conv.userId}`) : `ID:${conv.userId}`;
        const lastMsg = conv.messages[conv.messages.length-1];
        const lastMsgText = lastMsg ? (lastMsg.type==="location" ? "📍 Lokatsiya" : lastMsg.message.substring(0,30)) : "Xabar yo'q";
        const unread = conv.adminUnreadCount || 0;
        const unreadIcon = unread > 0 ? `🔴 ${unread}🆕 ` : "";
        const num = start + i + 1;
        const msgCount = conv.messages.length;
        msg += `${num}. ${unreadIcon}*${userName.substring(0,25)}*\n   📝 ${lastMsgText}\n   📅 ${lastMsg ? formatTashkentDateTime(lastMsg.timestamp) : "-"}\n   💬 ${msgCount} ta xabar\n━━━━━━━━━━━━━━━━━━\n`;
        keyboard.push([
            { text: `💬 ${num}. Javob berish`, callback_data: `open_conversation_${conv.userId}` },
            { text: `🗑️ ${num}. O'chirish`, callback_data: `delete_conv_${conv.id}` }
        ]);
    }
    const nav = [];
    if (page > 0) nav.push({ text: "◀️ Oldingi", callback_data: `conversations_page_${page-1}` });
    if (start + itemsPerPage < all.length) nav.push({ text: "Keyingi ▶️", callback_data: `conversations_page_${page+1}` });
    if (nav.length) keyboard.push(nav);
    keyboard.push([{ text: "🔙 Ortga", callback_data: "back_to_main" }]);
    await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
}

// -------------------- VIDEO GALEREYA --------------------
let videoList = [];
function loadVideos() { try { if(fs.existsSync(VIDEOS_FILE)) videoList = JSON.parse(fs.readFileSync(VIDEOS_FILE,"utf8")); else videoList=[]; } catch(e) { videoList=[]; } }
function saveVideos() { fs.writeFileSync(VIDEOS_FILE, JSON.stringify(videoList,null,2)); }
function addVideo(id,title,desc,adminId) { videoList.unshift({id:Date.now(),fileId:id,title,description:desc,views:0,likes:0,likedBy:[],uploadedBy:adminId,uploadDate:new Date().toISOString(),isActive:true}); saveVideos(); return true; }
function getActiveVideos() { return videoList.filter(v=>v.isActive); }
function deleteVideo(videoId) { const idx = videoList.findIndex(v=>v.id===videoId); if(idx!==-1) videoList.splice(idx,1); saveVideos(); }

// -------------------- DATABASE --------------------
let users = [], diagnostics = [], errors = [], adminSettings = { allowedEditors: [], securityLog: [] };
let uniqueInstallId = crypto.createHash('sha256').update(os.hostname() + LICENSE_KEY).digest('hex').substring(0,16);

function ensureDir() { if(!fs.existsSync(VOLUME_PATH)) fs.mkdirSync(VOLUME_PATH,{recursive:true}); if(!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR,{recursive:true}); if(!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR,{recursive:true}); }
ensureDir();

function loadData() {
    try {
        if(fs.existsSync(USERS_FILE)) users = JSON.parse(fs.readFileSync(USERS_FILE,"utf8"));
        else users = [];
        if(fs.existsSync(DIAGNOSTICS_FILE)) diagnostics = JSON.parse(fs.readFileSync(DIAGNOSTICS_FILE,"utf8"));
        else diagnostics = [];
        if(fs.existsSync(ERRORS_FILE)) errors = JSON.parse(fs.readFileSync(ERRORS_FILE,"utf8"));
        else errors = [];
        users.forEach(u => { if(u.isBlocked===undefined) u.isBlocked=false; if(!u.cars) u.cars=[]; if(u.totalDiagnosticsAll===undefined) u.totalDiagnosticsAll=0; if(u.totalBonusCount===undefined) u.totalBonusCount=0; if(u.totalFreeDiagnostics===undefined) u.totalFreeDiagnostics=0; });
    } catch(e) { console.error(e); }
}
function saveUsers() { fs.writeFileSync(USERS_FILE, JSON.stringify(users,null,2)); }
function saveDiagnostics() { fs.writeFileSync(DIAGNOSTICS_FILE, JSON.stringify(diagnostics,null,2)); }
function saveErrors() { fs.writeFileSync(ERRORS_FILE, JSON.stringify(errors,null,2)); }

function getUserByPhone(phone) { return users.find(u=>u.phone===phone); }
function getUserByUserId(id) { return users.find(u=>u.userId===id); }
function isAdmin(id) { return ADMIN_IDS.includes(id); }

function addNewUser(id,phone,car,fn,ln,un) {
    users.push({ userId:id, phone, firstName:fn, lastName:ln, username:un, fullName:`${fn} ${ln}`.trim(), isAdmin:false, isActive:true, isBlocked:false, registeredDate:new Date().toISOString(), cars:[{ carId:Date.now(), carNumber:car, bonusCount:0, freeDiagnostics:0, totalDiagnostics:0, addedDate:new Date().toISOString(), isActive:true }], totalBonusCount:0, totalFreeDiagnostics:0, totalDiagnosticsAll:0 });
    saveUsers();
}

function addCarToUser(phone,car) {
    const user = getUserByPhone(phone);
    if(!user) return { success:false, message:"❌ Foydalanuvchi topilmadi" };
    if(user.cars.length >= MAX_CARS_PER_USER) return { success:false, message:`❌ Maksimum ${MAX_CARS_PER_USER} ta avtomobil` };
    if(user.cars.find(c=>c.carNumber===car)) return { success:false, message:"❌ Bu avtomobil allaqachon bor" };
    user.cars.push({ carId:Date.now(), carNumber:car, bonusCount:0, freeDiagnostics:0, totalDiagnostics:0, addedDate:new Date().toISOString(), isActive:true });
    saveUsers();
    return { success:true, message:"✅ Avtomobil qo'shildi" };
}

function addDiagnosticToCar(phone,car,work,notes,extraPrice=0,extraDesc="") {
    const user = getUserByPhone(phone);
    if(!user) return { success:false };
    const carObj = user.cars.find(c=>c.carNumber===car);
    if(!carObj) return { success:false };
    let isFree=false, bonusMsg="";
    let newBonus = carObj.bonusCount;
    let newFree = carObj.freeDiagnostics;
    let price = DIAGNOSTIC_PRICE;
    if(carObj.freeDiagnostics > 0) {
        isFree=true;
        newFree--;
        price=0;
        bonusMsg="🎉 BEPUL diagnostikadan foydalandingiz!";
    } else {
        newBonus++;
        if(newBonus>=5) {
            const add = Math.floor(newBonus/5);
            newFree += add;
            newBonus = newBonus % 5;
            bonusMsg = "🎉 TABRIKLAYMIZ! 5-diagnostika = 1 BEPUL!";
        }
    }
    diagnostics.push({ id:Date.now(), userId:user.userId, phoneNumber:phone, carNumber:car, date:new Date().toISOString(), workDescription:work, additionalNotes:notes, diagnosticPrice:price, laborPrice:extraPrice, laborDescription:extraDesc, totalPrice:price+extraPrice, isFree });
    saveDiagnostics();
    carObj.bonusCount = newBonus;
    carObj.freeDiagnostics = newFree;
    carObj.totalDiagnostics++;
    user.totalDiagnosticsAll++;
    if(!isFree) user.totalBonusCount++;
    if(isFree) user.totalFreeDiagnostics++;
    saveUsers();
    return { success:true, isFree, diagnosticPrice:price, laborPrice:extraPrice, totalPrice:price+extraPrice, bonusMessage:bonusMsg, carNumber:car };
}

function getStatistics() {
    const active = users.filter(u=>!u.isAdmin && !u.isBlocked);
    let cars=0, diagInc=0, laborInc=0, totalVideoViews=0;
    for(const u of active) cars += u.cars.length;
    for(const d of diagnostics) {
        if(d.diagnosticPrice>0) diagInc += d.diagnosticPrice;
        if(d.laborPrice>0) laborInc += d.laborPrice;
    }
    for(const v of videoList) totalVideoViews += (v.views || 0);
    return { totalUsers:active.length, blockedUsers:users.filter(u=>!u.isAdmin && u.isBlocked).length, totalCars:cars, totalDiagnostics:diagnostics.length, diagnosticIncome:diagInc, laborIncome:laborInc, totalIncome:diagInc+laborInc, currentVersion, totalVideos:videoList.length, totalVideoViews, unreadMessages:getTotalUnreadForAdmin(ADMIN_IDS[0]) };
}

function getTodayDiagnostics() { const t=new Date().toISOString().split("T")[0]; return diagnostics.filter(d=>d.date.split("T")[0]===t); }
function getAllDiagnostics(limit=500) { return diagnostics.slice(-limit).reverse(); }
function getErrors() { return errors.slice(-50).reverse(); }
function getNearBonusCars() { const near=[]; for(const u of users) { if(u.isAdmin) continue; for(const c of u.cars) { if(c.bonusCount>=3 && c.bonusCount<5) near.push({ fullName:u.fullName, phone:u.phone, carNumber:c.carNumber, bonusCount:c.bonusCount, remaining:5-c.bonusCount }); } } return near; }
function getAllUsersWithDetails() { return users.filter(u=>!u.isAdmin).map(u=>({ userId:u.userId, fullName:u.fullName||"Ismsiz", phone:u.phone, cars:u.cars, totalDiagnostics:u.totalDiagnosticsAll||0, isBlocked:u.isBlocked||false })); }

function blockUser(id) { const u=getUserByUserId(id); if(u && !u.isAdmin) { u.isBlocked=true; saveUsers(); return { success:true, message:"✅ Foydalanuvchi bloklandi" }; } return { success:false, message:"❌ Xatolik" }; }
function unblockUser(id) { const u=getUserByUserId(id); if(u) { u.isBlocked=false; saveUsers(); return { success:true, message:"✅ Foydalanuvchi blokdan ochildi" }; } return { success:false, message:"❌ Xatolik" }; }
function deleteUser(id) { const idx=users.findIndex(u=>u.userId===id); if(idx!==-1 && !users[idx].isAdmin) { users.splice(idx,1); saveUsers(); return { success:true, message:"🗑️ Foydalanuvchi o'chirildi" }; } return { success:false, message:"❌ Xatolik" }; }
function getActiveUsers() { return users.filter(u=>!u.isAdmin && !u.isBlocked); }
function getBlockedUsers() { return users.filter(u=>!u.isAdmin && u.isBlocked); }

function addSecurityLog(action, userId, details) {
    adminSettings.securityLog.unshift({ id: Date.now(), action, userId, details, date: new Date().toISOString() });
    if (adminSettings.securityLog.length > 100) adminSettings.securityLog = adminSettings.securityLog.slice(0, 100);
    saveAdminSettings();
}

function saveAdminSettings() { fs.writeFileSync(ADMIN_SETTINGS_FILE, JSON.stringify(adminSettings, null, 2)); }
function loadAdminSettings() { try { if(fs.existsSync(ADMIN_SETTINGS_FILE)) adminSettings = JSON.parse(fs.readFileSync(ADMIN_SETTINGS_FILE, "utf8")); } catch(e) { adminSettings = { allowedEditors: [], securityLog: [] }; } }

async function sendNotificationToAllUsers(msg,keyboard=null) { let s=0,f=0; for(const u of users.filter(u=>!u.isAdmin && !u.isBlocked)) { try { await bot.sendMessage(u.userId, msg, { parse_mode:"Markdown", reply_markup:keyboard }); s++; } catch(e) { f++; } } return { success:s, fail:f }; }

// ========== HISOBOT ==========
async function generateFullReport(chatId) {
    const stats = getStatistics();
    const todayDiags = getTodayDiagnostics();
    const nearBonus = getNearBonusCars();
    let report = "📊 *ISUZU DOCTOR BOT HISOBOTI*\n";
    report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    report += `📅 Sana: ${formatTashkentDateTime(new Date())}\n`;
    report += `📌 Bot versiyasi: V${currentVersion}\n\n`;
    report += "👥 *FOYDALANUVCHILAR*\n";
    report += `   • Faol foydalanuvchilar: ${stats.totalUsers} ta\n`;
    report += `   • Bloklanganlar: ${stats.blockedUsers} ta\n`;
    report += `   • Avtomobillar: ${stats.totalCars} ta\n\n`;
    report += "🔧 *DIAGNOSTIKA*\n";
    report += `   • Jami: ${stats.totalDiagnostics} ta\n`;
    report += `   • Diagnostika daromadi: ${stats.diagnosticIncome.toLocaleString()} so'm\n`;
    report += `   • Mehnat daromadi: ${stats.laborIncome.toLocaleString()} so'm\n`;
    report += `   • Jami daromad: ${stats.totalIncome.toLocaleString()} so'm\n\n`;
    report += "📅 *BUGUNGI*\n";
    if (todayDiags.length === 0) report += "   • Bugun diagnostika yo'q\n";
    else { let todayIncome=0; for(const d of todayDiags) todayIncome += (d.diagnosticPrice||0)+(d.laborPrice||0); report += `   • ${todayDiags.length} ta diagnostika\n   • Bugungi daromad: ${todayIncome.toLocaleString()} so'm\n`; }
    report += "\n🎁 *BONUSGA YAQINLAR*\n";
    if (nearBonus.length === 0) report += "   • Bonusga yaqin avtomobillar yo'q\n";
    else for(const nb of nearBonus.slice(0,5)) report += `   • ${nb.carNumber} (${nb.bonusCount}/5) - ${nb.remaining} ta qoldi\n`;
    report += "\n📹 *VIDEO*\n";
    report += `   • Jami videolar: ${stats.totalVideos} ta\n`;
    report += `   • Umumiy ko'rishlar: ${stats.totalVideoViews} ta\n\n`;
    report += "💬 *MUHOQOTLAR*\n";
    report += `   • O'qilmagan xabarlar: ${stats.unreadMessages} ta\n\n`;
    report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    report += `© ${BOT_OWNER} | Isuzu Doctor Bot`;
    return report;
}

// ========== DIAGNOSTIKA TARIXI FAYLI ==========
async function generateDiagnosticsHistoryFile(chatId, limit = 500) {
    const diags = getAllDiagnostics(limit);
    if (diags.length === 0) { await bot.sendMessage(chatId, "📭 Diagnostikalar mavjud emas!", { parse_mode:"Markdown" }); return null; }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filepath = path.join(REPORTS_DIR, `diagnostika_tarixi_${timestamp}.txt`);
    let content = "";
    content += "=".repeat(80) + "\n";
    content += "                    DIAGNOSTIKA TARIXI\n";
    content += "=".repeat(80) + "\n\n";
    content += `📅 Yaratilgan: ${formatTashkentDateTime(new Date())}\n`;
    content += `📊 Jami: ${diags.length} ta\n`;
    content += "=".repeat(80) + "\n\n";
    let totalDiag=0, totalLabor=0, freeCount=0, paidCount=0;
    for (let i=0; i<diags.length; i++) {
        const d = diags[i];
        const diagPrice = d.diagnosticPrice || 0;
        const laborPrice = d.laborPrice || 0;
        if (diagPrice>0) paidCount++;
        if (d.isFree) freeCount++;
        totalDiag += diagPrice;
        totalLabor += laborPrice;
        content += `📌 ${diags.length-i}-DIAGNOSTIKA\n`;
        content += "─".repeat(80) + "\n";
        content += `📆 Sana: ${formatTashkentDateTime(d.date)}\n`;
        content += `🚗 Avtomobil: ${d.carNumber}\n`;
        content += `👤 Telefon: ${d.phoneNumber}\n\n`;
        content += "📝 BAJARILGAN ISHLAR:\n" + d.workDescription + "\n\n";
        if (d.laborDescription && d.laborPrice>0) content += "🔨 QO'SHIMCHA ISH:\n" + d.laborDescription + "\n💰 " + d.laborPrice.toLocaleString() + " so'm\n\n";
        if (d.additionalNotes) content += "📌 ESLATMA:\n" + d.additionalNotes + "\n\n";
        content += "💰 NARXLAR:\n";
        if (d.isFree) content += "   🎉 BEPUL\n";
        else { if (diagPrice>0) content += `   🔧 Diagnostika: ${diagPrice.toLocaleString()} so'm\n`; if (laborPrice>0) content += `   🔨 Mehnat: ${laborPrice.toLocaleString()} so'm\n`; }
        content += `   💰 JAMI: ${(diagPrice+laborPrice).toLocaleString()} so'm\n`;
        content += "\n" + "─".repeat(80) + "\n\n";
    }
    content += "=".repeat(80) + "\n";
    content += "📊 JAMI STATISTIKA\n";
    content += "=".repeat(80) + "\n";
    content += `📊 Jami: ${diags.length} ta\n💰 To'lovli: ${paidCount} ta\n🎉 Bepul: ${freeCount} ta\n`;
    content += `💵 Diagnostika: ${totalDiag.toLocaleString()} so'm\n🔨 Mehnat: ${totalLabor.toLocaleString()} so'm\n`;
    content += `💰 Umumiy: ${(totalDiag+totalLabor).toLocaleString()} so'm\n`;
    content += "=".repeat(80) + "\n© " + BOT_OWNER + "\n";
    fs.writeFileSync(filepath, content, "utf8");
    return filepath;
}

// -------------------- KEYBOARDS --------------------
function getCompactInlineKeyboard(uid) {
    const unread = getUserUnreadCount(uid);
    const badge = unread > 0 ? ` (${unread})` : "";
    return { reply_markup: { inline_keyboard: [
        [{ text:"📊 Profil", callback_data:"user_profile" }, { text:"🚗 Avtomobillar", callback_data:"user_my_cars" }],
        [{ text:"🎁 Bonuslar", callback_data:"user_my_bonus" }, { text:"➕ Avto qo'shish", callback_data:"user_add_car" }],
        [{ text:"📋 Tarix", callback_data:"user_history" }, { text:"📹 Video", callback_data:"user_video_gallery" }],
        [{ text:"💳 To'lov", callback_data:"user_payment" }, { text:"📸 Instagram", callback_data:"user_instagram" }],
        [{ text:"👥 Guruh", callback_data:"user_telegram_group" }, { text:"💬 Admin bilan bog'lanish"+badge, callback_data:"user_contact_admin" }],
        [{ text:"ℹ️ Ma'lumot", callback_data:"user_info" }, { text:"📌 Versiya", callback_data:"user_version_info" }]
    ] } };
}

function getAdminReplyKeyboard() {
    const unread = getTotalUnreadForAdmin(ADMIN_IDS[0]);
    const badge = unread > 0 ? ` (${unread}🆕)` : "";
    return { reply_markup: { keyboard: [
        ["📊 Statistika", "👥 Foydalanuvchilar"],
        ["🔧 Diagnostika", "🎁 Bonusga yaqinlar"],
        ["⚠️ Xatoliklar", "📋 Diagnostika tarixi"],
        ["📅 Bugungi", "📄 Hisobot"],
        ["📹 Video galereya", "📤 Video yuklash"],
        ["🗑️ Video o'chirish", "💾 Backup"],
        ["🔄 Tiklash", "🚫 Foyd. boshqarish"],
        ["🔐 Xavfsizlik", "📌 Versiya"],
        ["📢 Xabar yuborish", "💬 Muloqotlar" + badge],
        ["❌ Asosiy menyu"]
    ], resize_keyboard:true } };
}

function getPhoneKeyboard() { return { reply_markup: { keyboard:[[{text:"📱 Telefon raqamini yuborish", request_contact:true}]], resize_keyboard:true, one_time_keyboard:true } }; }
function getLocationKeyboard() { return { reply_markup: { keyboard:[[{text:"📍 Lokatsiya yuborish", request_location:true}],[{text:"🔙 Bekor qilish"}]], resize_keyboard:true } }; }
function removeKeyboard() { return { reply_markup: { remove_keyboard:true } }; }

async function sendMainMenu(chatId, isAdminUser=false, userId=null) {
    if(isAdminUser) await bot.sendMessage(chatId, `👑 *Admin paneli*\n📌 Versiya: V${currentVersion}`, { parse_mode:"Markdown", ...getAdminReplyKeyboard() });
    else await bot.sendMessage(chatId, `🏠 *Asosiy menyu*\n📌 Versiya: V${currentVersion}`, { parse_mode:"Markdown", ...getCompactInlineKeyboard(userId) });
}

async function showVideoGallery(chatId, page=0) {
    const videos = getActiveVideos();
    const items=5, start=page*items, pageVids=videos.slice(start,start+items);
    if(videos.length===0) { await bot.sendMessage(chatId, "📹 Videolar yo'q"); return; }
    let msg=`📹 VIDEO GALEREYA\n━━━━━━━━━━━━━━━━━━\n📊 Jami: ${videos.length} ta\n━━━━━━━━━━━━━━━━━━\n\n`;
    const keyboard=[];
    for(let i=0;i<pageVids.length;i++) { const v=pageVids[i]; const num=start+i+1; msg+=`${num}. *${v.title}*\n👁️ ${v.views||0} | 👍 ${v.likes||0}\n━━━━━━━━━━━━━━━━━━\n`; keyboard.push([{ text:`▶️ ${num}. ${v.title.substring(0,25)}`, callback_data:`watch_video_${v.id}` }]); }
    const nav=[]; if(page>0) nav.push({ text:"◀️", callback_data:`video_page_${page-1}` }); if(start+items<videos.length) nav.push({ text:"▶️", callback_data:`video_page_${page+1}` }); if(nav.length) keyboard.push(nav);
    keyboard.push([{ text:"🔙 Asosiy menyu", callback_data:"back_to_main" }]);
    await bot.sendMessage(chatId, msg, { parse_mode:"Markdown", reply_markup:{ inline_keyboard:keyboard } });
}

async function showVideoManagement(chatId, page=0) {
    const videos = getActiveVideos();
    const items=5, start=page*items, pageVids=videos.slice(start,start+items);
    if(videos.length===0) { await bot.sendMessage(chatId, "📹 Videolar yo'q"); return; }
    let msg=`📹 VIDEO BOSHQARISH\n━━━━━━━━━━━━━━━━━━\n📊 Jami: ${videos.length} ta\n━━━━━━━━━━━━━━━━━━\n\n`;
    const keyboard=[];
    for(let i=0;i<pageVids.length;i++) { const v=pageVids[i]; const num=start+i+1; msg+=`${num}. *${v.title}*\n👁️ ${v.views||0} | 👍 ${v.likes||0}\n━━━━━━━━━━━━━━━━━━\n`; keyboard.push([{ text:`🗑️ ${num}. ${v.title.substring(0,25)}`, callback_data:`delete_video_${v.id}` }]); }
    const nav=[]; if(page>0) nav.push({ text:"◀️ Oldingi", callback_data:`video_manage_page_${page-1}` }); if(start+items<videos.length) nav.push({ text:"Keyingi ▶️", callback_data:`video_manage_page_${page+1}` }); if(nav.length) keyboard.push(nav);
    keyboard.push([{ text:"🔙 Ortga", callback_data:"back_to_main" }]);
    await bot.sendMessage(chatId, msg, { parse_mode:"Markdown", reply_markup:{ inline_keyboard:keyboard } });
}

// ========== FOYDALANUVCHILAR RO'YXATI ==========
let usersListPage = 0;
const USERS_PER_PAGE = 10;

async function showUsersList(chatId, page, messageId = null) {
    const usersList = getAllUsersWithDetails();
    const start = page * USERS_PER_PAGE;
    const end = start + USERS_PER_PAGE;
    const pageUsers = usersList.slice(start, end);
    const totalPages = Math.ceil(usersList.length / USERS_PER_PAGE);
    
    if (usersList.length === 0) {
        const msg = "📭 Hech qanday foydalanuvchi yo'q";
        if (messageId) await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
        else await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
        return;
    }
    
    let msg = "👥 *FOYDALANUVCHILAR*\n";
    msg += `📄 Sahifa ${page + 1}/${totalPages}\n`;
    msg += `👤 Jami: ${usersList.length} ta\n`;
    msg += "━━━━━━━━━━━━━━━━━━\n\n";
    
    for (let i = 0; i < pageUsers.length; i++) {
        const u = pageUsers[i];
        const num = start + i + 1;
        const status = u.isBlocked ? "🔴" : "🟢";
        const carNumber = u.cars.length > 0 ? u.cars[0].carNumber : "❌";
        msg += `${status} *${num}. ${(u.fullName || "Ismsiz").substring(0, 20)}*\n`;
        msg += `📞 ${u.phone}\n🚗 ${carNumber}\n🆔 ID: ${u.userId}\n📊 ${u.totalDiagnostics} ta\n━━━━━━━━━━━━━━━━━━\n`;
    }
    
    const keyboard = [];
    const nav = [];
    if (page > 0) nav.push({ text: "◀️ Oldingi", callback_data: `users_page_${page - 1}` });
    if (page + 1 < totalPages) nav.push({ text: "Keyingi ▶️", callback_data: `users_page_${page + 1}` });
    if (nav.length) keyboard.push(nav);
    keyboard.push([{ text: "🔙 Ortga", callback_data: "back_to_main" }]);
    
    if (messageId) await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
    else await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
}

// ========== FOYDALANUVCHILARNI BOSHQARISH ==========
let userManagePage = 0;
const USERS_MANAGE_PER_PAGE = 10;

async function showUsersForManage(chatId, page, messageId = null) {
    const allUsers = [...getActiveUsers(), ...getBlockedUsers()].filter(u => u.cars && u.cars.length > 0);
    const start = page * USERS_MANAGE_PER_PAGE;
    const end = start + USERS_MANAGE_PER_PAGE;
    const pageUsers = allUsers.slice(start, end);
    const totalPages = Math.ceil(allUsers.length / USERS_MANAGE_PER_PAGE);
    
    if (allUsers.length === 0) {
        const msg = "📭 Avtomobili bo'lgan foydalanuvchilar yo'q!";
        if (messageId) await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
        else await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
        return;
    }
    
    let msg = "👥 *FOYDALANUVCHILARNI BOSHQARISH*\n";
    msg += `🚗 Avtomobili bo'lganlar: ${allUsers.length} ta\n`;
    msg += `📄 Sahifa ${page + 1}/${totalPages}\n`;
    msg += "━━━━━━━━━━━━━━━━━━\n\n";
    
    const keyboard = [];
    for (let i = 0; i < pageUsers.length; i++) {
        const u = pageUsers[i];
        const num = start + i + 1;
        const status = u.isBlocked ? "🔴" : "🟢";
        const carNumber = u.cars[0].carNumber;
        msg += `${status} *${num}. ${(u.fullName || "Ismsiz").substring(0, 20)}*\n`;
        msg += `📞 ${u.phone}\n🚗 ${carNumber}\n📊 ${u.totalDiagnosticsAll || 0} ta\n━━━━━━━━━━━━━━━━━━\n`;
        keyboard.push([{ text: `👤 ${num}. ${carNumber.substring(0, 15)}`, callback_data: `manage_user_${u.userId}` }]);
    }
    
    const nav = [];
    if (page > 0) nav.push({ text: "◀️ Oldingi", callback_data: "users_manage_page_prev" });
    if (page + 1 < totalPages) nav.push({ text: "Keyingi ▶️", callback_data: "users_manage_page_next" });
    if (nav.length) keyboard.push(nav);
    keyboard.push([{ text: "🔙 Ortga", callback_data: "back_to_main" }]);
    
    if (messageId) await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
    else await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
}

function formatDiagnosticMessage(d, includePhone = false) {
    const total = (d.diagnosticPrice||0) + (d.laborPrice||0);
    let msg = `🔧 *DIAGNOSTIKA*\n\n🚗 ${d.carNumber}\n📅 ${formatTashkentDateTime(d.date)}\n\n`;
    if (includePhone && d.phoneNumber) msg += `👤 ${d.phoneNumber}\n\n`;
    msg += `📝 *Ishlar:*\n${d.workDescription}\n\n`;
    if (d.laborDescription && d.laborPrice>0) msg += `🔨 *Qo'shimcha:*\n${d.laborDescription}\n💰 ${d.laborPrice.toLocaleString()} so'm\n\n`;
    if (d.additionalNotes) msg += `📌 *Eslatma:*\n${d.additionalNotes}\n\n`;
    msg += `💰 *Jami:* ${total.toLocaleString()} so'm`;
    if (d.isFree) msg += `\n🎉 BEPUL!`;
    return msg;
}

// -------------------- SESSIONS --------------------
const userSessions = new Map();
function getUserSession(id) { if(!userSessions.has(id)) userSessions.set(id,{step:null,data:{}}); return userSessions.get(id); }
function clearUserSession(id) { userSessions.delete(id); }

// -------------------- BOTNI YARATISH --------------------
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.deleteWebHook().catch(e=>console.log(e.message));

// -------------------- /start --------------------
bot.onText(/\/start/, async (msg) => {
    const chatId=msg.chat.id, userId=msg.from.id, fn=msg.from.first_name||"", ln=msg.from.last_name||"", un=msg.from.username||"";
    clearUserSession(userId);
    const existing = getUserByUserId(userId);
    if(existing && existing.isBlocked) { await bot.sendMessage(chatId, "🚫 Siz bloklangansiz!", { parse_mode:"Markdown", ...removeKeyboard() }); return; }
    if(existing) {
        await bot.sendMessage(chatId, `👋 Xush kelibsiz, ${existing.fullName||fn}!\n📞 ${existing.phone}\n📌 Versiya: V${currentVersion}`, { parse_mode:"Markdown" });
        await sendMainMenu(chatId, isAdmin(userId), userId);
    } else {
        const s=getUserSession(userId);
        s.data={ firstName:fn, lastName:ln, username:un };
        await bot.sendMessage(chatId, "🚗 ISUZU DOCTOR ga xush kelibsiz!\n\n📱 Telefon raqamingizni yuboring:", { parse_mode:"Markdown", ...getPhoneKeyboard() });
    }
});

// -------------------- CONTACT --------------------
bot.on("contact", async (msg) => {
    const chatId=msg.chat.id, userId=msg.from.id, contact=msg.contact;
    if(!contact) return;
    let phone = contact.phone_number;
    if(!phone.startsWith("+")) phone="+"+phone;
    const s=getUserSession(userId);
    s.data.phone = phone;
    if(phone === ADMIN_PHONE) {
        users.push({ userId, phone, firstName:s.data.firstName, lastName:s.data.lastName, fullName:`${s.data.firstName} ${s.data.lastName}`.trim(), isAdmin:true, isBlocked:false, registeredDate:new Date().toISOString(), cars:[], totalBonusCount:0, totalFreeDiagnostics:0, totalDiagnosticsAll:0 });
        saveUsers();
        await bot.sendMessage(chatId, "👑 Admin paneliga xush kelibsiz!", { parse_mode:"Markdown" });
        await sendMainMenu(chatId, true, userId);
        clearUserSession(userId);
        return;
    }
    const existing = getUserByPhone(phone);
    if(existing && existing.userId !== userId) { await bot.sendMessage(chatId, "❌ Bu raqam band!", { parse_mode:"Markdown" }); return; }
    if(existing && existing.userId === userId) {
        s.step = "add_new_car";
        await bot.sendMessage(chatId, "✅ Telefon tasdiqlandi!\n🚗 Yangi avtomobil raqamini kiriting:", { parse_mode:"Markdown", ...removeKeyboard() });
    } else {
        s.step = "first_car_number";
        await bot.sendMessage(chatId, "✅ Telefon qabul qilindi!\n🚗 Birinchi avtomobil raqamini kiriting:", { parse_mode:"Markdown", ...removeKeyboard() });
    }
});

// -------------------- MESSAGE HANDLER --------------------
bot.on("message", async (msg) => {
    const chatId=msg.chat.id, userId=msg.from.id, text=msg.text;
    const video=msg.video, voice=msg.voice, photo=msg.photo, document=msg.document, location=msg.location;
    const session = getUserSession(userId);
    const user = getUserByUserId(userId);
    
    // VIDEO, OVOZ, RASM, HUJJAT BLOKLASH
    if(video) { await bot.sendMessage(chatId, "❌ Video qabul qilinmaydi! Faqat matn yoki lokatsiya.", { parse_mode:"Markdown" }); return; }
    if(voice) { await bot.sendMessage(chatId, "❌ Ovozli xabar qabul qilinmaydi! Matn yozing.", { parse_mode:"Markdown" }); return; }
    if(photo) { await bot.sendMessage(chatId, "❌ Rasm qabul qilinmaydi!", { parse_mode:"Markdown" }); return; }
    if(document) { await bot.sendMessage(chatId, "❌ Hujjat qabul qilinmaydi!", { parse_mode:"Markdown" }); return; }
    
    // LOKATSIYA
    if(location) {
        if(session.step === "conversation_mode" || session.data.inConversation) {
            if(isAdmin(userId)) {
                const targetId = session.data.replyingToUserId;
                if(targetId) {
                    addAdminReply(userId, targetId, "", "location", { latitude:location.latitude, longitude:location.longitude });
                    await bot.sendMessage(chatId, "✅ Lokatsiya yuborildi!", { parse_mode:"Markdown" });
                    const lat=location.latitude, lng=location.longitude;
                    const locationMsg = `📍 *Admin lokatsiya yubordi*\n\n🗺️ [Google Maps](https://www.google.com/maps?q=${lat},${lng})\n🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${lng},${lat}&z=15)\n🗺️ [2GIS](https://2gis.uz/search/${lat},${lng})\n🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15)`;
                    await bot.sendMessage(targetId, locationMsg, { parse_mode:"Markdown", disable_web_page_preview:true });
                    await showConversation(chatId, userId, true, targetId);
                }
            } else {
                addMessage(userId, ADMIN_IDS[0], "", "location", { latitude:location.latitude, longitude:location.longitude });
                await bot.sendMessage(chatId, "✅ Lokatsiya yuborildi! Admin javob beradi.", { parse_mode:"Markdown" });
                const uname = user ? (user.fullName || user.phone) : "Foydalanuvchi";
                const lat=location.latitude, lng=location.longitude;
                const locationMsg = `📍 *Yangi lokatsiya*\n👤 ${uname}\n🆔 ${userId}\n\n🗺️ [Google Maps](https://www.google.com/maps?q=${lat},${lng})\n🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${lng},${lat}&z=15)\n🗺️ [2GIS](https://2gis.uz/search/${lat},${lng})\n🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15)\n\n💬 Javob berish uchun "💬 Muloqotlar" tugmasini bosing!`;
                for(const aid of ADMIN_IDS) await bot.sendMessage(aid, locationMsg, { parse_mode:"Markdown", disable_web_page_preview:true });
                session.step = "conversation_mode";
                session.data.inConversation = true;
            }
        } else if(!isAdmin(userId) && user && !user.isBlocked) {
            addMessage(userId, ADMIN_IDS[0], "", "location", { latitude:location.latitude, longitude:location.longitude });
            await bot.sendMessage(chatId, "✅ Lokatsiya yuborildi! Admin javob beradi.", { parse_mode:"Markdown" });
            const uname = user ? (user.fullName || user.phone) : "Foydalanuvchi";
            const lat=location.latitude, lng=location.longitude;
            const locationMsg = `📍 *Yangi lokatsiya*\n👤 ${uname}\n🆔 ${userId}\n\n🗺️ [Google Maps](https://www.google.com/maps?q=${lat},${lng})\n🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${lng},${lat}&z=15)\n🗺️ [2GIS](https://2gis.uz/search/${lat},${lng})\n🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15)\n\n💬 Javob berish uchun "💬 Muloqotlar" tugmasini bosing!`;
            for(const aid of ADMIN_IDS) await bot.sendMessage(aid, locationMsg, { parse_mode:"Markdown", disable_web_page_preview:true });
            session.step = "conversation_mode";
            session.data.inConversation = true;
        }
        return;
    }
    
    // BEKOR QILISH
    if(text === "🔙 Bekor qilish" || text === "🔙 Asosiy menyu" || text === "🔙 Muloqotlar ro'yxati") {
        clearUserSession(userId);
        await sendMainMenu(chatId, isAdmin(userId), userId);
        return;
    }
    
    // ADMIN MULOQOTNI O'CHIRISH
    if(isAdmin(userId) && text === "🗑️ Bu muloqotni o'chirish") {
        const targetId = session.data.replyingToUserId;
        if(targetId) {
            const conv = conversations.find(c => c.userId === targetId);
            if(conv) {
                const result = deleteConversation(conv.id, userId);
                await bot.sendMessage(chatId, result.message, { parse_mode:"Markdown" });
                await showAllConversations(chatId, 0);
                clearUserSession(userId);
                return;
            }
        }
    }
    
    // ADMIN XARITADAN LOKATSIYA TANLASH
    if(isAdmin(userId) && text === "🗺️ Xaritadan lokatsiya tanlash") {
        if(session.step === "conversation_mode") {
            await bot.sendMessage(chatId, "🗺️ *Xaritadan lokatsiya tanlash*\n\nGoogle Maps linki yoki koordinata kiriting:\nhttps://www.google.com/maps?q=40.7128,-74.0060\nYoki: 40.7128, -74.0060", { parse_mode:"Markdown" });
            session.step = "admin_waiting_map_location";
            return;
        }
    }
    
    // XARITA LINKI YOKI KOORDINATA
    if(session.step === "admin_waiting_map_location") {
        if(!isAdmin(userId)) return;
        if(text === "/cancel") {
            clearUserSession(userId);
            await showConversation(chatId, userId, true, session.data.replyingToUserId);
            return;
        }
        const loc = parseMapUrl(text);
        if (!loc) { await bot.sendMessage(chatId, "❌ Noto'g'ri format!", { parse_mode:"Markdown" }); return; }
        const targetId = session.data.replyingToUserId;
        if (targetId) {
            addAdminReply(userId, targetId, "", "location", { latitude: loc.lat, longitude: loc.lng });
            await bot.sendMessage(chatId, `✅ Lokatsiya yuborildi! ${loc.lat}, ${loc.lng}`, { parse_mode:"Markdown" });
            const locationMsg = `📍 *Admin lokatsiya yubordi*\n\n🗺️ [Google Maps](https://www.google.com/maps?q=${loc.lat},${loc.lng})\n🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${loc.lng},${loc.lat}&z=15)\n🗺️ [2GIS](https://2gis.uz/search/${loc.lat},${loc.lng})\n🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}&zoom=15)`;
            await bot.sendMessage(targetId, locationMsg, { parse_mode:"Markdown", disable_web_page_preview:true });
            await showConversation(chatId, userId, true, targetId);
            clearUserSession(userId);
        }
        return;
    }
    
    // ADMIN VIDEO YUKLASH
    if(session.step === "admin_waiting_video") {
        if(!isAdmin(userId)) return;
        if(text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
        if(msg.video) {
            session.data.videoFileId = msg.video.file_id;
            session.step = "admin_waiting_video_title";
            await bot.sendMessage(chatId, "✅ Video qabul qilindi!\n📝 Video nomini kiriting:", { parse_mode:"Markdown" });
        } else { await bot.sendMessage(chatId, "❌ Video fayl yuboring!", { parse_mode:"Markdown" }); }
        return;
    }
    if(session.step === "admin_waiting_video_title") {
        if(!isAdmin(userId)) return;
        if(text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
        if(!text || text.length<3) { await bot.sendMessage(chatId, "❌ Kamida 3 harf kiriting"); return; }
        session.data.title = text;
        session.step = "admin_waiting_video_description";
        await bot.sendMessage(chatId, "✅ Nom qabul qilindi!\n📝 Tavsif (ixtiyoriy):", { parse_mode:"Markdown" });
        return;
    }
    if(session.step === "admin_waiting_video_description") {
        if(!isAdmin(userId)) return;
        if(text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
        addVideo(session.data.videoFileId, session.data.title, text || "", userId);
        await bot.sendMessage(chatId, "✅ Video yuklandi!", { parse_mode:"Markdown" });
        clearUserSession(userId);
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    // ADMIN XABAR YUBORISH
    if(session.step === "admin_send_message") {
        if(!isAdmin(userId)) return;
        if(text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
        await bot.sendMessage(chatId, "📢 Xabar yuborilmoqda...", { parse_mode:"Markdown" });
        const res = await sendNotificationToAllUsers(text);
        await bot.sendMessage(chatId, `✅ Yuborildi: ${res.success} ta\n❌ Yuborilmadi: ${res.fail} ta`, { parse_mode:"Markdown" });
        clearUserSession(userId);
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    // ADMIN VERSIYA
    if(session.step === "admin_update_version") {
        if(!isAdmin(userId)) return;
        if(text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
        if(!/^\d+\.\d+$/.test(text)) { await bot.sendMessage(chatId, "❌ Format: 2.2", { parse_mode:"Markdown" }); return; }
        session.data.newVersion = text;
        session.step = "admin_version_changes";
        await bot.sendMessage(chatId, "📝 O'zgarishlar tavsifi:", { parse_mode:"Markdown" });
        return;
    }
    if(session.step === "admin_version_changes") {
        if(!isAdmin(userId)) return;
        if(text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
        currentVersion = session.data.newVersion;
        await bot.sendMessage(chatId, `✅ Versiya yangilandi: V${currentVersion}`, { parse_mode:"Markdown" });
        clearUserSession(userId);
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    // MUHOQOT REJIMI
    if(session.step === "conversation_mode" || session.data.inConversation) {
        if(isAdmin(userId)) {
            const targetId = session.data.replyingToUserId;
            if(targetId && text && !text.startsWith("/") && text !== "🗑️ Bu muloqotni o'chirish" && text !== "🔙 Muloqotlar ro'yxati" && text !== "🗺️ Xaritadan lokatsiya tanlash") {
                addAdminReply(userId, targetId, text, "text", null);
                await bot.sendMessage(chatId, "✅ Javob yuborildi!", { parse_mode:"Markdown" });
                await bot.sendMessage(targetId, `👑 *Admin javobi:*\n\n${text}`, { parse_mode:"Markdown" });
                await showConversation(chatId, userId, true, targetId);
            } else if(text === "🔙 Muloqotlar ro'yxati") {
                await showAllConversations(chatId, 0);
                clearUserSession(userId);
                return;
            }
        } else if(text && !text.startsWith("/")) {
            addMessage(userId, ADMIN_IDS[0], text, "text", null);
            await bot.sendMessage(chatId, "✅ Xabar yuborildi! Admin javob beradi.", { parse_mode:"Markdown" });
            const uname = user ? (user.fullName || user.phone) : "Foydalanuvchi";
            for(const aid of ADMIN_IDS) await bot.sendMessage(aid, `💬 *Yangi xabar*\n👤 ${uname}\n📝 ${text}\n\n💬 "💬 Muloqotlar" tugmasini bosing!`, { parse_mode:"Markdown" });
        }
        return;
    }
    
    if(!text || text==="/start" || text.startsWith("/")) return;
    if(!user) { await bot.sendMessage(chatId, "❌ /start bosing", { parse_mode:"Markdown" }); return; }
    if(user.isBlocked) { await bot.sendMessage(chatId, "🚫 Siz bloklangansiz!", { parse_mode:"Markdown" }); return; }
    
    // YANGI AVTOMOBIL QO'SHISH
    if(session.step === "first_car_number") {
        const car = text.toUpperCase().trim();
        if(car.length<2 || car.length>10) { await bot.sendMessage(chatId, "❌ Noto'g'ri raqam!", { parse_mode:"Markdown" }); return; }
        addNewUser(userId, session.data.phone, car, session.data.firstName||"", session.data.lastName||"", session.data.username||"");
        await bot.sendMessage(chatId, `✅ Ro'yxatdan o'tdingiz!\n🚗 ${car}\n🎁 5 diagnostika = 1 BEPUL!`, { parse_mode:"Markdown" });
        clearUserSession(userId);
        await sendMainMenu(chatId, false, userId);
        return;
    }
    if(session.step === "add_new_car") {
        const car = text.toUpperCase().trim();
        if(car.length<2 || car.length>10) { await bot.sendMessage(chatId, "❌ Noto'g'ri raqam!", { parse_mode:"Markdown" }); return; }
        const res = addCarToUser(session.data.phone, car);
        await bot.sendMessage(chatId, res.message, { parse_mode:"Markdown" });
        clearUserSession(userId);
        await sendMainMenu(chatId, false, userId);
        return;
    }
    
    // ADMIN DIAGNOSTIKA
    if(session.step === "admin_add_diagnostic") {
        if(!isAdmin(userId)) return;
        const car = text.toUpperCase().trim();
        let foundUser=null, foundCar=null;
        for(const u of users) { const c = u.cars.find(c=>c.carNumber===car); if(c) { foundUser=u; foundCar=c; break; } }
        if(!foundUser) { await bot.sendMessage(chatId, "❌ Avtomobil topilmadi!", { parse_mode:"Markdown" }); return; }
        session.data.targetUser = foundUser;
        session.data.targetCar = foundCar;
        session.step = "admin_work_description";
        await bot.sendMessage(chatId, `✅ ${foundUser.fullName}\n🚗 ${foundCar.carNumber}\n🔧 Ish tavsifi:`, { parse_mode:"Markdown" });
        return;
    }
    if(session.step === "admin_work_description") {
        if(!isAdmin(userId)) return;
        session.data.workDescription = text;
        session.step = "admin_extra_work_question";
        await bot.sendMessage(chatId, "➕ Qo'shimcha ish? (ha/yo'q)", { parse_mode:"Markdown" });
        return;
    }
    if(session.step === "admin_extra_work_question") {
        if(!isAdmin(userId)) return;
        if(text.toLowerCase()==="ha" || text.toLowerCase()==="bor") {
            session.step = "admin_extra_work_price";
            await bot.sendMessage(chatId, "💰 Narxi:", { parse_mode:"Markdown" });
        } else {
            session.data.extraWorkPrice = 0;
            session.data.extraWorkDescription = "";
            session.step = "admin_additional_notes";
            await bot.sendMessage(chatId, "📝 Qo'shimcha eslatma:", { parse_mode:"Markdown" });
        }
        return;
    }
    if(session.step === "admin_extra_work_price") {
        if(!isAdmin(userId)) return;
        const price = parseInt(text);
        if(isNaN(price)) { await bot.sendMessage(chatId, "❌ Son kiriting!", { parse_mode:"Markdown" }); return; }
        session.data.extraWorkPrice = price;
        session.step = "admin_extra_work_description";
        await bot.sendMessage(chatId, "📝 Ish tavsifi:", { parse_mode:"Markdown" });
        return;
    }
    if(session.step === "admin_extra_work_description") {
        if(!isAdmin(userId)) return;
        session.data.extraWorkDescription = text;
        session.step = "admin_additional_notes";
        await bot.sendMessage(chatId, "📝 Qo'shimcha eslatma:", { parse_mode:"Markdown" });
        return;
    }
    if(session.step === "admin_additional_notes") {
        if(!isAdmin(userId)) return;
        const res = addDiagnosticToCar(session.data.targetUser.phone, session.data.targetCar.carNumber, session.data.workDescription, text||"", session.data.extraWorkPrice||0, session.data.extraWorkDescription||"");
        if(res.success) {
            await bot.sendMessage(chatId, `✅ Diagnostika qo'shildi!\n💰 ${res.totalPrice.toLocaleString()} so'm\n${res.bonusMessage}`, { parse_mode:"Markdown" });
            await bot.sendMessage(session.data.targetUser.userId, formatDiagnosticMessage({ carNumber:res.carNumber, date:new Date(), workDescription:session.data.workDescription, additionalNotes:text, diagnosticPrice:res.diagnosticPrice, laborPrice:res.laborPrice, isFree:res.isFree }), { parse_mode:"Markdown" });
        } else { await bot.sendMessage(chatId, "❌ Xatolik!", { parse_mode:"Markdown" }); }
        clearUserSession(userId);
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    // ADMIN MATNLI BUYRUQLAR
    if(isAdmin(userId)) {
        if(text === "📊 Statistika") { 
            const s=getStatistics(); 
            await bot.sendMessage(chatId, `📊 *STATISTIKA*\n━━━━━━━━━━━━━━━━━━\n👥 Foydalanuvchilar: ${s.totalUsers}\n🚫 Bloklangan: ${s.blockedUsers}\n🚗 Avtomobillar: ${s.totalCars}\n🔧 Diagnostikalar: ${s.totalDiagnostics}\n💰 Diagnostika: ${s.diagnosticIncome.toLocaleString()} so'm\n🔨 Mehnat: ${s.laborIncome.toLocaleString()} so'm\n💵 Jami: ${s.totalIncome.toLocaleString()} so'm\n📹 Videolar: ${s.totalVideos}\n💬 O'qilmagan: ${s.unreadMessages}\n📌 Versiya: V${s.currentVersion}`, { parse_mode:"Markdown" }); 
            await sendMainMenu(chatId,true,userId); 
        }
        else if(text === "👥 Foydalanuvchilar") { 
            usersListPage = 0; 
            await showUsersList(chatId, usersListPage); 
        }
        else if(text === "🔧 Diagnostika") { 
            const s=getUserSession(userId); 
            s.step="admin_add_diagnostic"; 
            await bot.sendMessage(chatId, "🔧 Avtomobil raqamini kiriting:", { parse_mode:"Markdown", ...removeKeyboard() }); 
        }
        else if(text === "🎁 Bonusga yaqinlar") { 
            const near=getNearBonusCars(); 
            let msg="🎁 *BONUSGA YAQINLAR*\n━━━━━━━━━━━━━━━━━━\n"; 
            near.forEach(c=>{ msg+=`👤 ${c.fullName}\n🚗 ${c.carNumber}\n🎁 ${c.bonusCount}/5\n📌 ${c.remaining} ta qoldi\n━━━━━━━━━━━━━━━━━━\n`; }); 
            await bot.sendMessage(chatId, msg||"Hech kim yo'q", { parse_mode:"Markdown" }); 
            await sendMainMenu(chatId,true,userId); 
        }
        else if(text === "⚠️ Xatoliklar") { 
            const errs=getErrors(); 
            let msg="⚠️ *XATOLIKLAR*\n"; 
            errs.slice(0,10).forEach(e=>{ msg+=`\n🚗 ${e.carNumber}\n📝 ${e.errorDescription}\n📅 ${formatTashkentDateTime(e.date)}\n━━━━━━━━━━━━━━━━━━\n`; }); 
            await bot.sendMessage(chatId, msg||"Xatoliklar yo'q", { parse_mode:"Markdown" }); 
            await sendMainMenu(chatId,true,userId); 
        }
        else if(text === "📋 Diagnostika tarixi") { 
            const keyboard = {
                inline_keyboard: [
                    [{ text: "📄 Fayl sifatida yuklab olish", callback_data: "download_diagnostics_history" }],
                    [{ text: "📝 Matn sifatida ko'rish", callback_data: "view_diagnostics_text" }],
                    [{ text: "🔙 Ortga", callback_data: "back_to_main" }]
                ]
            };
            await bot.sendMessage(chatId, "📋 *DIAGNOSTIKA TARIXI*\n\nQanday ko'rinishda olishni tanlang:", { parse_mode:"Markdown", reply_markup: keyboard });
            return;
        }
        else if(text === "📅 Bugungi") { 
            const diags=getTodayDiagnostics(); 
            let inc=0,lib=0,free=0; 
            for(const d of diags) { 
                if(d.diagnosticPrice>0) inc+=d.diagnosticPrice; 
                else if(d.isFree) free++; 
                if(d.laborPrice) lib+=d.laborPrice; 
            } 
            await bot.sendMessage(chatId, `📅 *BUGUNGI*\n━━━━━━━━━━━━━━━━━━\n📊 ${diags.length} ta\n💰 Diagnostika: ${inc.toLocaleString()} so'm\n🔨 Mehnat: ${lib.toLocaleString()} so'm\n💵 Jami: ${(inc+lib).toLocaleString()} so'm\n🎉 Bepul: ${free} ta`, { parse_mode:"Markdown" }); 
            await sendMainMenu(chatId,true,userId); 
        }
        else if(text === "📄 Hisobot") { 
            await bot.sendMessage(chatId, "📄 *Hisobot tayyorlanmoqda...*", { parse_mode: "Markdown" });
            try {
                const report = await generateFullReport(chatId);
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
                const filepath = path.join(REPORTS_DIR, `hisobot_${timestamp}.txt`);
                const plainReport = report.replace(/\*/g, '').replace(/━/g, '-');
                fs.writeFileSync(filepath, plainReport, "utf8");
                await bot.sendMessage(chatId, report, { parse_mode: "Markdown" });
                await bot.sendDocument(chatId, filepath, { caption: `📊 *HISOBOT*\n📅 ${formatTashkentDateTime(new Date())}\n📌 V${currentVersion}`, parse_mode: "Markdown" });
                setTimeout(() => fs.unlinkSync(filepath), 60000);
            } catch(e) { await bot.sendMessage(chatId, "❌ Xatolik!", { parse_mode:"Markdown" }); }
            await sendMainMenu(chatId, true, userId);
            return;
        }
        else if(text === "📹 Video galereya") { await showVideoGallery(chatId); await sendMainMenu(chatId,true,userId); }
        else if(text === "📤 Video yuklash") { const s=getUserSession(userId); s.step="admin_waiting_video"; s.data={}; await bot.sendMessage(chatId, "📤 Video fayl yuboring", { parse_mode:"Markdown" }); }
        else if(text === "🗑️ Video o'chirish") { await showVideoManagement(chatId); }
        else if(text === "💾 Backup") { createBackup(); await bot.sendMessage(chatId, "✅ Backup yaratildi", { parse_mode:"Markdown" }); await sendMainMenu(chatId,true,userId); }
        else if(text === "🔄 Tiklash") { await bot.sendMessage(chatId, "❌ Backup yo'q", { parse_mode:"Markdown" }); await sendMainMenu(chatId,true,userId); }
        else if(text === "🚫 Foyd. boshqarish") { 
            userManagePage = 0;
            await showUsersForManage(chatId, userManagePage);
        }
        else if(text === "🔐 Xavfsizlik") { await bot.sendMessage(chatId, "🔐 Xavfsizlik paneli", { reply_markup:{ inline_keyboard:[[{text:"🔙 Ortga", callback_data:"security_back"}]] } }); }
        else if(text === "📌 Versiya") { await bot.sendMessage(chatId, `📌 Versiya: V${currentVersion}`, { parse_mode:"Markdown" }); await sendMainMenu(chatId,true,userId); }
        else if(text === "📢 Xabar yuborish") { const s=getUserSession(userId); s.step="admin_send_message"; await bot.sendMessage(chatId, "📢 Xabarni kiriting:", { parse_mode:"Markdown", ...removeKeyboard() }); }
        else if(text && (text === "💬 Muloqotlar" || text.includes("💬 Muloqotlar"))) { await showAllConversations(chatId, 0); return; }
        else if(text === "❌ Asosiy menyu") { clearUserSession(userId); userManagePage=0; usersListPage=0; await sendMainMenu(chatId,true,userId); }
        else if(!session.step) { await bot.sendMessage(chatId, "❌ Tushunarsiz buyruq!", { parse_mode:"Markdown" }); await sendMainMenu(chatId,true,userId); }
        return;
    }
    
    if(!session.step) { await bot.sendMessage(chatId, "❌ Tugmalardan foydalaning!", { parse_mode:"Markdown" }); await sendMainMenu(chatId,false,userId); }
});

// -------------------- CALLBACK --------------------
bot.on("callback_query", async (query) => {
    const chatId=query.message.chat.id, data=query.data, userId=query.from.id, msgId=query.message.message_id;
    await bot.answerCallbackQuery(query.id);
    const user = getUserByUserId(userId);
    
    // Admin bilan bog'lanish
    if(data === "user_contact_admin") { 
        const s=getUserSession(userId); 
        s.step="conversation_mode"; 
        s.data.inConversation=true; 
        await bot.sendMessage(chatId, CONTACT_ADMIN_MESSAGE, { parse_mode:"Markdown", ...getLocationKeyboard() });
        return; 
    }
    
    // Foydalanuvchilar sahifalari
    if(data.startsWith("users_page_")) {
        if(!isAdmin(userId)) return;
        const page = parseInt(data.split("_")[2]);
        if(isNaN(page)) return;
        usersListPage = page;
        await showUsersList(chatId, page, msgId);
        return;
    }
    
    // Foydalanuvchilarni boshqarish sahifalari
    if(data === "users_manage_page_prev") {
        if(!isAdmin(userId)) return;
        if(userManagePage > 0) {
            userManagePage--;
            await showUsersForManage(chatId, userManagePage, msgId);
        }
        return;
    }
    
    if(data === "users_manage_page_next") {
        if(!isAdmin(userId)) return;
        const allUsers = [...getActiveUsers(), ...getBlockedUsers()].filter(u => u.cars && u.cars.length > 0);
        const totalPages = Math.ceil(allUsers.length / USERS_MANAGE_PER_PAGE);
        if(userManagePage + 1 < totalPages) {
            userManagePage++;
            await showUsersForManage(chatId, userManagePage, msgId);
        }
        return;
    }
    
    // Diagnostika tarixi
    if(data === "download_diagnostics_history") {
        if(!isAdmin(userId)) return;
        await bot.sendMessage(chatId, "📄 Fayl tayyorlanmoqda...", { parse_mode:"Markdown" });
        const filepath = await generateDiagnosticsHistoryFile(chatId, 500);
        if (filepath && fs.existsSync(filepath)) {
            await bot.sendDocument(chatId, filepath, { caption: `📋 *DIAGNOSTIKA TARIXI*\n📅 ${formatTashkentDateTime(new Date())}\n📌 V${currentVersion}`, parse_mode:"Markdown" });
            setTimeout(() => fs.unlinkSync(filepath), 60000);
        }
        return;
    }
    
    if(data === "view_diagnostics_text") {
        if(!isAdmin(userId)) return;
        const diags = getAllDiagnostics(20);
        if (diags.length === 0) { await bot.sendMessage(chatId, "📭 Diagnostikalar yo'q", { parse_mode:"Markdown" }); return; }
        for (const d of diags.slice(0, 10)) await bot.sendMessage(chatId, formatDiagnosticMessage(d, true), { parse_mode:"Markdown" });
        if (diags.length > 10) await bot.sendMessage(chatId, `📊 Yana ${diags.length - 10} ta bor. "Fayl sifatida yuklab olish" tugmasini bosing.`, { parse_mode:"Markdown" });
        return;
    }
    
    if(data.startsWith("open_conversation_")) { if(!isAdmin(userId)) return; const targetId=parseInt(data.split("_")[2]); const s=getUserSession(userId); s.step="conversation_mode"; s.data.inConversation=true; s.data.replyingToUserId=targetId; await showConversation(chatId, userId, true, targetId); return; }
    if(data.startsWith("conversations_page_")) { if(!isAdmin(userId)) return; const page=parseInt(data.split("_")[2]); await showAllConversations(chatId,page); return; }
    if(data.startsWith("delete_conv_")) { if(!isAdmin(userId)) return; const convId=parseInt(data.split("_")[2]); const res=deleteConversation(convId,userId); await bot.answerCallbackQuery(query.id,{text:res.message,show_alert:true}); await showAllConversations(chatId,0); return; }
    if(data.startsWith("delete_video_")) { if(!isAdmin(userId)) return; const vid=parseInt(data.split("_")[2]); deleteVideo(vid); await bot.sendMessage(chatId, "✅ Video o'chirildi"); await showVideoManagement(chatId); return; }
    if(data.startsWith("watch_video_")) { const vid=parseInt(data.split("_")[2]); const v=videoList.find(v=>v.id===vid); if(v && v.fileId) await bot.sendVideo(chatId, v.fileId, { caption:`📹 ${v.title}` }); else await bot.sendMessage(chatId, "❌ Video topilmadi"); return; }
    if(data === "back_to_main") { clearUserSession(userId); await sendMainMenu(chatId, isAdmin(userId), userId); return; }
    if(data === "user_profile") { const carsList=user.cars.map(c=>`🚗 ${c.carNumber} (${c.totalDiagnostics} ta)`).join("\n"); await bot.sendMessage(chatId, `📊 PROFIL\n👤 ${user.fullName||"Ismsiz"}\n📞 ${user.phone}\n🚗 ${user.cars.length}/${MAX_CARS_PER_USER}\n\n${carsList}\n🎁 Bonus: ${user.totalBonusCount||0}\n🎉 Bepul: ${user.totalFreeDiagnostics||0}\n📌 Versiya: V${currentVersion}`, { parse_mode:"Markdown" }); await sendMainMenu(chatId,false,userId); return; }
    if(data === "user_my_cars") { let msg="🚗 AVTOMOBILLAR\n━━━━━━━━━━━━━━━━━━\n"; for(const c of user.cars) msg+=`\n🚗 ${c.carNumber}\n🎁 Bonus: ${c.bonusCount}/5\n🎉 Bepul: ${c.freeDiagnostics}\n━━━━━━━━━━━━━━━━━━\n`; await bot.sendMessage(chatId, msg, { parse_mode:"Markdown" }); await sendMainMenu(chatId,false,userId); return; }
    if(data === "user_my_bonus") { let msg="🎁 BONUSLAR\n━━━━━━━━━━━━━━━━━━\n"; for(const c of user.cars) msg+=`\n🚗 ${c.carNumber}\n📊 ${c.bonusCount}/5\n🎉 Bepul: ${c.freeDiagnostics}\n━━━━━━━━━━━━━━━━━━\n`; await bot.sendMessage(chatId, msg, { parse_mode:"Markdown" }); await sendMainMenu(chatId,false,userId); return; }
    if(data === "user_add_car") { if(user.cars.length>=MAX_CARS_PER_USER) { await bot.sendMessage(chatId, `❌ Maksimum ${MAX_CARS_PER_USER} ta!`); await sendMainMenu(chatId,false,userId); return; } const s=getUserSession(userId); s.step="add_new_car"; s.data.phone=user.phone; await bot.sendMessage(chatId, "🚗 Yangi avtomobil raqamini kiriting:", { parse_mode:"Markdown", ...removeKeyboard() }); return; }
    if(data === "user_history") { const diags=diagnostics.filter(d=>d.phoneNumber===user.phone).slice(-10).reverse(); if(diags.length===0) await bot.sendMessage(chatId, "📭 Diagnostikalar yo'q"); else for(const d of diags) await bot.sendMessage(chatId, formatDiagnosticMessage(d), { parse_mode:"Markdown" }); await sendMainMenu(chatId,false,userId); return; }
    if(data === "user_video_gallery") { await showVideoGallery(chatId); await sendMainMenu(chatId,false,userId); return; }
    if(data === "user_payment") { await bot.sendMessage(chatId, getCardInfoMessage(), { parse_mode:"Markdown" }); await sendMainMenu(chatId,false,userId); return; }
    if(data === "user_instagram") { await bot.sendMessage(chatId, `📸 Instagram\n${INSTAGRAM_LINK}`, { reply_markup:{ inline_keyboard:[[{text:"📸 Ochish", url:INSTAGRAM_LINK}]] } }); return; }
    if(data === "user_telegram_group") { await bot.sendMessage(chatId, `👥 Guruh\n${TELEGRAM_GROUP_LINK}`, { reply_markup:{ inline_keyboard:[[{text:"👥 Ochish", url:TELEGRAM_GROUP_LINK}]] } }); return; }
    if(data === "user_info") { await bot.sendMessage(chatId, `ℹ️ MA'LUMOT\n🚗 Avto diagnostika\n🎁 5 diagnostika = 1 BEPUL\n📱 ${MAX_CARS_PER_USER} tagacha avto\n📞 ${ADMIN_PHONE}\n📌 Versiya: V${currentVersion}`, { parse_mode:"Markdown" }); await sendMainMenu(chatId,false,userId); return; }
    if(data === "user_version_info") { await bot.sendMessage(chatId, `📌 Versiya: V${currentVersion}`, { parse_mode:"Markdown" }); await sendMainMenu(chatId,false,userId); return; }
    if(data === "security_back") { await sendMainMenu(chatId,true,userId); return; }
    if(data === "admin_manage_users_back") { userManagePage=0; await sendMainMenu(chatId,true,userId); return; }
    if(data.startsWith("manage_user_")) { const targetId=parseInt(data.split("_")[2]); const tu=getUserByUserId(targetId); if(!tu) return; const info=`👤 ${tu.fullName||"Ismsiz"}\n📞 ${tu.phone}\n🚦 ${tu.isBlocked?"🔴 BLOKLANGAN":"🟢 FAOL"}\n🆔 ${tu.userId}\n📊 ${tu.totalDiagnosticsAll||0} ta diagnostika`; const kb=[]; if(tu.isBlocked) kb.push([{ text:"✅ Blokdan ochish", callback_data:`unblock_user_${tu.userId}` }]); else kb.push([{ text:"🚫 Bloklash", callback_data:`block_user_${tu.userId}` }]); kb.push([{ text:"🗑️ O'chirish", callback_data:`delete_user_${tu.userId}` }]); kb.push([{ text:"🔙 Ortga", callback_data:"admin_manage_users_back" }]); await bot.editMessageText(info, { chat_id:chatId, message_id:msgId, parse_mode:"Markdown", reply_markup:{ inline_keyboard:kb } }); return; }
    if(data.startsWith("block_user_")) { const id=parseInt(data.split("_")[2]); const res=blockUser(id); await bot.sendMessage(chatId, res.message, { parse_mode:"Markdown" }); await sendMainMenu(chatId,true,userId); return; }
    if(data.startsWith("unblock_user_")) { const id=parseInt(data.split("_")[2]); const res=unblockUser(id); await bot.sendMessage(chatId, res.message, { parse_mode:"Markdown" }); await sendMainMenu(chatId,true,userId); return; }
    if(data.startsWith("delete_user_")) { const id=parseInt(data.split("_")[2]); const res=deleteUser(id); await bot.sendMessage(chatId, res.message, { parse_mode:"Markdown" }); await sendMainMenu(chatId,true,userId); return; }
});

// -------------------- BACKUP --------------------
function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    if(fs.existsSync(USERS_FILE)) fs.copyFileSync(USERS_FILE, path.join(BACKUP_DIR, `users_backup_${timestamp}.json`));
    if(fs.existsSync(DIAGNOSTICS_FILE)) fs.copyFileSync(DIAGNOSTICS_FILE, path.join(BACKUP_DIR, `diagnostics_backup_${timestamp}.json`));
    if(fs.existsSync(CONVERSATIONS_FILE)) fs.copyFileSync(CONVERSATIONS_FILE, path.join(BACKUP_DIR, `conversations_backup_${timestamp}.json`));
    console.log("✅ Backup yaratildi");
}

// -------------------- BOTNI ISHGA TUSHIRISH --------------------
loadData();
loadVideos();
loadConversations();
loadAdminSettings();
console.log("=".repeat(50));
console.log(`🚗 ISUZU DOCTOR BOT ISHLADI! Versiya: V${currentVersion}`);
console.log(`👑 Adminlar: ${ADMIN_IDS.join(", ")}`);
console.log(`👥 Foydalanuvchilar: ${users.filter(u=>!u.isAdmin).length}`);
console.log(`🔧 Diagnostikalar: ${diagnostics.length}`);
console.log(`💬 Muloqotlar: ${conversations.length}`);
console.log("=".repeat(50));
