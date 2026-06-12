const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

// ======================== AVTORLIK HUQUQI VA LITSENZIYA ========================
const LICENSE_KEY = "ISUZU_DOCTOR_BOT_V2";
const BOT_OWNER = "Erkinjon Shukurov";
const BOT_OWNER_TELEGRAM = "@Erkinjon_Shukurov";
let currentVersion = "3.5";

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

// -------------------- VAQT ZONASI (TO'G'RILANGAN) --------------------
function formatTashkentDateTime(date) {
    const d = new Date(date);
    return d.toLocaleString('uz-UZ', { 
        timeZone: 'Asia/Tashkent',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
}

function formatDateSimple(date) {
    if (!date) return "❌ Sana yo'q";
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return "❌ Xato sana";
        // Toshkent vaqtida formatlash
        const tashkentDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
        return `${tashkentDate.getDate().toString().padStart(2,'0')}.${(tashkentDate.getMonth()+1).toString().padStart(2,'0')}.${tashkentDate.getFullYear()}`;
    } catch(e) { return "❌ Xato sana"; }
}

function formatTimeSimple(date) {
    if (!date) return "❌ Vaqt yo'q";
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return "❌ Xato vaqt";
        const tashkentDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
        return `${tashkentDate.getHours().toString().padStart(2,'0')}:${tashkentDate.getMinutes().toString().padStart(2,'0')}`;
    } catch(e) { return "❌ Xato vaqt"; }
}

function formatFullDateTime(date) {
    const d = new Date(date);
    const tashkentDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
    const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 
                    'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
    return `${tashkentDate.getDate()}-${months[tashkentDate.getMonth()]}, ${tashkentDate.getFullYear()} ${tashkentDate.getHours().toString().padStart(2,'0')}:${tashkentDate.getMinutes().toString().padStart(2,'0')}:${tashkentDate.getSeconds().toString().padStart(2,'0')}`;
}

function getCurrentTashkentTime() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
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
const DELETED_CARS_FILE = path.join(VOLUME_PATH, 'deleted_cars.json');
const DELETED_DIAGNOSTICS_FILE = path.join(VOLUME_PATH, 'deleted_diagnostics.json');

// -------------------- O'CHIRILGAN MA'LUMOTLAR --------------------
let deletedCars = [];
let deletedDiagnostics = [];

function loadDeletedData() {
    try {
        if(fs.existsSync(DELETED_CARS_FILE)) deletedCars = JSON.parse(fs.readFileSync(DELETED_CARS_FILE, "utf8"));
        else deletedCars = [];
        if(fs.existsSync(DELETED_DIAGNOSTICS_FILE)) deletedDiagnostics = JSON.parse(fs.readFileSync(DELETED_DIAGNOSTICS_FILE, "utf8"));
        else deletedDiagnostics = [];
    } catch(e) { deletedCars = []; deletedDiagnostics = []; }
}

function saveDeletedCars() { fs.writeFileSync(DELETED_CARS_FILE, JSON.stringify(deletedCars, null, 2)); }
function saveDeletedDiagnostics() { fs.writeFileSync(DELETED_DIAGNOSTICS_FILE, JSON.stringify(deletedDiagnostics, null, 2)); }

function addDeletedCar(carNumber, userName, userPhone, reason = "Admin tomonidan o'chirildi", adminId = null) {
    const deletedCar = {
        id: Date.now(),
        carNumber: carNumber,
        userName: userName,
        userPhone: userPhone,
        reason: reason,
        deletedBy: adminId,
        deletedDate: new Date().toISOString()
    };
    deletedCars.push(deletedCar);
    saveDeletedCars();
    addSecurityLog("CAR_DELETED", adminId, `Avtomobil o'chirildi: ${carNumber}, Foydalanuvchi: ${userName}`);
    return deletedCar;
}

function addDeletedDiagnostic(diagnostic, reason = "Admin tomonidan o'chirildi", adminId = null) {
    const deletedDiag = {
        id: Date.now(),
        originalId: diagnostic.id,
        carNumber: diagnostic.carNumber,
        phoneNumber: diagnostic.phoneNumber,
        workDescription: diagnostic.workDescription,
        additionalNotes: diagnostic.additionalNotes,
        diagnosticPrice: diagnostic.diagnosticPrice,
        laborPrice: diagnostic.laborPrice,
        totalPrice: diagnostic.totalPrice,
        isFree: diagnostic.isFree,
        date: diagnostic.date,
        reason: reason,
        deletedBy: adminId,
        deletedDate: new Date().toISOString()
    };
    deletedDiagnostics.push(deletedDiag);
    saveDeletedDiagnostics();
    addSecurityLog("DIAGNOSTIC_DELETED", adminId, `Diagnostika o'chirildi: ${diagnostic.carNumber}, Summa: ${diagnostic.totalPrice} so'm`);
    return deletedDiag;
}

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
        
        users.forEach(u => {
            if(u.isBlocked===undefined) u.isBlocked=false;
            if(!u.cars) u.cars=[];
            if(u.totalDiagnosticsAll===undefined) u.totalDiagnosticsAll=0;
            if(u.totalBonusCount===undefined) u.totalBonusCount=0;
            if(u.totalFreeDiagnostics===undefined) u.totalFreeDiagnostics=0;
            if(!u.registeredDate && u.cars && u.cars.length>0 && u.cars[0].addedDate) {
                u.registeredDate = u.cars[0].addedDate;
            }
            if(!u.registeredDate) {
                u.registeredDate = new Date().toISOString();
            }
        });
        saveUsers();
    } catch(e) { console.error(e); }
}
function saveUsers() { fs.writeFileSync(USERS_FILE, JSON.stringify(users,null,2)); }
function saveDiagnostics() { fs.writeFileSync(DIAGNOSTICS_FILE, JSON.stringify(diagnostics,null,2)); }
function saveErrors() { fs.writeFileSync(ERRORS_FILE, JSON.stringify(errors,null,2)); }

function getUserByPhone(phone) { return users.find(u=>u.phone===phone); }
function getUserByUserId(id) { return users.find(u=>u.userId===id); }
function isAdmin(id) { return ADMIN_IDS.includes(id); }

function addNewUser(id, phone, car, fn, ln, un) {
    const now = getCurrentTashkentTime();
    const newUser = { 
        userId: id, 
        phone: phone, 
        firstName: fn || "", 
        lastName: ln || "", 
        username: un || "", 
        fullName: `${fn || ""} ${ln || ""}`.trim(), 
        isAdmin: false, 
        isActive: true, 
        isBlocked: false, 
        registeredDate: now.toISOString(),
        cars: [{ 
            carId: Date.now(), 
            carNumber: car, 
            bonusCount: 0, 
            freeDiagnostics: 0, 
            totalDiagnostics: 0, 
            addedDate: now.toISOString(), 
            isActive: true 
        }], 
        totalBonusCount: 0, 
        totalFreeDiagnostics: 0, 
        totalDiagnosticsAll: 0 
    };
    users.push(newUser);
    saveUsers();
    console.log(`✅ Yangi foydalanuvchi: ${phone} - ${formatTashkentDateTime(now)}`);
    return newUser;
}

function addCarToUser(phone, car) {
    const user = getUserByPhone(phone);
    if(!user) return { success:false, message:"❌ Foydalanuvchi topilmadi" };
    if(user.cars.length >= MAX_CARS_PER_USER) return { success:false, message:`❌ Maksimum ${MAX_CARS_PER_USER} ta avtomobil` };
    if(user.cars.find(c=>c.carNumber===car)) return { success:false, message:"❌ Bu avtomobil allaqachon bor" };
    user.cars.push({ carId:Date.now(), carNumber:car, bonusCount:0, freeDiagnostics:0, totalDiagnostics:0, addedDate:getCurrentTashkentTime().toISOString(), isActive:true });
    saveUsers();
    return { success:true, message:"✅ Avtomobil qo'shildi" };
}

// Avtomobilni o'chirish (barcha diagnostikalari bilan)
async function deleteCarWithDiagnostics(chatId, userId, carNumber, adminId) {
    const user = getUserByUserId(userId);
    if (!user) {
        await bot.sendMessage(chatId, "❌ Foydalanuvchi topilmadi!", { parse_mode: "Markdown" });
        return false;
    }
    
    const carIndex = user.cars.findIndex(c => c.carNumber === carNumber);
    if (carIndex === -1) {
        await bot.sendMessage(chatId, "❌ Avtomobil topilmadi!", { parse_mode: "Markdown" });
        return false;
    }
    
    const car = user.cars[carIndex];
    
    const carDiagnostics = diagnostics.filter(d => d.carNumber === carNumber && d.phoneNumber === user.phone);
    let totalDeletedAmount = 0;
    let deletedCount = 0;
    let bonusReduction = 0;
    let freeReduction = 0;
    
    for (const diag of carDiagnostics) {
        addDeletedDiagnostic(diag, `Avtomobil o'chirilganligi sababli: ${carNumber}`, adminId);
        
        if (!diag.isFree && diag.diagnosticPrice > 0) {
            bonusReduction++;
        }
        if (diag.isFree) {
            freeReduction++;
        }
        
        totalDeletedAmount += (diag.diagnosticPrice || 0) + (diag.laborPrice || 0);
        deletedCount++;
        
        const diagIndex = diagnostics.findIndex(d => d.id === diag.id);
        if (diagIndex !== -1) diagnostics.splice(diagIndex, 1);
    }
    
    user.totalBonusCount = Math.max(0, (user.totalBonusCount || 0) - bonusReduction);
    user.totalFreeDiagnostics = Math.max(0, (user.totalFreeDiagnostics || 0) - freeReduction);
    user.totalDiagnosticsAll = Math.max(0, (user.totalDiagnosticsAll || 0) - deletedCount);
    
    addDeletedCar(carNumber, user.fullName || user.phone, user.phone, `Admin tomonidan o'chirildi`, adminId);
    
    user.cars.splice(carIndex, 1);
    
    saveUsers();
    saveDiagnostics();
    
    addSecurityLog("CAR_AND_DIAGNOSTICS_DELETED", adminId, 
        `Avtomobil va ${deletedCount} ta diagnostika o'chirildi: ${carNumber}, Foydalanuvchi: ${user.fullName}, Jami summa: ${totalDeletedAmount.toLocaleString()} so'm`);
    
    let resultMsg = `✅ *AVTOMOBIL O'CHIRILDI!*\n`;
    resultMsg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    resultMsg += `🚗 *Avtomobil:* ${carNumber}\n`;
    resultMsg += `👤 *Foydalanuvchi:* ${user.fullName || user.phone}\n`;
    resultMsg += `📊 *O'chirilgan diagnostikalar:* ${deletedCount} ta\n`;
    resultMsg += `💰 *O'chirilgan summa:* ${totalDeletedAmount.toLocaleString()} so'm\n`;
    resultMsg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    if (bonusReduction > 0) {
        resultMsg += `🎁 *Bonuslar kamaydi:* ${bonusReduction} ta\n`;
    }
    if (freeReduction > 0) {
        resultMsg += `🎉 *Bepul xizmatlar kamaydi:* ${freeReduction} ta\n`;
    }
    resultMsg += "\n📌 Barcha o'zgarishlar avtomatik hisobga olindi.";
    
    await bot.sendMessage(chatId, resultMsg, { parse_mode: "Markdown" });
    
    return true;
}

// ============ BONUS MA'LUMOTINI OLISH FUNKSIYASI ============
function getBonusInfo(carObj) {
    const currentBonus = carObj.bonusCount || 0;
    const currentFree = carObj.freeDiagnostics || 0;
    const remainingToFree = currentBonus > 0 ? 5 - currentBonus : 5;
    
    return {
        bonusCount: currentBonus,
        freeDiagnostics: currentFree,
        remainingToFree: remainingToFree,
        nextFreeAfter: remainingToFree,
        totalDiagnostics: carObj.totalDiagnostics || 0
    };
}

function addDiagnosticToCar(phone, car, work, notes, extraPrice=0, extraDesc="") {
    const user = getUserByPhone(phone);
    if(!user) return { success:false };
    const carObj = user.cars.find(c=>c.carNumber===car);
    if(!carObj) return { success:false };
    
    let isFree=false, bonusMsg="";
    let newBonus = carObj.bonusCount;
    let newFree = carObj.freeDiagnostics;
    let price = DIAGNOSTIC_PRICE;
    let bonusInfoBefore = getBonusInfo(carObj);
    
    if(carObj.freeDiagnostics > 0) {
        isFree=true;
        newFree--;
        price=0;
        bonusMsg = "🎉 BEPUL diagnostikadan foydalandingiz!";
    } else {
        newBonus++;
        if(newBonus >= 5) {
            const add = Math.floor(newBonus / 5);
            newFree += add;
            newBonus = newBonus % 5;
            bonusMsg = `🎉 TABRIKLAYMIZ! ${add} ta BEPUL diagnostika qo'shildi!`;
        } else {
            bonusMsg = `🎁 ${newBonus}/5 bonus. Yana ${5 - newBonus} ta diagnostika va 1 BEPUL!`;
        }
    }
    
    const diagnosticDate = getCurrentTashkentTime();
    
    diagnostics.push({ 
        id: Date.now(), 
        userId: user.userId, 
        phoneNumber: phone, 
        carNumber: car, 
        date: diagnosticDate.toISOString(), 
        workDescription: work, 
        additionalNotes: notes, 
        diagnosticPrice: price, 
        laborPrice: extraPrice, 
        laborDescription: extraDesc, 
        totalPrice: price + extraPrice, 
        isFree,
        bonusBefore: bonusInfoBefore,
        bonusAfter: { bonusCount: newBonus, freeDiagnostics: newFree }
    });
    saveDiagnostics();
    
    carObj.bonusCount = newBonus;
    carObj.freeDiagnostics = newFree;
    carObj.totalDiagnostics = (carObj.totalDiagnostics || 0) + 1;
    user.totalDiagnosticsAll = (user.totalDiagnosticsAll || 0) + 1;
    if(!isFree) user.totalBonusCount = (user.totalBonusCount || 0) + 1;
    if(isFree) user.totalFreeDiagnostics = (user.totalFreeDiagnostics || 0) + 1;
    saveUsers();
    
    // Yangi bonus ma'lumotlarini olish
    const bonusInfoAfter = getBonusInfo(carObj);
    
    return { 
        success: true, 
        isFree, 
        diagnosticPrice: price, 
        laborPrice: extraPrice, 
        totalPrice: price + extraPrice, 
        bonusMessage: bonusMsg,
        carNumber: car,
        bonusInfo: bonusInfoAfter
    };
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
    
    const totalDeletedDiagnosticsAmount = deletedDiagnostics.reduce((sum, d) => sum + (d.diagnosticPrice || 0) + (d.laborPrice || 0), 0);
    
    return { 
        totalUsers:active.length, 
        blockedUsers:users.filter(u=>!u.isAdmin && u.isBlocked).length, 
        totalCars:cars, 
        totalDiagnostics:diagnostics.length, 
        diagnosticIncome:diagInc, 
        laborIncome:laborInc, 
        totalIncome:diagInc+laborInc, 
        currentVersion, 
        totalVideos:videoList.length, 
        totalVideoViews, 
        unreadMessages:getTotalUnreadForAdmin(ADMIN_IDS[0]),
        deletedCarsCount: deletedCars.length,
        deletedDiagnosticsCount: deletedDiagnostics.length,
        deletedTotalAmount: totalDeletedDiagnosticsAmount
    };
}

function getTodayDiagnostics() { 
    const today = getCurrentTashkentTime().toISOString().split("T")[0];
    return diagnostics.filter(d => {
        const diagDate = new Date(d.date).toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }).split(",")[0];
        return diagDate === today || d.date.split("T")[0] === today;
    }); 
}

function getAllDiagnostics(limit=500) { return diagnostics.slice(-limit).reverse(); }
function getErrors() { return errors.slice(-50).reverse(); }
function getNearBonusCars() { 
    const near=[]; 
    for(const u of users) { 
        if(u.isAdmin) continue; 
        for(const c of u.cars) { 
            if(c.bonusCount>=3 && c.bonusCount<5) 
                near.push({ fullName:u.fullName, phone:u.phone, carNumber:c.carNumber, bonusCount:c.bonusCount, remaining:5-c.bonusCount }); 
        } 
    } 
    return near; 
}

function deleteInvalidUsers() {
    let deletedCount = 0;
    const beforeCount = users.length;
    
    const validUsers = users.filter(u => {
        if (u.isAdmin === true) return true;
        
        const hasValidPhone = u.phone && u.phone !== "Telefon yo'q" && u.phone !== "" && u.phone !== null && u.phone !== "null";
        const hasCars = u.cars && u.cars.length > 0;
        
        if (!hasValidPhone && !hasCars) {
            console.log(`🗑️ O'chirilmoqda: User ID: ${u.userId}, Telefon: ${u.phone}, Ism: ${u.fullName}`);
            deletedCount++;
            return false;
        }
        
        return true;
    });
    
    users = validUsers;
    
    if (deletedCount > 0) {
        saveUsers();
        console.log(`✅ ${deletedCount} ta yaroqsiz foydalanuvchi o'chirildi! (${beforeCount} -> ${users.length})`);
    }
    
    return deletedCount;
}

function cleanAllInvalidUsers() {
    console.log("🧹 Yaroqsiz foydalanuvchilarni tozalash boshlandi...");
    let deleted = deleteInvalidUsers();
    
    let additionalDeleted = 0;
    for (let i = users.length - 1; i >= 0; i--) {
        const u = users[i];
        if (u.isAdmin) continue;
        
        const hasValidPhone = u.phone && u.phone !== "Telefon yo'q" && u.phone !== "" && u.phone !== null;
        const hasCars = u.cars && u.cars.length > 0;
        
        if (!hasValidPhone && !hasCars) {
            users.splice(i, 1);
            additionalDeleted++;
        }
    }
    
    if (additionalDeleted > 0) {
        saveUsers();
        console.log(`✅ Qo'shimcha ${additionalDeleted} ta yaroqsiz foydalanuvchi o'chirildi!`);
    }
    
    console.log(`✅ Tozalash tugadi. Hozirgi foydalanuvchilar soni: ${users.length}`);
    return deleted + additionalDeleted;
}

function getAllUsersWithDetails() {
    const regularUsers = users.filter(u => u.isAdmin !== true);
    const usersList = [];
    
    for (const u of regularUsers) {
        const carsList = [];
        if (u.cars && u.cars.length > 0) {
            for (const c of u.cars) {
                carsList.push({
                    carNumber: c.carNumber,
                    totalDiagnostics: c.totalDiagnostics || 0,
                    bonusCount: c.bonusCount || 0,
                    freeDiagnostics: c.freeDiagnostics || 0,
                    addedDate: c.addedDate
                });
            }
        }
        
        usersList.push({
            userId: u.userId,
            fullName: u.fullName || "Ismsiz",
            phone: u.phone || "Telefon yo'q",
            cars: carsList,
            totalDiagnostics: u.totalDiagnosticsAll || 0,
            isBlocked: u.isBlocked === true,
            registeredDate: u.registeredDate || "2000-01-01T00:00:00.000Z"
        });
    }
    
    usersList.sort((a, b) => {
        const dateA = new Date(a.registeredDate);
        const dateB = new Date(b.registeredDate);
        return dateB - dateA;
    });
    
    return usersList;
}

function getActiveUsers() {
    return users.filter(u => !u.isAdmin && !u.isBlocked)
        .sort((a, b) => new Date(b.registeredDate || 0) - new Date(a.registeredDate || 0));
}

function getBlockedUsers() {
    return users.filter(u => !u.isAdmin && u.isBlocked)
        .sort((a, b) => new Date(b.registeredDate || 0) - new Date(a.registeredDate || 0));
}

function blockUser(id) { const u=getUserByUserId(id); if(u && !u.isAdmin) { u.isBlocked=true; saveUsers(); return { success:true, message:"✅ Foydalanuvchi bloklandi" }; } return { success:false, message:"❌ Xatolik" }; }
function unblockUser(id) { const u=getUserByUserId(id); if(u) { u.isBlocked=false; saveUsers(); return { success:true, message:"✅ Foydalanuvchi blokdan ochildi" }; } return { success:false, message:"❌ Xatolik" }; }
function deleteUser(id) { 
    const user = getUserByUserId(id);
    if(!user || user.isAdmin) return { success:false, message:"❌ Xatolik" };
    
    for(const car of user.cars) {
        const carDiagnostics = diagnostics.filter(d => d.carNumber === car.carNumber && d.phoneNumber === user.phone);
        for(const diag of carDiagnostics) {
            addDeletedDiagnostic(diag, "Foydalanuvchi o'chirilganligi sababli", SUPER_ADMIN_ID);
            const diagIndex = diagnostics.findIndex(d => d.id === diag.id);
            if(diagIndex !== -1) diagnostics.splice(diagIndex, 1);
        }
        addDeletedCar(car.carNumber, user.fullName || user.phone, user.phone, "Foydalanuvchi o'chirilganligi sababli", SUPER_ADMIN_ID);
    }
    
    const idx=users.findIndex(u=>u.userId===id);
    if(idx!==-1) { 
        users.splice(idx,1); 
        saveUsers();
        saveDiagnostics();
        return { success:true, message:"🗑️ Foydalanuvchi va unga tegishli barcha ma'lumotlar o'chirildi" }; 
    } 
    return { success:false, message:"❌ Xatolik" }; 
}

function addSecurityLog(action, userId, details) {
    adminSettings.securityLog.unshift({ id: Date.now(), action, userId, details, date: new Date().toISOString() });
    if (adminSettings.securityLog.length > 100) adminSettings.securityLog = adminSettings.securityLog.slice(0, 100);
    saveAdminSettings();
}

function saveAdminSettings() { fs.writeFileSync(ADMIN_SETTINGS_FILE, JSON.stringify(adminSettings, null, 2)); }
function loadAdminSettings() { try { if(fs.existsSync(ADMIN_SETTINGS_FILE)) adminSettings = JSON.parse(fs.readFileSync(ADMIN_SETTINGS_FILE, "utf8")); } catch(e) { adminSettings = { allowedEditors: [], securityLog: [] }; } }

async function sendNotificationToAllUsers(msg, keyboard = null) { let s=0,f=0; for(const u of users.filter(u=>!u.isAdmin && !u.isBlocked)) { try { await bot.sendMessage(u.userId, msg, { parse_mode:"Markdown", reply_markup:keyboard }); s++; } catch(e) { f++; } } return { success:s, fail:f }; }

// ============ FORMAT FUNKSIYALARI (BONUS MA'LUMOTI BILAN) ============
function formatDiagnosticMessageForUser(d, includePhone = false, bonusInfo = null) {
    const total = (d.diagnosticPrice || 0) + (d.laborPrice || 0);
    const fullDateTime = formatFullDateTime(d.date);
    
    let msg = "";
    msg += "🔧 *DIAGNOSTIKA QO'SHILDI*\n";
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    
    if (includePhone && d.phoneNumber) {
        msg += `👤 *Mijoz:* ${d.phoneNumber}\n`;
    }
    
    msg += `🚗 *Avtomobil:* ${d.carNumber}\n`;
    msg += `📅 *Sana:* ${fullDateTime}\n\n`;
    
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += "📝 *BAJARILGAN ISHLAR:*\n";
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `${d.workDescription}\n\n`;
    
    if (d.laborDescription && d.laborPrice > 0) {
        msg += "🔨 *QO'SHIMCHA ISHLAR:*\n";
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += `${d.laborDescription}\n`;
        msg += `💰 *Narxi:* ${d.laborPrice.toLocaleString()} so'm\n\n`;
    }
    
    if (d.additionalNotes && d.additionalNotes.trim() !== "") {
        msg += "📌 *ESLATMA:*\n";
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += `${d.additionalNotes}\n\n`;
    }
    
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += "💰 *NARXLAR:*\n";
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    if (d.isFree) {
        msg += `🎉 *BEPUL!* (Bonus hisobidan)\n`;
    } else {
        if (d.diagnosticPrice > 0) {
            msg += `🔧 *Diagnostika:* ${d.diagnosticPrice.toLocaleString()} so'm\n`;
        }
        if (d.laborPrice > 0) {
            msg += `🔨 *Mehnat:* ${d.laborPrice.toLocaleString()} so'm\n`;
        }
    }
    
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `💰 *JAMI TO'LOV:* ${total.toLocaleString()} so'm\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    // BONUS MA'LUMOTI QO'SHILDI
    if (bonusInfo) {
        msg += "\n🎁 *BONUS MA'LUMOTI*\n";
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += `📊 *Joriy bonus:* ${bonusInfo.bonusCount}/5\n`;
        msg += `🎉 *Bepul diagnostikalar:* ${bonusInfo.freeDiagnostics} ta\n`;
        msg += `📈 *Umumiy diagnostika:* ${bonusInfo.totalDiagnostics} ta\n`;
        if (bonusInfo.remainingToFree > 0 && bonusInfo.remainingToFree < 5) {
            msg += `✨ *Yana ${bonusInfo.remainingToFree} ta diagnostikadan keyin 1 BEPUL!*\n`;
        } else if (bonusInfo.remainingToFree === 5 && bonusInfo.bonusCount === 0) {
            msg += `✨ *5 ta diagnostika va 1 BEPUL!*\n`;
        }
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    }
    
    if (d.isFree) {
        msg += `\n🎉 *TABRIKLAYMIZ!* Bepul diagnostikadan foydalandingiz!\n`;
    }
    
    msg += `\n© ${BOT_OWNER} | Isuzu Doctor Bot`;
    
    return msg;
}

function formatDiagnosticMessageForAdmin(d) {
    const total = (d.diagnosticPrice || 0) + (d.laborPrice || 0);
    const fullDateTime = formatFullDateTime(d.date);
    
    let msg = "";
    msg += "🔧 *DIAGNOSTIKA QO'SHILDI*\n";
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    
    msg += `👤 *Mijoz:* ${d.phoneNumber || "Noma'lum"}\n`;
    msg += `🚗 *Avtomobil:* ${d.carNumber}\n`;
    msg += `📅 *Sana:* ${fullDateTime}\n\n`;
    
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += "📝 *BAJARILGAN ISHLAR:*\n";
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `${d.workDescription}\n\n`;
    
    if (d.laborDescription && d.laborPrice > 0) {
        msg += "🔨 *QO'SHIMCHA ISHLAR:*\n";
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += `${d.laborDescription}\n`;
        msg += `💰 *Narxi:* ${d.laborPrice.toLocaleString()} so'm\n\n`;
    }
    
    if (d.additionalNotes && d.additionalNotes.trim() !== "") {
        msg += "📌 *ESLATMA:*\n";
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += `${d.additionalNotes}\n\n`;
    }
    
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += "💰 *NARXLAR:*\n";
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    if (d.isFree) {
        msg += `🎉 *BEPUL!* (Bonus hisobidan)\n`;
    } else {
        if (d.diagnosticPrice > 0) {
            msg += `🔧 *Diagnostika:* ${d.diagnosticPrice.toLocaleString()} so'm\n`;
        }
        if (d.laborPrice > 0) {
            msg += `🔨 *Mehnat:* ${d.laborPrice.toLocaleString()} so'm\n`;
        }
    }
    
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `💰 *JAMI TO'LOV:* ${total.toLocaleString()} so'm\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    if (d.bonusMessage) {
        msg += `\n${d.bonusMessage}\n`;
    }
    
    // Admin uchun bonus ma'lumoti
    if (d.bonusInfo) {
        msg += "\n📊 *BONUS HOLATI:*\n";
        msg += `🎁 ${d.bonusInfo.bonusCount}/5 bonus | 🎉 ${d.bonusInfo.freeDiagnostics} bepul\n`;
    }
    
    msg += "\n✅ Foydalanuvchiga bildirishnoma yuborildi.\n";
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
    
    return msg;
}

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
    report += `   • Avtomobillar: ${stats.totalCars} ta\n`;
    report += `   • Jami ro'yxatdan o'tgan: ${users.filter(u => !u.isAdmin).length} ta\n\n`;
    report += "🔧 *DIAGNOSTIKA*\n";
    report += `   • Jami: ${stats.totalDiagnostics} ta\n`;
    report += `   • Diagnostika daromadi: ${stats.diagnosticIncome.toLocaleString()} so'm\n`;
    report += `   • Mehnat daromadi: ${stats.laborIncome.toLocaleString()} so'm\n`;
    report += `   • Jami daromad: ${stats.totalIncome.toLocaleString()} so'm\n\n`;
    report += "🗑️ *O'CHIRILGANLAR*\n";
    report += `   • O'chirilgan avtomobillar: ${stats.deletedCarsCount} ta\n`;
    report += `   • O'chirilgan diagnostikalar: ${stats.deletedDiagnosticsCount} ta\n`;
    report += `   • O'chirilgan summa: ${stats.deletedTotalAmount.toLocaleString()} so'm\n\n`;
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
        ["🧹 Tozalash", "❌ Asosiy menyu"]
    ], resize_keyboard:true } };
}

function getPhoneKeyboard() { return { reply_markup: { keyboard:[[{text:"📱 Telefon raqamini yuborish", request_contact:true}]], resize_keyboard:true, one_time_keyboard:true } }; }
function getLocationKeyboard() { return { reply_markup: { keyboard:[[{text:"📍 Lokatsiya yuborish", request_location:true}],[{text:"🔙 Bekor qilish"}]], resize_keyboard:true } }; }
function removeKeyboard() { return { reply_markup: { remove_keyboard:true } }; }

async function sendMainMenu(chatId, isAdminUser = false, userId = null) {
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
    
    if (usersList.length === 0) {
        const msg = "📭 Hech qanday foydalanuvchi yo'q";
        if (messageId) await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
        else await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
        return;
    }
    
    const start = page * USERS_PER_PAGE;
    const end = start + USERS_PER_PAGE;
    const pageUsers = usersList.slice(start, end);
    const totalPages = Math.ceil(usersList.length / USERS_PER_PAGE);
    
    let msg = "👥 *FOYDALANUVCHILAR RO'YXATI*\n";
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `📄 Sahifa: ${page + 1}/${totalPages}\n`;
    msg += `👤 Jami: ${usersList.length} ta foydalanuvchi\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += "🟢 Faol | 🔴 Bloklangan\n";
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    
    for (let i = 0; i < pageUsers.length; i++) {
        const u = pageUsers[i];
        const num = start + i + 1;
        const status = u.isBlocked ? "🔴" : "🟢";
        const dateStr = formatDateSimple(u.registeredDate);
        const timeStr = formatTimeSimple(u.registeredDate);
        
        msg += `${status} *${num}. ${(u.fullName || "Ismsiz").substring(0, 25)}*\n`;
        msg += `📞 ${u.phone}\n`;
        msg += `📅 Ro'yxat: ${dateStr} ${timeStr}\n`;
        msg += `📊 Jami diagnostika: ${u.totalDiagnostics} ta\n`;
        
        if (u.cars && u.cars.length > 0) {
            msg += `🚗 *Avtomobillar (${u.cars.length}):*\n`;
            for (let j = 0; j < u.cars.length; j++) {
                const car = u.cars[j];
                msg += `   ${j+1}. ${car.carNumber} - 🎁${car.bonusCount}/5 - 🎉${car.freeDiagnostics} bepul\n`;
            }
        } else {
            msg += `🚗 Avtomobillar: ❌ Yo'q\n`;
        }
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    }
    
    const keyboard = [];
    const navButtons = [];
    if (page > 0) navButtons.push({ text: "◀️ Oldingi", callback_data: `users_page_${page - 1}` });
    if (page + 1 < totalPages) navButtons.push({ text: "Keyingi ▶️", callback_data: `users_page_${page + 1}` });
    if (navButtons.length > 0) keyboard.push(navButtons);
    keyboard.push([{ text: "🔙 Ortga", callback_data: "back_to_main" }]);
    
    if (messageId) {
        await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
    } else {
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
    }
}

// ========== FOYDALANUVCHILARNI BOSHQARISH ==========
let userManagePage = 0;
const USERS_MANAGE_PER_PAGE = 10;

async function showUsersForManage(chatId, page, messageId = null) {
    let allUsers = [];
    for (const u of users) {
        if (u.isAdmin) continue;
        if (u.cars && u.cars.length > 0) {
            allUsers.push({
                userId: u.userId,
                fullName: u.fullName || "Ismsiz",
                phone: u.phone,
                cars: u.cars,
                totalDiagnostics: u.totalDiagnosticsAll || 0,
                isBlocked: u.isBlocked === true,
                registeredDate: u.registeredDate || "2000-01-01T00:00:00.000Z"
            });
        }
    }
    
    allUsers.sort((a, b) => {
        const dateA = new Date(a.registeredDate);
        const dateB = new Date(b.registeredDate);
        return dateB - dateA;
    });
    
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
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `🚗 Avtomobili bo'lganlar: ${allUsers.length} ta\n`;
    msg += `📄 Sahifa: ${page + 1}/${totalPages}\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    
    const keyboard = [];
    for (let i = 0; i < pageUsers.length; i++) {
        const u = pageUsers[i];
        const num = start + i + 1;
        const status = u.isBlocked ? "🔴" : "🟢";
        const dateStr = formatDateSimple(u.registeredDate);
        
        let mainCarNumber = "";
        let allCarsStr = "";
        for (let j = 0; j < u.cars.length; j++) {
            if (j === 0) mainCarNumber = u.cars[j].carNumber;
            allCarsStr += `${j+1}.${u.cars[j].carNumber} `;
        }
        
        msg += `${status} *${num}. ${mainCarNumber}*\n`;
        msg += `👤 ${u.fullName}\n`;
        msg += `📞 ${u.phone}\n`;
        msg += `🚗 ${allCarsStr}\n`;
        msg += `📊 ${u.totalDiagnostics} ta diagnostika\n`;
        msg += `📅 Qo'shilgan: ${dateStr}\n`;
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        
        keyboard.push([{ 
            text: `${status} ${mainCarNumber} (${u.fullName.substring(0, 12)})`, 
            callback_data: `manage_user_cars_${u.userId}` 
        }]);
    }
    
    const navButtons = [];
    if (page > 0) navButtons.push({ text: "◀️ Oldingi", callback_data: "users_manage_page_prev" });
    if (page + 1 < totalPages) navButtons.push({ text: "Keyingi ▶️", callback_data: "users_manage_page_next" });
    if (navButtons.length > 0) keyboard.push(navButtons);
    keyboard.push([{ text: "🔙 Ortga", callback_data: "back_to_main" }]);
    
    if (messageId) {
        await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
    } else {
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
    }
}

async function showUserCars(chatId, userId, messageId = null) {
    const targetUser = getUserByUserId(userId);
    if (!targetUser) {
        await bot.sendMessage(chatId, "❌ Foydalanuvchi topilmadi!", { parse_mode: "Markdown" });
        return;
    }
    
    if (!targetUser.cars || targetUser.cars.length === 0) {
        await bot.sendMessage(chatId, `📭 ${targetUser.fullName || "Foydalanuvchi"} ga tegishli avtomobillar yo'q!`, { parse_mode: "Markdown" });
        return;
    }
    
    let msg = `👤 *FOYDALANUVCHI MA'LUMOTLARI*\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `👤 *Ism:* ${targetUser.fullName || "Ismsiz"}\n`;
    msg += `📞 *Telefon:* ${targetUser.phone}\n`;
    msg += `🚦 *Holat:* ${targetUser.isBlocked ? "🔴 Bloklangan" : "🟢 Faol"}\n`;
    msg += `📊 *Jami diagnostika:* ${targetUser.totalDiagnosticsAll || 0} ta\n`;
    msg += `🎁 *Jami bonus:* ${targetUser.totalBonusCount || 0} ta\n`;
    msg += `🎉 *Jami bepul:* ${targetUser.totalFreeDiagnostics || 0} ta\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    msg += "🚗 *AVTOMOBILLAR RO'YXATI*\n";
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    
    const keyboard = [];
    for (let i = 0; i < targetUser.cars.length; i++) {
        const car = targetUser.cars[i];
        const num = i + 1;
        
        const carDiagnostics = diagnostics.filter(d => d.carNumber === car.carNumber && d.phoneNumber === targetUser.phone);
        const diagCount = carDiagnostics.length;
        const diagTotal = carDiagnostics.reduce((sum, d) => sum + (d.diagnosticPrice || 0) + (d.laborPrice || 0), 0);
        
        msg += `${num}. 🚗 *${car.carNumber}*\n`;
        msg += `   📊 Diagnostika: ${car.totalDiagnostics || 0} ta\n`;
        msg += `   🎁 Bonus: ${car.bonusCount}/5\n`;
        msg += `   🎉 Bepul: ${car.freeDiagnostics} ta\n`;
        msg += `   💰 Jami summa: ${diagTotal.toLocaleString()} so'm\n`;
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        
        keyboard.push([{ 
            text: `🗑️ ${num}. ${car.carNumber} (${diagCount} ta diagnostika)`, 
            callback_data: `delete_car_from_user_${targetUser.userId}|${car.carNumber}` 
        }]);
    }
    
    keyboard.push([{ text: "🔙 Foydalanuvchilar ro'yxati", callback_data: "back_to_users_manage" }]);
    keyboard.push([{ text: "🔙 Asosiy menyu", callback_data: "back_to_main" }]);
    
    if (messageId) {
        await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
    } else {
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
    }
}

async function confirmDeleteCar(chatId, userId, carNumber, messageId) {
    const targetUser = getUserByUserId(userId);
    if (!targetUser) return;
    
    const car = targetUser.cars.find(c => c.carNumber === carNumber);
    if (!car) return;
    
    const carDiagnostics = diagnostics.filter(d => d.carNumber === carNumber && d.phoneNumber === targetUser.phone);
    const diagCount = carDiagnostics.length;
    const diagTotal = carDiagnostics.reduce((sum, d) => sum + (d.diagnosticPrice || 0) + (d.laborPrice || 0), 0);
    
    let msg = `⚠️ *DIQQAT! AVTOMOBIL O'CHIRILMOQDA*\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    msg += `🚗 *Avtomobil:* ${carNumber}\n`;
    msg += `👤 *Foydalanuvchi:* ${targetUser.fullName || targetUser.phone}\n\n`;
    msg += `📊 *O'chiriladigan ma'lumotlar:*\n`;
    msg += `   • Diagnostikalar: ${diagCount} ta\n`;
    msg += `   • Jami summa: ${diagTotal.toLocaleString()} so'm\n`;
    msg += `   • Bonuslar: ${car.bonusCount}/5\n`;
    msg += `   • Bepul xizmatlar: ${car.freeDiagnostics} ta\n\n`;
    msg += "⚠️ *BU AMALNI QAYTARIB BO'LMAYDI!*\n";
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    msg += "Haqiqatan ham o'chirmoqchimisiz?";
    
    const keyboard = {
        inline_keyboard: [
            [{ text: "✅ HA, O'CHIRISH", callback_data: `confirm_delete_car_${userId}|${carNumber}` }],
            [{ text: "❌ BEKOR QILISH", callback_data: `cancel_delete_car_${userId}` }]
        ]
    };
    
    if (messageId) {
        await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: keyboard });
    } else {
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: keyboard });
    }
}

// -------------------- SESSIONS --------------------
const userSessions = new Map();
function getUserSession(id) { if(!userSessions.has(id)) userSessions.set(id,{step:null,data:{}}); return userSessions.get(id); }
function clearUserSession(id) { userSessions.delete(id); }

// -------------------- BOTNI YARATISH --------------------
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.deleteWebHook().catch(e => console.log(e.message));

// -------------------- BACKUP --------------------
function createBackup() {
    const timestamp = getCurrentTashkentTime().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    if(fs.existsSync(USERS_FILE)) fs.copyFileSync(USERS_FILE, path.join(BACKUP_DIR, `users_backup_${timestamp}.json`));
    if(fs.existsSync(DIAGNOSTICS_FILE)) fs.copyFileSync(DIAGNOSTICS_FILE, path.join(BACKUP_DIR, `diagnostics_backup_${timestamp}.json`));
    if(fs.existsSync(CONVERSATIONS_FILE)) fs.copyFileSync(CONVERSATIONS_FILE, path.join(BACKUP_DIR, `conversations_backup_${timestamp}.json`));
    if(fs.existsSync(DELETED_CARS_FILE)) fs.copyFileSync(DELETED_CARS_FILE, path.join(BACKUP_DIR, `deleted_cars_backup_${timestamp}.json`));
    if(fs.existsSync(DELETED_DIAGNOSTICS_FILE)) fs.copyFileSync(DELETED_DIAGNOSTICS_FILE, path.join(BACKUP_DIR, `deleted_diagnostics_backup_${timestamp}.json`));
    console.log("✅ Backup yaratildi");
}

// -------------------- /start --------------------
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || "";
    const lastName = msg.from.last_name || "";
    const username = msg.from.username || "";
    
    clearUserSession(userId);
    const existingUser = getUserByUserId(userId);
    
    if (existingUser && existingUser.isBlocked) {
        await bot.sendMessage(chatId, "🚫 *Siz botdan bloklangansiz!*\n\nIltimos, administrator bilan bog'laning.\n📞 Aloqa: " + ADMIN_PHONE, { parse_mode: "Markdown", ...removeKeyboard() });
        return;
    }
    
    if (existingUser) {
        if (!existingUser.firstName && firstName) {
            existingUser.firstName = firstName;
            existingUser.lastName = lastName;
            existingUser.username = username;
            existingUser.fullName = firstName + " " + lastName;
            saveUsers();
        }
        const carsCount = existingUser.cars.length;
        const welcomeText = `👋 *Xush kelibsiz, ${existingUser.fullName || firstName || "hurmatli mijoz"}!*\n\n📞 Telefon: ${existingUser.phone}\n🚗 Avtomobillar: ${carsCount} ta\n🎁 Bonus: ${existingUser.totalBonusCount || 0}\n🎉 Bepul: ${existingUser.totalFreeDiagnostics || 0} ta\n📊 Diagnostika: ${existingUser.totalDiagnosticsAll || 0} ta\n📌 Bot versiyasi: V${currentVersion}`;
        await bot.sendMessage(chatId, welcomeText, { parse_mode: "Markdown" });
        await sendMainMenu(chatId, isAdmin(userId), userId);
    } else {
        const session = getUserSession(userId);
        session.data = { firstName, lastName, username };
        await bot.sendMessage(chatId, "🚗 *ISUZU DOCTOR* tizimiga xush kelibsiz! (Versiya V" + currentVersion + ")\n\n© " + BOT_OWNER + "\n\n📱 Iltimos, telefon raqamingizni yuboring:", {
            parse_mode: "Markdown",
            ...getPhoneKeyboard()
        });
    }
});

// -------------------- CONTACT --------------------
bot.on("contact", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const contact = msg.contact;
    const firstName = msg.from.first_name || "";
    const lastName = msg.from.last_name || "";
    const username = msg.from.username || "";
    
    if (!contact) return;
    
    let phoneNumber = contact.phone_number;
    if (!phoneNumber.startsWith("+")) phoneNumber = "+" + phoneNumber;
    
    const session = getUserSession(userId);
    session.data.phone = phoneNumber;
    session.data.firstName = firstName;
    session.data.lastName = lastName;
    session.data.username = username;
    
    if (phoneNumber === ADMIN_PHONE) {
        users.push({
            userId, phone: phoneNumber, firstName, lastName, username,
            fullName: `${firstName} ${lastName}`.trim(),
            isAdmin: true, isActive: true, isBlocked: false,
            registeredDate: getCurrentTashkentTime().toISOString(),
            cars: [], totalBonusCount: 0, totalFreeDiagnostics: 0, totalDiagnosticsAll: 0
        });
        saveUsers();
        await bot.sendMessage(chatId, "👑 *Admin paneliga xush kelibsiz!*", { parse_mode: "Markdown" });
        await sendMainMenu(chatId, true, userId);
        clearUserSession(userId);
        return;
    }
    
    const existingUser = getUserByPhone(phoneNumber);
    
    if (existingUser && existingUser.userId !== userId) {
        await bot.sendMessage(chatId, "❌ *Bu telefon raqam allaqachon ro'yxatdan o'tgan!*", { parse_mode: "Markdown" });
        clearUserSession(userId);
        return;
    }
    
    if (existingUser && existingUser.userId === userId) {
        session.step = "add_new_car";
        await bot.sendMessage(chatId, "✅ Telefon tasdiqlandi!\n\n🚗 *Yangi avtomobil raqamini kiriting:*\n\nMasalan: 01A777AA", {
            parse_mode: "Markdown",
            ...removeKeyboard()
        });
    } else {
        session.step = "first_car_number";
        await bot.sendMessage(chatId, "✅ Telefon qabul qilindi!\n\n🚗 *Birinchi avtomobil raqamini kiriting:*\n\nMasalan: 01A777AA", {
            parse_mode: "Markdown",
            ...removeKeyboard()
        });
    }
});

// -------------------- MESSAGE HANDLER --------------------
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    const video = msg.video;
    const voice = msg.voice;
    const photo = msg.photo;
    const document = msg.document;
    const location = msg.location;
    
    const session = getUserSession(userId);
    const user = getUserByUserId(userId);
    
    if (video || voice || photo || document) {
        await bot.sendMessage(chatId, "❌ *Faqat matn yoki lokatsiya yuboring!*", { parse_mode: "Markdown" });
        return;
    }
    
    if (location) {
        if (session.step === "conversation_mode" || session.data.inConversation) {
            if (isAdmin(userId)) {
                const targetId = session.data.replyingToUserId;
                if (targetId) {
                    addAdminReply(userId, targetId, "", "location", { latitude: location.latitude, longitude: location.longitude });
                    await bot.sendMessage(chatId, "✅ *Lokatsiya yuborildi!*", { parse_mode: "Markdown" });
                    const lat = location.latitude, lng = location.longitude;
                    const locationMsg = `📍 *Admin lokatsiya yubordi*\n\n🗺️ [Google Maps](https://www.google.com/maps?q=${lat},${lng})\n🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${lng},${lat}&z=15)\n🗺️ [2GIS](https://2gis.uz/search/${lat},${lng})\n🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15)`;
                    await bot.sendMessage(targetId, locationMsg, { parse_mode: "Markdown", disable_web_page_preview: true });
                    await showConversation(chatId, userId, true, targetId);
                }
            } else {
                addMessage(userId, ADMIN_IDS[0], "", "location", { latitude: location.latitude, longitude: location.longitude });
                await bot.sendMessage(chatId, "✅ *Lokatsiya yuborildi! Admin javob beradi.*", { parse_mode: "Markdown" });
                const uname = user ? (user.fullName || user.phone) : "Foydalanuvchi";
                const lat = location.latitude, lng = location.longitude;
                const locationMsg = `📍 *Yangi lokatsiya*\n👤 ${uname}\n🆔 ${userId}\n\n🗺️ [Google Maps](https://www.google.com/maps?q=${lat},${lng})\n🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${lng},${lat}&z=15)\n🗺️ [2GIS](https://2gis.uz/search/${lat},${lng})\n🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15)\n\n💬 Javob berish uchun "💬 Muloqotlar" tugmasini bosing!`;
                for (const aid of ADMIN_IDS) await bot.sendMessage(aid, locationMsg, { parse_mode: "Markdown", disable_web_page_preview: true });
                session.step = "conversation_mode";
                session.data.inConversation = true;
            }
        } else if (!isAdmin(userId) && user && !user.isBlocked) {
            addMessage(userId, ADMIN_IDS[0], "", "location", { latitude: location.latitude, longitude: location.longitude });
            await bot.sendMessage(chatId, "✅ *Lokatsiya yuborildi! Admin javob beradi.*", { parse_mode: "Markdown" });
            const uname = user ? (user.fullName || user.phone) : "Foydalanuvchi";
            const lat = location.latitude, lng = location.longitude;
            const locationMsg = `📍 *Yangi lokatsiya*\n👤 ${uname}\n🆔 ${userId}\n\n🗺️ [Google Maps](https://www.google.com/maps?q=${lat},${lng})\n🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${lng},${lat}&z=15)\n🗺️ [2GIS](https://2gis.uz/search/${lat},${lng})\n🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15)\n\n💬 Javob berish uchun "💬 Muloqotlar" tugmasini bosing!`;
            for (const aid of ADMIN_IDS) await bot.sendMessage(aid, locationMsg, { parse_mode: "Markdown", disable_web_page_preview: true });
            session.step = "conversation_mode";
            session.data.inConversation = true;
        }
        return;
    }
    
    if (text === "🔙 Bekor qilish" || text === "🔙 Asosiy menyu" || text === "🔙 Muloqotlar ro'yxati") {
        clearUserSession(userId);
        await sendMainMenu(chatId, isAdmin(userId), userId);
        return;
    }
    
    if (session.step === "first_car_number") {
        const carNumber = text.toUpperCase().trim();
        if (carNumber.length < 2 || carNumber.length > 10) {
            await bot.sendMessage(chatId, "❌ *Noto'g'ri avtomobil raqami!*\n\n2-10 belgi kiriting:", { parse_mode: "Markdown" });
            return;
        }
        
        addNewUser(
            userId,
            session.data.phone,
            carNumber,
            session.data.firstName || "",
            session.data.lastName || "",
            session.data.username || ""
        );
        
        await bot.sendMessage(chatId, `✅ *Ro'yxatdan o'tdingiz!*\n\n🚗 ${carNumber}\n📞 ${session.data.phone}\n🎁 Har 5 diagnostikada 1 BEPUL!\n📌 Versiya: V${currentVersion}`, { parse_mode: "Markdown" });
        
        for (const adminId of ADMIN_IDS) {
            bot.sendMessage(adminId, `🆕 *YANGI FOYDALANUVCHI!*\n\n👤 ${session.data.firstName || ""} ${session.data.lastName || ""}\n📞 ${session.data.phone}\n🚗 ${carNumber}\n🆔 ID: ${userId}`, { parse_mode: "Markdown" }).catch(() => {});
        }
        
        clearUserSession(userId);
        await sendMainMenu(chatId, false, userId);
        return;
    }
    
    if (session.step === "add_new_car") {
        const carNumber = text.toUpperCase().trim();
        if (carNumber.length < 2 || carNumber.length > 10) {
            await bot.sendMessage(chatId, "❌ *Noto'g'ri raqam!*", { parse_mode: "Markdown" });
            return;
        }
        const result = addCarToUser(session.data.phone, carNumber);
        await bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
        clearUserSession(userId);
        await sendMainMenu(chatId, false, userId);
        return;
    }
    
    if (!user) {
        await bot.sendMessage(chatId, "❌ *Ro'yxatdan o'tmagansiz!* Iltimos, /start bosing va telefon raqamingizni yuboring.", { parse_mode: "Markdown" });
        return;
    }
    
    if (user.isBlocked) {
        await bot.sendMessage(chatId, "🚫 *Siz bloklangansiz!*", { parse_mode: "Markdown" });
        return;
    }
    
    if (session.step === "admin_waiting_video") {
        if (!isAdmin(userId)) return;
        if (text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
        if (msg.video) {
            session.data.videoFileId = msg.video.file_id;
            session.step = "admin_waiting_video_title";
            await bot.sendMessage(chatId, "✅ Video qabul qilindi!\n📝 Video nomini kiriting:", { parse_mode: "Markdown" });
        } else { await bot.sendMessage(chatId, "❌ Video fayl yuboring!", { parse_mode: "Markdown" }); }
        return;
    }
    if (session.step === "admin_waiting_video_title") {
        if (!isAdmin(userId)) return;
        if (text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
        if (!text || text.length < 3) { await bot.sendMessage(chatId, "❌ Kamida 3 harf kiriting"); return; }
        session.data.title = text;
        session.step = "admin_waiting_video_description";
        await bot.sendMessage(chatId, "✅ Nom qabul qilindi!\n📝 Tavsif (ixtiyoriy):", { parse_mode: "Markdown" });
        return;
    }
    if (session.step === "admin_waiting_video_description") {
        if (!isAdmin(userId)) return;
        if (text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
        addVideo(session.data.videoFileId, session.data.title, text || "", userId);
        await bot.sendMessage(chatId, "✅ Video yuklandi!", { parse_mode: "Markdown" });
        clearUserSession(userId);
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    if (session.step === "admin_send_message") {
        if (!isAdmin(userId)) return;
        if (text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
        await bot.sendMessage(chatId, "📢 Xabar yuborilmoqda...", { parse_mode: "Markdown" });
        const res = await sendNotificationToAllUsers(text);
        await bot.sendMessage(chatId, `✅ Yuborildi: ${res.success} ta\n❌ Yuborilmadi: ${res.fail} ta`, { parse_mode: "Markdown" });
        clearUserSession(userId);
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    if (session.step === "admin_update_version") {
        if (!isAdmin(userId)) return;
        if (text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
        if (!/^\d+\.\d+$/.test(text)) { await bot.sendMessage(chatId, "❌ Format: 2.2", { parse_mode: "Markdown" }); return; }
        session.data.newVersion = text;
        session.step = "admin_version_changes";
        await bot.sendMessage(chatId, "📝 O'zgarishlar tavsifi:", { parse_mode: "Markdown" });
        return;
    }
    if (session.step === "admin_version_changes") {
        if (!isAdmin(userId)) return;
        if (text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
        currentVersion = session.data.newVersion;
        await bot.sendMessage(chatId, `✅ Versiya yangilandi: V${currentVersion}`, { parse_mode: "Markdown" });
        clearUserSession(userId);
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    if (isAdmin(userId) && text === "🗺️ Xaritadan lokatsiya tanlash") {
        if (session.step === "conversation_mode") {
            await bot.sendMessage(chatId, "🗺️ *Xaritadan lokatsiya tanlash*\n\nGoogle Maps linki yoki koordinata kiriting:\nhttps://www.google.com/maps?q=40.7128,-74.0060\nYoki: 40.7128, -74.0060", { parse_mode: "Markdown" });
            session.step = "admin_waiting_map_location";
            return;
        }
    }
    
    if (session.step === "admin_waiting_map_location") {
        if (!isAdmin(userId)) return;
        if (text === "/cancel") {
            clearUserSession(userId);
            await showConversation(chatId, userId, true, session.data.replyingToUserId);
            return;
        }
        const loc = parseMapUrl(text);
        if (!loc) { await bot.sendMessage(chatId, "❌ Noto'g'ri format!", { parse_mode: "Markdown" }); return; }
        const targetId = session.data.replyingToUserId;
        if (targetId) {
            addAdminReply(userId, targetId, "", "location", { latitude: loc.lat, longitude: loc.lng });
            await bot.sendMessage(chatId, `✅ Lokatsiya yuborildi! ${loc.lat}, ${loc.lng}`, { parse_mode: "Markdown" });
            const locationMsg = `📍 *Admin lokatsiya yubordi*\n\n🗺️ [Google Maps](https://www.google.com/maps?q=${loc.lat},${loc.lng})\n🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${loc.lng},${loc.lat}&z=15)\n🗺️ [2GIS](https://2gis.uz/search/${loc.lat},${loc.lng})\n🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}&zoom=15)`;
            await bot.sendMessage(targetId, locationMsg, { parse_mode: "Markdown", disable_web_page_preview: true });
            await showConversation(chatId, userId, true, targetId);
            clearUserSession(userId);
        }
        return;
    }
    
    if (isAdmin(userId) && text === "🗑️ Bu muloqotni o'chirish") {
        const targetId = session.data.replyingToUserId;
        if (targetId) {
            const conv = conversations.find(c => c.userId === targetId);
            if (conv) {
                const result = deleteConversation(conv.id, userId);
                await bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
                await showAllConversations(chatId, 0);
                clearUserSession(userId);
                return;
            }
        }
    }
    
    if (session.step === "conversation_mode" || session.data.inConversation) {
        if (isAdmin(userId)) {
            const targetId = session.data.replyingToUserId;
            if (targetId && text && !text.startsWith("/") && text !== "🗑️ Bu muloqotni o'chirish" && text !== "🔙 Muloqotlar ro'yxati" && text !== "🗺️ Xaritadan lokatsiya tanlash") {
                addAdminReply(userId, targetId, text, "text", null);
                await bot.sendMessage(chatId, "✅ Javob yuborildi!", { parse_mode: "Markdown" });
                await bot.sendMessage(targetId, `👑 *Admin javobi:*\n\n${text}`, { parse_mode: "Markdown" });
                await showConversation(chatId, userId, true, targetId);
            } else if (text === "🔙 Muloqotlar ro'yxati") {
                await showAllConversations(chatId, 0);
                clearUserSession(userId);
                return;
            }
        } else if (text && !text.startsWith("/")) {
            addMessage(userId, ADMIN_IDS[0], text, "text", null);
            await bot.sendMessage(chatId, "✅ Xabar yuborildi! Admin javob beradi.", { parse_mode: "Markdown" });
            const uname = user ? (user.fullName || user.phone) : "Foydalanuvchi";
            for (const aid of ADMIN_IDS) await bot.sendMessage(aid, `💬 *Yangi xabar*\n👤 ${uname}\n📝 ${text}\n\n💬 "💬 Muloqotlar" tugmasini bosing!`, { parse_mode: "Markdown" });
        }
        return;
    }
    
    if (session.step === "admin_add_diagnostic") {
        if (!isAdmin(userId)) return;
        const car = text.toUpperCase().trim();
        let foundUser = null, foundCar = null;
        for (const u of users) {
            const c = u.cars.find(c => c.carNumber === car);
            if (c) { foundUser = u; foundCar = c; break; }
        }
        if (!foundUser) { await bot.sendMessage(chatId, "❌ Avtomobil topilmadi!", { parse_mode: "Markdown" }); return; }
        session.data.targetUser = foundUser;
        session.data.targetCar = foundCar;
        session.step = "admin_work_description";
        await bot.sendMessage(chatId, `✅ ${foundUser.fullName}\n🚗 ${foundCar.carNumber}\n🔧 Ish tavsifi:`, { parse_mode: "Markdown" });
        return;
    }
    if (session.step === "admin_work_description") {
        if (!isAdmin(userId)) return;
        session.data.workDescription = text;
        session.step = "admin_extra_work_question";
        await bot.sendMessage(chatId, "➕ Qo'shimcha ish? (ha/yo'q)", { parse_mode: "Markdown" });
        return;
    }
    if (session.step === "admin_extra_work_question") {
        if (!isAdmin(userId)) return;
        if (text.toLowerCase() === "ha" || text.toLowerCase() === "bor") {
            session.step = "admin_extra_work_price";
            await bot.sendMessage(chatId, "💰 Narxi:", { parse_mode: "Markdown" });
        } else {
            session.data.extraWorkPrice = 0;
            session.data.extraWorkDescription = "";
            session.step = "admin_additional_notes";
            await bot.sendMessage(chatId, "📝 Qo'shimcha eslatma:", { parse_mode: "Markdown" });
        }
        return;
    }
    if (session.step === "admin_extra_work_price") {
        if (!isAdmin(userId)) return;
        const price = parseInt(text);
        if (isNaN(price)) { await bot.sendMessage(chatId, "❌ Son kiriting!", { parse_mode: "Markdown" }); return; }
        session.data.extraWorkPrice = price;
        session.step = "admin_extra_work_description";
        await bot.sendMessage(chatId, "📝 Ish tavsifi:", { parse_mode: "Markdown" });
        return;
    }
    if (session.step === "admin_extra_work_description") {
        if (!isAdmin(userId)) return;
        session.data.extraWorkDescription = text;
        session.step = "admin_additional_notes";
        await bot.sendMessage(chatId, "📝 Qo'shimcha eslatma:", { parse_mode: "Markdown" });
        return;
    }
    if (session.step === "admin_additional_notes") {
        if (!isAdmin(userId)) return;
        
        const result = addDiagnosticToCar(
            session.data.targetUser.phone,
            session.data.targetCar.carNumber,
            session.data.workDescription,
            text || "",
            session.data.extraWorkPrice || 0,
            session.data.extraWorkDescription || ""
        );
        
        if (result.success) {
            const adminMsg = formatDiagnosticMessageForAdmin({
                carNumber: result.carNumber,
                phoneNumber: session.data.targetUser.phone,
                date: new Date(),
                workDescription: session.data.workDescription,
                additionalNotes: text || "",
                laborDescription: session.data.extraWorkDescription || "",
                diagnosticPrice: result.diagnosticPrice,
                laborPrice: result.laborPrice,
                isFree: result.isFree,
                bonusMessage: result.bonusMessage,
                bonusInfo: result.bonusInfo
            });
            await bot.sendMessage(chatId, adminMsg, { parse_mode: "Markdown" });
            
            const userMsg = formatDiagnosticMessageForUser({
                carNumber: result.carNumber,
                date: new Date(),
                workDescription: session.data.workDescription,
                additionalNotes: text || "",
                laborDescription: session.data.extraWorkDescription || "",
                diagnosticPrice: result.diagnosticPrice,
                laborPrice: result.laborPrice,
                isFree: result.isFree,
                phoneNumber: session.data.targetUser.phone
            }, false, result.bonusInfo);
            
            await bot.sendMessage(session.data.targetUser.userId, userMsg, { parse_mode: "Markdown" });
            
            if (result.laborPrice > 0 && !result.isFree) {
                await bot.sendMessage(session.data.targetUser.userId, getCardInfoMessage(), { parse_mode: "Markdown" });
            }
        } else { 
            await bot.sendMessage(chatId, "❌ Xatolik!", { parse_mode: "Markdown" }); 
        }
        clearUserSession(userId);
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    if (isAdmin(userId)) {
        if (text === "📊 Statistika") {
            const s = getStatistics();
            let msg = "📊 *STATISTIKA*\n";
            msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
            msg += `👥 Foydalanuvchilar: ${s.totalUsers}\n`;
            msg += `🚫 Bloklangan: ${s.blockedUsers}\n`;
            msg += `🚗 Avtomobillar: ${s.totalCars}\n`;
            msg += `🔧 Diagnostikalar: ${s.totalDiagnostics}\n`;
            msg += `💰 Diagnostika: ${s.diagnosticIncome.toLocaleString()} so'm\n`;
            msg += `🔨 Mehnat: ${s.laborIncome.toLocaleString()} so'm\n`;
            msg += `💵 Jami daromad: ${s.totalIncome.toLocaleString()} so'm\n`;
            msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
            msg += `🗑️ O'chirilgan avtomobillar: ${s.deletedCarsCount}\n`;
            msg += `🗑️ O'chirilgan diagnostikalar: ${s.deletedDiagnosticsCount}\n`;
            msg += `🗑️ O'chirilgan summa: ${s.deletedTotalAmount.toLocaleString()} so'm\n`;
            msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
            msg += `📹 Videolar: ${s.totalVideos}\n`;
            msg += `💬 O'qilmagan: ${s.unreadMessages}\n`;
            msg += `📌 Versiya: V${s.currentVersion}\n`;
            msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
            await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, userId);
        }
        else if (text === "👥 Foydalanuvchilar") {
            usersListPage = 0;
            await showUsersList(chatId, usersListPage);
        }
        else if (text === "🔧 Diagnostika") {
            const s = getUserSession(userId);
            s.step = "admin_add_diagnostic";
            await bot.sendMessage(chatId, "🔧 Avtomobil raqamini kiriting:", { parse_mode: "Markdown", ...removeKeyboard() });
        }
        else if (text === "🎁 Bonusga yaqinlar") {
            const near = getNearBonusCars();
            let msg = "🎁 *BONUSGA YAQINLAR*\n━━━━━━━━━━━━━━━━━━\n";
            if (near.length === 0) msg += "Hech kim yo'q\n";
            else near.forEach(c => { msg += `👤 ${c.fullName}\n🚗 ${c.carNumber}\n🎁 ${c.bonusCount}/5\n📌 ${c.remaining} ta qoldi\n━━━━━━━━━━━━━━━━━━\n`; });
            await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, userId);
        }
        else if (text === "⚠️ Xatoliklar") {
            const errs = getErrors();
            let msg = "⚠️ *XATOLIKLAR*\n";
            if (errs.length === 0) msg += "Xatoliklar yo'q\n";
            else errs.slice(0, 10).forEach(e => { msg += `\n🚗 ${e.carNumber}\n📝 ${e.errorDescription}\n📅 ${formatTashkentDateTime(e.date)}\n━━━━━━━━━━━━━━━━━━\n`; });
            await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, userId);
        }
        else if (text === "📋 Diagnostika tarixi") {
            const keyboard = {
                inline_keyboard: [
                    [{ text: "📄 Fayl sifatida yuklab olish", callback_data: "download_diagnostics_history" }],
                    [{ text: "📝 Matn sifatida ko'rish", callback_data: "view_diagnostics_text" }],
                    [{ text: "🔙 Ortga", callback_data: "back_to_main" }]
                ]
            };
            await bot.sendMessage(chatId, "📋 *DIAGNOSTIKA TARIXI*\n\nQanday ko'rinishda olishni tanlang:", { parse_mode: "Markdown", reply_markup: keyboard });
            return;
        }
        else if (text === "📅 Bugungi") {
            const diags = getTodayDiagnostics();
            let inc = 0, lib = 0, free = 0;
            for (const d of diags) {
                if (d.diagnosticPrice > 0) inc += d.diagnosticPrice;
                else if (d.isFree) free++;
                if (d.laborPrice) lib += d.laborPrice;
            }
            await bot.sendMessage(chatId, `📅 *BUGUNGI*\n━━━━━━━━━━━━━━━━━━\n📊 ${diags.length} ta\n💰 Diagnostika: ${inc.toLocaleString()} so'm\n🔨 Mehnat: ${lib.toLocaleString()} so'm\n💵 Jami: ${(inc + lib).toLocaleString()} so'm\n🎉 Bepul: ${free} ta`, { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, userId);
        }
        else if (text === "📄 Hisobot") {
            await bot.sendMessage(chatId, "📄 *Hisobot tayyorlanmoqda...*", { parse_mode: "Markdown" });
            try {
                const report = await generateFullReport(chatId);
                const timestamp = getCurrentTashkentTime().toISOString().replace(/[:.]/g, "-").slice(0, -5);
                const filepath = path.join(REPORTS_DIR, `hisobot_${timestamp}.txt`);
                const plainReport = report.replace(/\*/g, '').replace(/━/g, '-');
                fs.writeFileSync(filepath, plainReport, "utf8");
                await bot.sendMessage(chatId, report, { parse_mode: "Markdown" });
                await bot.sendDocument(chatId, filepath, { caption: `📊 *HISOBOT*\n📅 ${formatTashkentDateTime(new Date())}\n📌 V${currentVersion}`, parse_mode: "Markdown" });
                setTimeout(() => fs.unlinkSync(filepath), 60000);
            } catch (e) { await bot.sendMessage(chatId, "❌ Xatolik!", { parse_mode: "Markdown" }); }
            await sendMainMenu(chatId, true, userId);
            return;
        }
        else if (text === "📹 Video galereya") { await showVideoGallery(chatId); await sendMainMenu(chatId, true, userId); }
        else if (text === "📤 Video yuklash") { const s = getUserSession(userId); s.step = "admin_waiting_video"; s.data = {}; await bot.sendMessage(chatId, "📤 Video fayl yuboring", { parse_mode: "Markdown" }); }
        else if (text === "🗑️ Video o'chirish") { await showVideoManagement(chatId); }
        else if (text === "💾 Backup") { createBackup(); await bot.sendMessage(chatId, "✅ Backup yaratildi", { parse_mode: "Markdown" }); await sendMainMenu(chatId, true, userId); }
        else if (text === "🔄 Tiklash") { await bot.sendMessage(chatId, "❌ Backup yo'q", { parse_mode: "Markdown" }); await sendMainMenu(chatId, true, userId); }
        else if (text === "🚫 Foyd. boshqarish") { userManagePage = 0; await showUsersForManage(chatId, userManagePage); }
        else if (text === "🔐 Xavfsizlik") { 
            const logs = adminSettings.securityLog.slice(0, 20);
            let msg = "🔐 *XAVFSIZLIK JURNALI*\n━━━━━━━━━━━━━━━━━━\n";
            if (logs.length === 0) msg += "Hech qanday hodisa yo'q\n";
            else logs.forEach(l => { msg += `\n📌 ${l.action}\n👤 ID: ${l.userId || "Admin"}\n📝 ${l.details}\n📅 ${formatTashkentDateTime(l.date)}\n━━━━━━━━━━━━━━━━━━\n`; });
            await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Ortga", callback_data: "security_back" }]] } });
        }
        else if (text === "📌 Versiya") { await bot.sendMessage(chatId, `📌 Versiya: V${currentVersion}`, { parse_mode: "Markdown" }); await sendMainMenu(chatId, true, userId); }
        else if (text === "📢 Xabar yuborish") { const s = getUserSession(userId); s.step = "admin_send_message"; await bot.sendMessage(chatId, "📢 Xabarni kiriting:", { parse_mode: "Markdown", ...removeKeyboard() }); }
        else if (text === "🧹 Tozalash") {
            if (!isAdmin(userId)) return;
            await bot.sendMessage(chatId, "🧹 *Yaroqsiz foydalanuvchilar tozalanmoqda...*", { parse_mode: "Markdown" });
            const deletedCount = cleanAllInvalidUsers();
            if (deletedCount > 0) {
                await bot.sendMessage(chatId, `✅ *${deletedCount} ta yaroqsiz foydalanuvchi o'chirildi!*\n\n📊 Hozirgi foydalanuvchilar soni: ${users.length}`, { parse_mode: "Markdown" });
            } else {
                await bot.sendMessage(chatId, "✅ *Yaroqsiz foydalanuvchilar topilmadi!*", { parse_mode: "Markdown" });
            }
            usersListPage = 0;
            userManagePage = 0;
            await sendMainMenu(chatId, true, userId);
            return;
        }
        else if (text && (text === "💬 Muloqotlar" || text.includes("💬 Muloqotlar"))) { await showAllConversations(chatId, 0); return; }
        else if (text === "❌ Asosiy menyu") { clearUserSession(userId); userManagePage = 0; usersListPage = 0; await sendMainMenu(chatId, true, userId); }
        else if (!session.step) { await bot.sendMessage(chatId, "❌ Tushunarsiz buyruq!", { parse_mode: "Markdown" }); await sendMainMenu(chatId, true, userId); }
        return;
    }
    
    if (!session.step) {
        await bot.sendMessage(chatId, "❌ *Tugmalardan foydalaning!*", { parse_mode: "Markdown" });
        await sendMainMenu(chatId, false, userId);
    }
});

// -------------------- CALLBACK --------------------
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = query.from.id;
    const msgId = query.message.message_id;
    
    await bot.answerCallbackQuery(query.id);
    const user = getUserByUserId(userId);
    
    if (data === "user_contact_admin") {
        const s = getUserSession(userId);
        s.step = "conversation_mode";
        s.data.inConversation = true;
        await bot.sendMessage(chatId, CONTACT_ADMIN_MESSAGE, { parse_mode: "Markdown", ...getLocationKeyboard() });
        return;
    }
    
    if (data.startsWith("users_page_")) {
        if (!isAdmin(userId)) return;
        const page = parseInt(data.split("_")[2]);
        if (isNaN(page)) return;
        usersListPage = page;
        await showUsersList(chatId, page, msgId);
        return;
    }
    
    if (data === "users_manage_page_prev") {
        if (!isAdmin(userId)) return;
        if (userManagePage > 0) {
            userManagePage--;
            await showUsersForManage(chatId, userManagePage, msgId);
        }
        return;
    }
    
    if (data === "users_manage_page_next") {
        if (!isAdmin(userId)) return;
        let allUsers = [];
        for (const u of users) {
            if (u.isAdmin) continue;
            if (u.cars && u.cars.length > 0) allUsers.push(u);
        }
        const totalPages = Math.ceil(allUsers.length / USERS_MANAGE_PER_PAGE);
        if (userManagePage + 1 < totalPages) {
            userManagePage++;
            await showUsersForManage(chatId, userManagePage, msgId);
        }
        return;
    }
    
    if (data.startsWith("manage_user_cars_")) {
        if (!isAdmin(userId)) return;
        const targetId = parseInt(data.split("_")[3]);
        await showUserCars(chatId, targetId, msgId);
        return;
    }
    
    if (data === "back_to_users_manage") {
        if (!isAdmin(userId)) return;
        userManagePage = 0;
        await showUsersForManage(chatId, userManagePage, msgId);
        return;
    }
    
    if (data.startsWith("delete_car_from_user_")) {
        if (!isAdmin(userId)) return;
        const parts = data.split("_");
        const rest = parts.slice(4).join("_");
        const [targetId, carNumber] = rest.split("|");
        await confirmDeleteCar(chatId, parseInt(targetId), carNumber, msgId);
        return;
    }
    
    if (data.startsWith("confirm_delete_car_")) {
        if (!isAdmin(userId)) return;
        const parts = data.split("_");
        const rest = parts.slice(3).join("_");
        const [targetId, carNumber] = rest.split("|");
        await deleteCarWithDiagnostics(chatId, parseInt(targetId), carNumber, userId);
        await showUserCars(chatId, parseInt(targetId));
        return;
    }
    
    if (data.startsWith("cancel_delete_car_")) {
        if (!isAdmin(userId)) return;
        const targetId = parseInt(data.split("_")[3]);
        await showUserCars(chatId, targetId, msgId);
        return;
    }
    
    if (data === "download_diagnostics_history") {
        if (!isAdmin(userId)) return;
        await bot.sendMessage(chatId, "📄 Fayl tayyorlanmoqda...", { parse_mode: "Markdown" });
        const filepath = await generateDiagnosticsHistoryFile(chatId, 500);
        if (filepath && fs.existsSync(filepath)) {
            await bot.sendDocument(chatId, filepath, { caption: `📋 *DIAGNOSTIKA TARIXI*\n📅 ${formatTashkentDateTime(new Date())}\n📌 V${currentVersion}`, parse_mode: "Markdown" });
            setTimeout(() => fs.unlinkSync(filepath), 60000);
        }
        return;
    }
    
    if (data === "view_diagnostics_text") {
        if (!isAdmin(userId)) return;
        const diags = getAllDiagnostics(20);
        if (diags.length === 0) { await bot.sendMessage(chatId, "📭 Diagnostikalar yo'q", { parse_mode: "Markdown" }); return; }
        for (const d of diags.slice(0, 10)) await bot.sendMessage(chatId, formatDiagnosticMessageForUser(d, true), { parse_mode: "Markdown" });
        if (diags.length > 10) await bot.sendMessage(chatId, `📊 Yana ${diags.length - 10} ta bor. "Fayl sifatida yuklab olish" tugmasini bosing.`, { parse_mode: "Markdown" });
        return;
    }
    
    if (data.startsWith("open_conversation_")) { if (!isAdmin(userId)) return; const targetId = parseInt(data.split("_")[2]); const s = getUserSession(userId); s.step = "conversation_mode"; s.data.inConversation = true; s.data.replyingToUserId = targetId; await showConversation(chatId, userId, true, targetId); return; }
    if (data.startsWith("conversations_page_")) { if (!isAdmin(userId)) return; const page = parseInt(data.split("_")[2]); await showAllConversations(chatId, page); return; }
    if (data.startsWith("delete_conv_")) { if (!isAdmin(userId)) return; const convId = parseInt(data.split("_")[2]); const res = deleteConversation(convId, userId); await bot.answerCallbackQuery(query.id, { text: res.message, show_alert: true }); await showAllConversations(chatId, 0); return; }
    if (data.startsWith("delete_video_")) { if (!isAdmin(userId)) return; const vid = parseInt(data.split("_")[2]); deleteVideo(vid); await bot.sendMessage(chatId, "✅ Video o'chirildi"); await showVideoManagement(chatId); return; }
    if (data.startsWith("watch_video_")) { const vid = parseInt(data.split("_")[2]); const v = videoList.find(v => v.id === vid); if (v && v.fileId) await bot.sendVideo(chatId, v.fileId, { caption: `📹 ${v.title}` }); else await bot.sendMessage(chatId, "❌ Video topilmadi"); return; }
    if (data === "back_to_main") { clearUserSession(userId); await sendMainMenu(chatId, isAdmin(userId), userId); return; }
    if (data === "user_profile") { const carsList = user.cars.map(c => `🚗 ${c.carNumber} (${c.totalDiagnostics} ta)`).join("\n"); await bot.sendMessage(chatId, `📊 PROFIL\n👤 ${user.fullName || "Ismsiz"}\n📞 ${user.phone}\n🚗 ${user.cars.length}/${MAX_CARS_PER_USER}\n\n${carsList}\n🎁 Bonus: ${user.totalBonusCount || 0}\n🎉 Bepul: ${user.totalFreeDiagnostics || 0}\n📌 Versiya: V${currentVersion}`, { parse_mode: "Markdown" }); await sendMainMenu(chatId, false, userId); return; }
    if (data === "user_my_cars") { let msg = "🚗 AVTOMOBILLAR\n━━━━━━━━━━━━━━━━━━\n"; for (const c of user.cars) { const bonusInfo = getBonusInfo(c); msg += `\n🚗 ${c.carNumber}\n🎁 Bonus: ${bonusInfo.bonusCount}/5\n🎉 Bepul: ${bonusInfo.freeDiagnostics}\n📊 Jami: ${bonusInfo.totalDiagnostics} ta\n━━━━━━━━━━━━━━━━━━\n`; } await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" }); await sendMainMenu(chatId, false, userId); return; }
    if (data === "user_my_bonus") { let msg = "🎁 BONUSLAR\n━━━━━━━━━━━━━━━━━━\n"; for (const c of user.cars) { const bonusInfo = getBonusInfo(c); msg += `\n🚗 ${c.carNumber}\n📊 ${bonusInfo.bonusCount}/5\n🎉 Bepul: ${bonusInfo.freeDiagnostics}\n✨ Yana ${bonusInfo.remainingToFree} ta diagnostikadan keyin 1 BEPUL!\n━━━━━━━━━━━━━━━━━━\n`; } await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" }); await sendMainMenu(chatId, false, userId); return; }
    if (data === "user_add_car") { if (user.cars.length >= MAX_CARS_PER_USER) { await bot.sendMessage(chatId, `❌ Maksimum ${MAX_CARS_PER_USER} ta!`); await sendMainMenu(chatId, false, userId); return; } const s = getUserSession(userId); s.step = "add_new_car"; s.data.phone = user.phone; await bot.sendMessage(chatId, "🚗 Yangi avtomobil raqamini kiriting:", { parse_mode: "Markdown", ...removeKeyboard() }); return; }
    if (data === "user_history") { const diags = diagnostics.filter(d => d.phoneNumber === user.phone).slice(-10).reverse(); if (diags.length === 0) await bot.sendMessage(chatId, "📭 Diagnostikalar yo'q"); else for (const d of diags) { const bonusInfo = d.bonusAfter || null; await bot.sendMessage(chatId, formatDiagnosticMessageForUser(d, false, bonusInfo), { parse_mode: "Markdown" }); } await sendMainMenu(chatId, false, userId); return; }
    if (data === "user_video_gallery") { await showVideoGallery(chatId); await sendMainMenu(chatId, false, userId); return; }
    if (data === "user_payment") { await bot.sendMessage(chatId, getCardInfoMessage(), { parse_mode: "Markdown" }); await sendMainMenu(chatId, false, userId); return; }
    if (data === "user_instagram") { await bot.sendMessage(chatId, `📸 Instagram\n${INSTAGRAM_LINK}`, { reply_markup: { inline_keyboard: [[{ text: "📸 Ochish", url: INSTAGRAM_LINK }]] } }); return; }
    if (data === "user_telegram_group") { await bot.sendMessage(chatId, `👥 Guruh\n${TELEGRAM_GROUP_LINK}`, { reply_markup: { inline_keyboard: [[{ text: "👥 Ochish", url: TELEGRAM_GROUP_LINK }]] } }); return; }
    if (data === "user_info") { await bot.sendMessage(chatId, `ℹ️ MA'LUMOT\n🚗 Avto diagnostika\n🎁 5 diagnostika = 1 BEPUL\n📱 ${MAX_CARS_PER_USER} tagacha avto\n📞 ${ADMIN_PHONE}\n📌 Versiya: V${currentVersion}`, { parse_mode: "Markdown" }); await sendMainMenu(chatId, false, userId); return; }
    if (data === "user_version_info") { await bot.sendMessage(chatId, `📌 Versiya: V${currentVersion}`, { parse_mode: "Markdown" }); await sendMainMenu(chatId, false, userId); return; }
    if (data === "security_back") { await sendMainMenu(chatId, true, userId); return; }
    if (data === "admin_manage_users_back") { userManagePage = 0; await sendMainMenu(chatId, true, userId); return; }
    if (data.startsWith("manage_user_")) { const targetId = parseInt(data.split("_")[2]); const tu = getUserByUserId(targetId); if (!tu) return; const info = `👤 ${tu.fullName || "Ismsiz"}\n📞 ${tu.phone}\n🚦 ${tu.isBlocked ? "🔴 BLOKLANGAN" : "🟢 FAOL"}\n🆔 ${tu.userId}\n📊 ${tu.totalDiagnosticsAll || 0} ta diagnostika\n📅 Qo'shilgan: ${formatDateSimple(tu.registeredDate)}`; const kb = []; if (tu.isBlocked) { kb.push([{ text: "✅ Blokdan ochish", callback_data: `unblock_user_${tu.userId}` }]); } else { kb.push([{ text: "🚫 Bloklash", callback_data: `block_user_${tu.userId}` }]); } kb.push([{ text: "🗑️ O'chirish", callback_data: `delete_user_${tu.userId}` }]); kb.push([{ text: "🔙 Ortga", callback_data: "admin_manage_users_back" }]); await bot.editMessageText(info, { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } }); return; }
    if (data.startsWith("block_user_")) { const id = parseInt(data.split("_")[2]); const res = blockUser(id); await bot.sendMessage(chatId, res.message, { parse_mode: "Markdown" }); await sendMainMenu(chatId, true, userId); return; }
    if (data.startsWith("unblock_user_")) { const id = parseInt(data.split("_")[2]); const res = unblockUser(id); await bot.sendMessage(chatId, res.message, { parse_mode: "Markdown" }); await sendMainMenu(chatId, true, userId); return; }
    if (data.startsWith("delete_user_")) { const id = parseInt(data.split("_")[2]); const res = deleteUser(id); await bot.sendMessage(chatId, res.message, { parse_mode: "Markdown" }); await sendMainMenu(chatId, true, userId); return; }
});

// -------------------- BOTNI ISHGA TUSHIRISH --------------------
loadData();
loadVideos();
loadConversations();
loadAdminSettings();
loadDeletedData();

cleanAllInvalidUsers();

console.log("=".repeat(50));
console.log(`🚗 ISUZU DOCTOR BOT ISHLADI! Versiya: V${currentVersion}`);
console.log(`👑 Adminlar: ${ADMIN_IDS.join(", ")}`);
console.log(`👥 Foydalanuvchilar: ${users.filter(u => !u.isAdmin).length}`);
console.log(`🔧 Diagnostikalar: ${diagnostics.length}`);
console.log(`💬 Muloqotlar: ${conversations.length}`);
console.log(`🗑️ O'chirilgan avtomobillar: ${deletedCars.length}`);
console.log(`🗑️ O'chirilgan diagnostikalar: ${deletedDiagnostics.length}`);
console.log("=".repeat(50));
