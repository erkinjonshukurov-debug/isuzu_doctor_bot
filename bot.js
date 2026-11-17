// security.js
const crypto = require('crypto');

// ======================== SHIFRLASH ========================
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

function encrypt(text) {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = Buffer.from(ENCRYPTION_KEY.padEnd(64, '0').slice(0, 64), 'hex');
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(String(text), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    } catch (e) {
        console.error('Encrypt error:', e.message);
        return text;
    }
}

function decrypt(text) {
    if (!text || typeof text !== 'string' || !text.includes(':')) return text;
    try {
        const parts = text.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encrypted = parts.join(':');
        const key = Buffer.from(ENCRYPTION_KEY.padEnd(64, '0').slice(0, 64), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return text;
    }
}

// ======================== RATE LIMITING ========================
const rateLimits = new Map();

function checkRateLimit(userId, action = 'default', maxRequests = 30, windowMs = 60000) {
    const key = `${userId}_${action}`;
    const now = Date.now();
    const userLimit = rateLimits.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > userLimit.resetAt) {
        userLimit.count = 0;
        userLimit.resetAt = now + windowMs;
    }
    userLimit.count++;
    rateLimits.set(key, userLimit);
    if (rateLimits.size > 10000) {
        for (const [k, v] of rateLimits) {
            if (now > v.resetAt) rateLimits.delete(k);
        }
    }
    return {
        allowed: userLimit.count <= maxRequests,
        remaining: Math.max(0, maxRequests - userLimit.count),
        resetAt: userLimit.resetAt
    };
}

// ======================== SPAM / VIRUS BOT DETEKTORI ========================
const SUSPICIOUS_PATTERNS = [
    /(?:free|bepul|bonus|prize|sovrin|yutuq).*(?:click|bosing|link|havola|t\.me|http)/i,
    /(?:investment|investitsiya|kripto|crypto|bitcoin|usdt|trx).*(?:daromad|foyda|profit|pul)/i,
    /(?:casino|kazino|slot|bet|stavka|poker).*(?:yut|win|pul)/i,
    /(?:viagra|cialis|pharmacy|dori|tabletka)/i,
    /(?:hack|vzlom|vzlomat|взлом|пароль|password|login).*(?:account|akkaunt|hisob)/i,
    /(?:porn|sex|adult|18\+)/i,
    /(?:telegram.*premium|premium.*telegram).*(?:free|bepul)/i,
    /(?:qarz|credit|kredit|loan).*(?:tez|fast|instant)/i,
    /(?:http[s]?:\/\/)?(?:bit\.ly|tinyurl|shorturl|goo\.gl|ow\.ly|is\.gd)\//i,
    /(?:t\.me\/\+).{15,}/,
    /\b(?:USDT|TRX|BTC|ETH)\b.*\b(?:send|yubor|qabul)\b/i
];

const BLOCKED_EXTENSIONS = ['.exe', '.scr', '.bat', '.cmd', '.com', '.pif', '.vbs', '.js', '.jar', '.msi', '.apk', '.dll'];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function isSuspiciousMessage(text) {
    if (!text || typeof text !== 'string') return { suspicious: false };
    const lower = text.toLowerCase();
    for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(lower)) {
            return { suspicious: true, reason: 'Shubhali kontent aniqlandi' };
        }
    }
    const linkCount = (text.match(/https?:\/\//gi) || []).length;
    if (linkCount > 3) return { suspicious: true, reason: 'Juda ko\'p havolalar' };
    const emojiCount = (text.match(/[\u{1F600}-\u{1F6FF}]/gu) || []).length;
    if (emojiCount > 20) return { suspicious: true, reason: 'Juda ko\'p emoji (spam)' };
    return { suspicious: false };
}

function isSuspiciousFile(msg) {
    const file = msg.document || msg.video || msg.animation || msg.audio;
    if (!file) return { suspicious: false };
    const fileName = (file.file_name || '').toLowerCase();
    const fileSize = file.file_size || 0;
    for (const ext of BLOCKED_EXTENSIONS) {
        if (fileName.endsWith(ext)) return { suspicious: true, reason: `Taqiqlangan fayl turi: ${ext}` };
    }
    if (fileSize > MAX_FILE_SIZE) return { suspicious: true, reason: `Fayl juda katta: ${(fileSize/1024/1024).toFixed(1)}MB` };
    return { suspicious: false };
}

// ======================== INPUT SANITIZATION ========================
function sanitizeInput(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/[\u0000-\u001F\u007F]/g, '').replace(/<[^>]*>/g, '').slice(0, 4000);
}

function escapeMarkdown(text) {
    if (!text) return '';
    return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// ======================== ANTI-FLOOD ========================
const floodTracker = new Map();

function checkFlood(userId) {
    const now = Date.now();
    const key = `flood_${userId}`;
    const data = floodTracker.get(key) || { timestamps: [], blockedUntil: 0 };
    if (now < data.blockedUntil) return { blocked: true, remainingMs: data.blockedUntil - now };
    data.timestamps = data.timestamps.filter(t => now - t < 10000);
    data.timestamps.push(now);
    if (data.timestamps.length > 15) {
        data.blockedUntil = now + 60000;
        floodTracker.set(key, data);
        return { blocked: true, remainingMs: 60000 };
    }
    floodTracker.set(key, data);
    return { blocked: false };
}

// ======================== LOG SANITIZE ========================
function sanitizeLog(text) {
    if (!text) return '';
    return String(text).replace(/[\n\r]/g, ' ').slice(0, 500);
}

// ======================== FILE ID VALIDATION ========================
function validateFileId(fileId) {
    if (!fileId || typeof fileId !== 'string') return false;
    if (fileId.length > 200) return false;
    if (!/^[A-Za-z0-9_-]+$/.test(fileId)) return false;
    return true;
}

// ======================== HASH ========================
function hashData(data) {
    return crypto.createHash('sha256').update(String(data)).digest('hex');
}

module.exports = {
    encrypt,
    decrypt,
    checkRateLimit,
    isSuspiciousMessage,
    isSuspiciousFile,
    sanitizeInput,
    escapeMarkdown,
    checkFlood,
    sanitizeLog,
    validateFileId,
    hashData,
    BLOCKED_EXTENSIONS,
    MAX_FILE_SIZE
};
// index.js
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const security = require('./security');

// ======================== XAVFSIZLIK: TOKEN TEKSHIRUVI ========================
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('❌ XATOLIK: BOT_TOKEN environment variable o\'rnatilmagan!');
    console.error('Iltimos, .env faylga BOT_TOKEN ni yozing yoki environment o\'rnating.');
    process.exit(1);
}
if (!/^\d+:[A-Za-z0-9_-]{35,}$/.test(BOT_TOKEN)) {
    console.error('❌ XATOLIK: BOT_TOKEN formati noto\'g\'ri!');
    process.exit(1);
}

// ======================== AVTORLIK HUQUQI VA LITSENZIYA ========================
const LICENSE_KEY = "ISUZU_DOCTOR_BOT_V2";
const BOT_OWNER = "Erkinjon Shukurov";
const BOT_OWNER_TELEGRAM = "@Erkinjon_Shukurov";
let currentVersion = "3.6";

// ======================== LINKLAR ========================
const NEW_BOT_LINK = "https://t.me/Isuzu_doctor_bot";
const INSTAGRAM_LINK = "https://www.instagram.com/isuzudoctor.979247888/";
const TELEGRAM_GROUP_LINK = "https://t.me/+piY0W4XrGqFkN2Iy";

// ======================== ADMIN BILAN BOG'LANISH ========================
const CONTACT_ADMIN_MESSAGE = `
Assalomu alaykum! 👋

🚗 *Isuzu Doctor* xizmatiga savollaringizni berishingiz mumkin.

✅ Doctor xabarni yuborishingiz bilan sizga javob beradi.

📝 Iltimos, savolingizni yoki muammoingizni yozib qoldiring.

📍 Lokatsiya yuborishingiz ham mumkin.

🔙 "Bekor qilish" tugmasini bossangiz, asosiy menyuga qaytasiz.
`;

// -------------------- VAQT ZONASI --------------------
function formatTashkentDateTime(date) {
    try {
        const d = new Date(date);
        return d.toLocaleString('uz-UZ', {
            timeZone: 'Asia/Tashkent',
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } catch(e) { return String(date); }
}

function formatDateSimple(date) {
    if (!date) return "❌ Sana yo'q";
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return "❌ Xato sana";
        const t = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
        return `${t.getDate().toString().padStart(2,'0')}.${(t.getMonth()+1).toString().padStart(2,'0')}.${t.getFullYear()}`;
    } catch(e) { return "❌ Xato sana"; }
}

function formatTimeSimple(date) {
    if (!date) return "❌ Vaqt yo'q";
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return "❌ Xato vaqt";
        const t = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
        return `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}`;
    } catch(e) { return "❌ Xato vaqt"; }
}

function formatFullDateTime(date) {
    try {
        const d = new Date(date);
        const t = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
        const months = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'];
        return `${t.getDate()}-${months[t.getMonth()]}, ${t.getFullYear()} ${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}:${t.getSeconds().toString().padStart(2,'0')}`;
    } catch(e) { return String(date); }
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
const ADMIN_PHONE = process.env.ADMIN_PHONE || "+998979247888";
const ADMIN_IDS = (process.env.ADMIN_IDS || '1437230485').split(',').map(s => parseInt(s.trim())).filter(Boolean);
const SUPER_ADMIN_ID = ADMIN_IDS[0] || 1437230485;
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

// ======================== PATH XAVFSIZLIGI ========================
function safePath(filePath) {
    const resolved = path.resolve(filePath);
    const base = path.resolve(VOLUME_PATH);
    if (!resolved.startsWith(base)) {
        throw new Error('Path traversal attempt blocked!');
    }
    return resolved;
}

// -------------------- O'CHIRILGAN MA'LUMOTLAR --------------------
let deletedCars = [];
let deletedDiagnostics = [];

function loadDeletedData() {
    try {
        if (fs.existsSync(safePath(DELETED_CARS_FILE))) deletedCars = JSON.parse(fs.readFileSync(safePath(DELETED_CARS_FILE), "utf8"));
        else deletedCars = [];
        if (!Array.isArray(deletedCars)) deletedCars = [];
        if (fs.existsSync(safePath(DELETED_DIAGNOSTICS_FILE))) deletedDiagnostics = JSON.parse(fs.readFileSync(safePath(DELETED_DIAGNOSTICS_FILE), "utf8"));
        else deletedDiagnostics = [];
        if (!Array.isArray(deletedDiagnostics)) deletedDiagnostics = [];
    } catch(e) { deletedCars = []; deletedDiagnostics = []; }
}

function saveDeletedCars() { try { fs.writeFileSync(safePath(DELETED_CARS_FILE), JSON.stringify(deletedCars, null, 2)); } catch(e) {} }
function saveDeletedDiagnostics() { try { fs.writeFileSync(safePath(DELETED_DIAGNOSTICS_FILE), JSON.stringify(deletedDiagnostics, null, 2)); } catch(e) {} }

function addDeletedCar(carNumber, userName, userPhone, reason = "Admin tomonidan o'chirildi", adminId = null) {
    const d = {
        id: Date.now(),
        carNumber: security.sanitizeInput(carNumber),
        userName: security.sanitizeInput(userName),
        userPhone: userPhone,
        reason: reason,
        deletedBy: adminId,
        deletedDate: new Date().toISOString()
    };
    deletedCars.push(d);
    saveDeletedCars();
    addSecurityLog("CAR_DELETED", adminId, `Avtomobil o'chirildi: ${carNumber}`);
    return d;
}

function addDeletedDiagnostic(diagnostic, reason = "Admin tomonidan o'chirildi", adminId = null) {
    const d = {
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
    deletedDiagnostics.push(d);
    saveDeletedDiagnostics();
    addSecurityLog("DIAGNOSTIC_DELETED", adminId, `Diagnostika o'chirildi: ${diagnostic.carNumber}`);
    return d;
}

// -------------------- MUHOQOT TIZIMI --------------------
let conversations = [];

function loadConversations() {
    try {
        if (fs.existsSync(safePath(CONVERSATIONS_FILE))) conversations = JSON.parse(fs.readFileSync(safePath(CONVERSATIONS_FILE), "utf8"));
        else conversations = [];
        if (!Array.isArray(conversations)) conversations = [];
    } catch(e) { conversations = []; }
}

function saveConversations() { try { fs.writeFileSync(safePath(CONVERSATIONS_FILE), JSON.stringify(conversations, null, 2)); } catch(e) {} }

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
    conv.messages.push({
        id: Date.now(), fromUserId: userId, toUserId: adminId,
        message: security.sanitizeInput(message), type, location,
        timestamp: new Date().toISOString(), isRead: false
    });
    if (userId === conv.userId) conv.adminUnreadCount = (conv.adminUnreadCount || 0) + 1;
    else conv.userUnreadCount = (conv.userUnreadCount || 0) + 1;
    saveConversations();
    return true;
}

function addAdminReply(adminId, userId, message, type = "text", location = null) {
    const conv = getOrCreateConversation(userId, adminId);
    conv.messages.push({
        id: Date.now(), fromUserId: adminId, toUserId: userId,
        message: security.sanitizeInput(message), type, location,
        timestamp: new Date().toISOString(), isRead: false
    });
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
    const conv = conversations[index];
    const u = getUserByUserId(conv.userId);
    const userName = u ? (u.fullName || u.phone || `ID:${conv.userId}`) : "Noma'lum";
    conversations.splice(index, 1);
    saveConversations();
    addSecurityLog("CONVERSATION_DELETED", adminId, `Muloqot o'chirildi: ${userName}`);
    return { success: true, message: `✅ "${userName}" bilan muloqot o'chirildi!` };
}

function parseMapUrl(text) {
    if (!text) return null;
    let m = text.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = text.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = text.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
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
    const last = conversation.messages.slice(-20);
    for (const m of last) {
        const sender = m.fromUserId === conversation.userId ? "👤 Siz" : "👑 Admin";
        const time = formatTashkentDateTime(m.timestamp);
        if (m.type === "location" && m.location) {
            const lat = m.location.latitude, lng = m.location.longitude;
            msg += `📍 *${sender}* (${time}): Lokatsiya\n`;
            msg += `   🗺️ [Google Maps](https://www.google.com/maps?q=${lat},${lng})\n`;
            msg += `   🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${lng},${lat}&z=15)\n`;
            msg += `   🗺️ [2GIS](https://2gis.uz/search/${lat},${lng})\n`;
            msg += `   🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15)\n`;
        } else {
            msg += `💬 *${sender}* (${time}):\n   ${m.message}\n`;
        }
        msg += "━━━━━━━━━━━━━━━━━━\n";
    }
    if (isAdminView) {
        msg += "\n✏️ *Javob yozing*\n📍 *Lokatsiya yuborish:*\n   • 📍 Joriy lokatsiyam\n   • 🗺️ Xaritadan tanlash\n━━━━━━━━━━━━━━━━━━\n🗑️ Bu muloqotni o'chirish\n🔙 Muloqotlar ro'yxati";
        const kb = { reply_markup: { keyboard: [
            [{ text: "📍 Joriy lokatsiyam", request_location: true }],
            [{ text: "🗺️ Xaritadan lokatsiya tanlash" }],
            [{ text: "🗑️ Bu muloqotni o'chirish" }],
            [{ text: "🔙 Muloqotlar ro'yxati" }]
        ], resize_keyboard: true } };
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", disable_web_page_preview: true, ...kb });
    } else {
        msg += "\n✏️ *Xabaringizni yozing*\n📍 Lokatsiya yuborish mumkin\n🔙 Asosiy menyu";
        const kb = { reply_markup: { keyboard: [[{text:"📍 Lokatsiya yuborish", request_location:true}],[{text:"🔙 Asosiy menyu"}]], resize_keyboard:true } };
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", disable_web_page_preview: true, ...kb });
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
    const kb = [];
    for (let i=0; i<pageConvs.length; i++) {
        const conv = pageConvs[i];
        const u = getUserByUserId(conv.userId);
        const userName = u ? (u.fullName || u.phone || `ID:${conv.userId}`) : `ID:${conv.userId}`;
        const lastMsg = conv.messages[conv.messages.length-1];
        const lastMsgText = lastMsg ? (lastMsg.type==="location" ? "📍 Lokatsiya" : (lastMsg.message || "").substring(0,30)) : "Xabar yo'q";
        const unread = conv.adminUnreadCount || 0;
        const unreadIcon = unread > 0 ? `🔴 ${unread}🆕 ` : "";
        const num = start + i + 1;
        msg += `${num}. ${unreadIcon}*${userName.substring(0,25)}*\n   📝 ${lastMsgText}\n   📅 ${lastMsg ? formatTashkentDateTime(lastMsg.timestamp) : "-"}\n   💬 ${conv.messages.length} ta xabar\n━━━━━━━━━━━━━━━━━━\n`;
        kb.push([
            { text: `💬 ${num}. Javob berish`, callback_data: `open_conversation_${conv.userId}` },
            { text: `🗑️ ${num}. O'chirish`, callback_data: `delete_conv_${conv.id}` }
        ]);
    }
    const nav = [];
    if (page > 0) nav.push({ text: "◀️ Oldingi", callback_data: `conversations_page_${page-1}` });
    if (start + itemsPerPage < all.length) nav.push({ text: "Keyingi ▶️", callback_data: `conversations_page_${page+1}` });
    if (nav.length) kb.push(nav);
    kb.push([{ text: "🔙 Ortga", callback_data: "back_to_main" }]);
    await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } });
}

// -------------------- VIDEO GALEREYA --------------------
let videoList = [];
function loadVideos() {
    try {
        if(fs.existsSync(safePath(VIDEOS_FILE))) videoList = JSON.parse(fs.readFileSync(safePath(VIDEOS_FILE),"utf8"));
        else videoList=[];
        if (!Array.isArray(videoList)) videoList = [];
        videoList.forEach(v => {
            if (!v.videoType) v.videoType = "video";
            if (v.views === undefined) v.views = 0;
            if (v.likes === undefined) v.likes = 0;
        });
    } catch(e) { videoList=[]; }
}
function saveVideos() { try { fs.writeFileSync(safePath(VIDEOS_FILE), JSON.stringify(videoList,null,2)); } catch(e) {} }

function addVideo(fileId, title, desc, adminId, videoType = "video") {
    if (!security.validateFileId(fileId)) return false;
    if (!title || title.length > 100) return false;
    if (desc && desc.length > 500) return false;
    videoList.unshift({
        id: Date.now(),
        fileId: fileId,
        videoType: videoType,
        title: security.sanitizeInput(title),
        description: security.sanitizeInput(desc || ""),
        views: 0, likes: 0, likedBy: [],
        uploadedBy: adminId,
        uploadDate: new Date().toISOString(),
        isActive: true
    });
    saveVideos();
    return true;
}

function getActiveVideos() { return videoList.filter(v=>v.isActive); }
function deleteVideo(videoId) { const idx = videoList.findIndex(v=>v.id===videoId); if(idx!==-1) videoList.splice(idx,1); saveVideos(); }

// -------------------- DATABASE --------------------
let users = [], diagnostics = [], errors = [], adminSettings = { allowedEditors: [], securityLog: [] };
let uniqueInstallId = crypto.createHash('sha256').update(os.hostname() + LICENSE_KEY).digest('hex').substring(0,16);

function ensureDir() {
    if(!fs.existsSync(VOLUME_PATH)) fs.mkdirSync(VOLUME_PATH,{recursive:true});
    if(!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR,{recursive:true});
    if(!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR,{recursive:true});
}
ensureDir();

function loadData() {
    try {
        if(fs.existsSync(safePath(USERS_FILE))) users = JSON.parse(fs.readFileSync(safePath(USERS_FILE),"utf8"));
        else users = [];
        if(!Array.isArray(users)) users = [];
        if(fs.existsSync(safePath(DIAGNOSTICS_FILE))) diagnostics = JSON.parse(fs.readFileSync(safePath(DIAGNOSTICS_FILE),"utf8"));
        else diagnostics = [];
        if(!Array.isArray(diagnostics)) diagnostics = [];
        if(fs.existsSync(safePath(ERRORS_FILE))) errors = JSON.parse(fs.readFileSync(safePath(ERRORS_FILE),"utf8"));
        else errors = [];
        if(!Array.isArray(errors)) errors = [];
        users.forEach(u => {
            if(u.isBlocked===undefined) u.isBlocked=false;
            if(!u.cars || !Array.isArray(u.cars)) u.cars=[];
            if(u.totalDiagnosticsAll===undefined) u.totalDiagnosticsAll=0;
            if(u.totalBonusCount===undefined) u.totalBonusCount=0;
            if(u.totalFreeDiagnostics===undefined) u.totalFreeDiagnostics=0;
            if(!u.registeredDate && u.cars && u.cars.length>0 && u.cars[0].addedDate) u.registeredDate = u.cars[0].addedDate;
            if(!u.registeredDate) u.registeredDate = new Date().toISOString();
        });
        saveUsers();
    } catch(e) { console.error("loadData:", security.sanitizeLog(e.message)); users = []; diagnostics = []; errors = []; }
}
function saveUsers() { try { fs.writeFileSync(safePath(USERS_FILE), JSON.stringify(users,null,2)); } catch(e) { console.error("saveUsers:", security.sanitizeLog(e.message)); } }
function saveDiagnostics() { try { fs.writeFileSync(safePath(DIAGNOSTICS_FILE), JSON.stringify(diagnostics,null,2)); } catch(e) {} }
function saveErrors() { try { fs.writeFileSync(safePath(ERRORS_FILE), JSON.stringify(errors,null,2)); } catch(e) {} }

function getUserByPhone(phone) { return users.find(u=>u.phone===phone); }
function getUserByUserId(id) { return users.find(u=>u.userId===id); }
function isAdmin(id) { return ADMIN_IDS.includes(id); }

function addNewUser(id, phone, car, fn, ln, un) {
    const now = getCurrentTashkentTime();
    const newUser = {
        userId: id, phone: phone,
        firstName: security.sanitizeInput(fn || ""),
        lastName: security.sanitizeInput(ln || ""),
        username: security.sanitizeInput(un || ""),
        fullName: `${fn || ""} ${ln || ""}`.trim(),
        isAdmin: false, isActive: true, isBlocked: false,
        registeredDate: now.toISOString(),
        cars: [{
            carId: Date.now(), carNumber: security.sanitizeInput(car),
            bonusCount: 0, freeDiagnostics: 0, totalDiagnostics: 0,
            addedDate: now.toISOString(), isActive: true
        }],
        totalBonusCount: 0, totalFreeDiagnostics: 0, totalDiagnosticsAll: 0
    };
    users.push(newUser);
    saveUsers();
    return newUser;
}

function addCarToUser(phone, car) {
    const user = getUserByPhone(phone);
    if(!user) return { success:false, message:"❌ Foydalanuvchi topilmadi" };
    if(user.cars.length >= MAX_CARS_PER_USER) return { success:false, message:`❌ Maksimum ${MAX_CARS_PER_USER} ta avtomobil` };
    if(user.cars.find(c=>c.carNumber===car)) return { success:false, message:"❌ Bu avtomobil allaqachon bor" };
    user.cars.push({ carId:Date.now(), carNumber:security.sanitizeInput(car), bonusCount:0, freeDiagnostics:0, totalDiagnostics:0, addedDate:getCurrentTashkentTime().toISOString(), isActive:true });
    saveUsers();
    return { success:true, message:"✅ Avtomobil qo'shildi" };
}

async function deleteCarWithDiagnostics(chatId, userId, carNumber, adminId) {
    const user = getUserByUserId(userId);
    if (!user) { await bot.sendMessage(chatId, "❌ Foydalanuvchi topilmadi!", { parse_mode: "Markdown" }); return false; }
    const carIndex = user.cars.findIndex(c => c.carNumber === carNumber);
    if (carIndex === -1) { await bot.sendMessage(chatId, "❌ Avtomobil topilmadi!", { parse_mode: "Markdown" }); return false; }
    const carDiags = diagnostics.filter(d => d.carNumber === carNumber && d.phoneNumber === user.phone);
    let totalDeletedAmount = 0, deletedCount = 0, bonusReduction = 0, freeReduction = 0;
    for (const diag of carDiags) {
        addDeletedDiagnostic(diag, `Avtomobil o'chirilgan: ${carNumber}`, adminId);
        if (!diag.isFree && diag.diagnosticPrice > 0) bonusReduction++;
        if (diag.isFree) freeReduction++;
        totalDeletedAmount += (diag.diagnosticPrice || 0) + (diag.laborPrice || 0);
        deletedCount++;
        const idx = diagnostics.findIndex(d => d.id === diag.id);
        if (idx !== -1) diagnostics.splice(idx, 1);
    }
    user.totalBonusCount = Math.max(0, (user.totalBonusCount || 0) - bonusReduction);
    user.totalFreeDiagnostics = Math.max(0, (user.totalFreeDiagnostics || 0) - freeReduction);
    user.totalDiagnosticsAll = Math.max(0, (user.totalDiagnosticsAll || 0) - deletedCount);
    addDeletedCar(carNumber, user.fullName || user.phone, user.phone, `Admin o'chirdi`, adminId);
    user.cars.splice(carIndex, 1);
    saveUsers(); saveDiagnostics();
    addSecurityLog("CAR_AND_DIAGNOSTICS_DELETED", adminId, `Avto: ${carNumber}, ${deletedCount} diag, ${totalDeletedAmount} so'm`);
    let r = `✅ *AVTOMOBIL O'CHIRILDI!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    r += `🚗 *Avtomobil:* ${carNumber}\n👤 *Foydalanuvchi:* ${user.fullName || user.phone}\n`;
    r += `📊 *O'chirilgan diagnostikalar:* ${deletedCount} ta\n`;
    r += `💰 *O'chirilgan summa:* ${totalDeletedAmount.toLocaleString()} so'm\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (bonusReduction > 0) r += `🎁 *Bonuslar kamaydi:* ${bonusReduction} ta\n`;
    if (freeReduction > 0) r += `🎉 *Bepul xizmatlar kamaydi:* ${freeReduction} ta\n`;
    r += "\n📌 Barcha o'zgarishlar hisobga olindi.";
    await bot.sendMessage(chatId, r, { parse_mode: "Markdown" });
    return true;
}

function getBonusInfo(carObj) {
    const currentBonus = carObj.bonusCount || 0;
    const currentFree = carObj.freeDiagnostics || 0;
    return {
        bonusCount: currentBonus, freeDiagnostics: currentFree,
        remainingToFree: currentBonus > 0 ? 5 - currentBonus : 5,
        nextFreeAfter: currentBonus > 0 ? 5 - currentBonus : 5,
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
        isFree=true; newFree--; price=0;
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
    diagnostics.push({
        id: Date.now(), userId: user.userId, phoneNumber: phone, carNumber: car,
        date: getCurrentTashkentTime().toISOString(),
        workDescription: security.sanitizeInput(work),
        additionalNotes: security.sanitizeInput(notes),
        diagnosticPrice: price, laborPrice: extraPrice,
        laborDescription: security.sanitizeInput(extraDesc),
        totalPrice: price + extraPrice, isFree,
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
    return {
        success: true, isFree,
        diagnosticPrice: price, laborPrice: extraPrice,
        totalPrice: price + extraPrice,
        bonusMessage: bonusMsg, carNumber: car,
        bonusInfo: getBonusInfo(carObj)
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
    const totalDeletedAmount = deletedDiagnostics.reduce((s, d) => s + (d.diagnosticPrice || 0) + (d.laborPrice || 0), 0);
    return {
        totalUsers:active.length,
        blockedUsers:users.filter(u=>!u.isAdmin && u.isBlocked).length,
        totalCars:cars, totalDiagnostics:diagnostics.length,
        diagnosticIncome:diagInc, laborIncome:laborInc, totalIncome:diagInc+laborInc,
        currentVersion, totalVideos:videoList.length, totalVideoViews,
        unreadMessages:getTotalUnreadForAdmin(ADMIN_IDS[0]),
        deletedCarsCount: deletedCars.length,
        deletedDiagnosticsCount: deletedDiagnostics.length,
        deletedTotalAmount: totalDeletedAmount
    };
}

function getTodayDiagnostics() {
    const today = getCurrentTashkentTime().toISOString().split("T")[0];
    return diagnostics.filter(d => {
        try {
            const dd = new Date(d.date).toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }).split(",")[0];
            return dd === today || (d.date && d.date.split("T")[0] === today);
        } catch(e) { return false; }
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
    users = users.filter(u => {
        if (u.isAdmin === true) return true;
        const hasValidPhone = u.phone && u.phone !== "Telefon yo'q" && u.phone !== "" && u.phone !== null && u.phone !== "null";
        const hasCars = u.cars && u.cars.length > 0;
        if (!hasValidPhone && !hasCars) { deletedCount++; return false; }
        return true;
    });
    if (deletedCount > 0) saveUsers();
    return deletedCount;
}

function cleanAllInvalidUsers() {
    let deleted = deleteInvalidUsers();
    let add = 0;
    for (let i = users.length - 1; i >= 0; i--) {
        const u = users[i];
        if (u.isAdmin) continue;
        const hv = u.phone && u.phone !== "Telefon yo'q" && u.phone !== "" && u.phone !== null;
        const hc = u.cars && u.cars.length > 0;
        if (!hv && !hc) { users.splice(i, 1); add++; }
    }
    if (add > 0) saveUsers();
    return deleted + add;
}

function getAllUsersWithDetails() {
    const list = [];
    for (const u of users) {
        if (u.isAdmin) continue;
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
        list.push({
            userId: u.userId, fullName: u.fullName || "Ismsiz", phone: u.phone || "Telefon yo'q",
            cars: carsList, totalDiagnostics: u.totalDiagnosticsAll || 0,
            isBlocked: u.isBlocked === true, registeredDate: u.registeredDate || "2000-01-01T00:00:00.000Z"
        });
    }
    list.sort((a, b) => new Date(b.registeredDate) - new Date(a.registeredDate));
    return list;
}

function blockUser(id) { const u=getUserByUserId(id); if(u && !u.isAdmin) { u.isBlocked=true; saveUsers(); return { success:true, message:"✅ Foydalanuvchi bloklandi" }; } return { success:false, message:"❌ Xatolik" }; }
function unblockUser(id) { const u=getUserByUserId(id); if(u) { u.isBlocked=false; saveUsers(); return { success:true, message:"✅ Blokdan ochildi" }; } return { success:false, message:"❌ Xatolik" }; }
function deleteUser(id) {
    const user = getUserByUserId(id);
    if(!user || user.isAdmin) return { success:false, message:"❌ Xatolik" };
    for(const car of user.cars) {
        const carDiags = diagnostics.filter(d => d.carNumber === car.carNumber && d.phoneNumber === user.phone);
        for(const diag of carDiags) {
            addDeletedDiagnostic(diag, "Foydalanuvchi o'chirilgan", SUPER_ADMIN_ID);
            const idx = diagnostics.findIndex(d => d.id === diag.id);
            if(idx !== -1) diagnostics.splice(idx, 1);
        }
        addDeletedCar(car.carNumber, user.fullName || user.phone, user.phone, "Foydalanuvchi o'chirilgan", SUPER_ADMIN_ID);
    }
    const idx = users.findIndex(u=>u.userId===id);
    if(idx!==-1) {
        users.splice(idx,1); saveUsers(); saveDiagnostics();
        return { success:true, message:"🗑️ Foydalanuvchi o'chirildi" };
    }
    return { success:false, message:"❌ Xatolik" };
}

function addSecurityLog(action, userId, details) {
    if (!adminSettings.securityLog) adminSettings.securityLog = [];
    adminSettings.securityLog.unshift({
        id: Date.now(), action, userId,
        details: security.sanitizeLog(details),
        date: new Date().toISOString()
    });
    if (adminSettings.securityLog.length > 100) adminSettings.securityLog = adminSettings.securityLog.slice(0, 100);
    saveAdminSettings();
}

function saveAdminSettings() { try { fs.writeFileSync(safePath(ADMIN_SETTINGS_FILE), JSON.stringify(adminSettings, null, 2)); } catch(e) {} }
function loadAdminSettings() {
    try {
        if(fs.existsSync(safePath(ADMIN_SETTINGS_FILE))) adminSettings = JSON.parse(fs.readFileSync(safePath(ADMIN_SETTINGS_FILE), "utf8"));
        else adminSettings = { allowedEditors: [], securityLog: [] };
        if (!adminSettings.securityLog || !Array.isArray(adminSettings.securityLog)) adminSettings.securityLog = [];
        if (!adminSettings.allowedEditors || !Array.isArray(adminSettings.allowedEditors)) adminSettings.allowedEditors = [];
    } catch(e) { adminSettings = { allowedEditors: [], securityLog: [] }; }
}

async function sendNotificationToAllUsers(msg, keyboard = null) {
    let s=0,f=0;
    for(const u of users.filter(u=>!u.isAdmin && !u.isBlocked)) {
        try { await bot.sendMessage(u.userId, msg, { parse_mode:"Markdown", reply_markup:keyboard }); s++; }
        catch(e) { f++; }
    }
    return { success:s, fail:f };
}

// ============ FORMAT FUNKSIYALARI ============
function formatDiagnosticMessageForUser(d, includePhone = false, bonusInfo = null) {
    const total = (d.diagnosticPrice || 0) + (d.laborPrice || 0);
    let msg = "🔧 *DIAGNOSTIKA QO'SHILDI*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    if (includePhone && d.phoneNumber) msg += `👤 *Mijoz:* ${d.phoneNumber}\n`;
    msg += `🚗 *Avtomobil:* ${d.carNumber}\n📅 *Sana:* ${formatFullDateTime(d.date)}\n\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📝 *BAJARILGAN ISHLAR:*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `${d.workDescription}\n\n`;
    if (d.laborDescription && d.laborPrice > 0) {
        msg += "🔨 *QO'SHIMCHA ISHLAR:*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += `${d.laborDescription}\n💰 *Narxi:* ${d.laborPrice.toLocaleString()} so'm\n\n`;
    }
    if (d.additionalNotes && d.additionalNotes.trim() !== "") {
        msg += "📌 *ESLATMA:*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += `${d.additionalNotes}\n\n`;
    }
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💰 *NARXLAR:*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    if (d.isFree) msg += `🎉 *BEPUL!* (Bonus hisobidan)\n`;
    else {
        if (d.diagnosticPrice > 0) msg += `🔧 *Diagnostika:* ${d.diagnosticPrice.toLocaleString()} so'm\n`;
        if (d.laborPrice > 0) msg += `🔨 *Mehnat:* ${d.laborPrice.toLocaleString()} so'm\n`;
    }
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `💰 *JAMI TO'LOV:* ${total.toLocaleString()} so'm\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (bonusInfo) {
        msg += "\n🎁 *BONUS MA'LUMOTI*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += `📊 *Joriy bonus:* ${bonusInfo.bonusCount}/5\n🎉 *Bepul diagnostikalar:* ${bonusInfo.freeDiagnostics} ta\n📈 *Umumiy diagnostika:* ${bonusInfo.totalDiagnostics} ta\n`;
        if (bonusInfo.remainingToFree > 0 && bonusInfo.remainingToFree < 5) msg += `✨ *Yana ${bonusInfo.remainingToFree} ta diagnostikadan keyin 1 BEPUL!*\n`;
        else if (bonusInfo.remainingToFree === 5 && bonusInfo.bonusCount === 0) msg += `✨ *5 ta diagnostika va 1 BEPUL!*\n`;
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    }
    if (d.isFree) msg += `\n🎉 *TABRIKLAYMIZ!* Bepul diagnostikadan foydalandingiz!\n`;
    msg += `\n© ${BOT_OWNER} | Isuzu Doctor Bot`;
    return msg;
}

function formatDiagnosticMessageForAdmin(d) {
    const total = (d.diagnosticPrice || 0) + (d.laborPrice || 0);
    let msg = "🔧 *DIAGNOSTIKA QO'SHILDI*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    msg += `👤 *Mijoz:* ${d.phoneNumber || "Noma'lum"}\n🚗 *Avtomobil:* ${d.carNumber}\n📅 *Sana:* ${formatFullDateTime(d.date)}\n\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📝 *BAJARILGAN ISHLAR:*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `${d.workDescription}\n\n`;
    if (d.laborDescription && d.laborPrice > 0) {
        msg += "🔨 *QO'SHIMCHA ISHLAR:*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += `${d.laborDescription}\n💰 *Narxi:* ${d.laborPrice.toLocaleString()} so'm\n\n`;
    }
    if (d.additionalNotes && d.additionalNotes.trim() !== "") {
        msg += "📌 *ESLATMA:*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += `${d.additionalNotes}\n\n`;
    }
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💰 *NARXLAR:*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    if (d.isFree) msg += `🎉 *BEPUL!* (Bonus hisobidan)\n`;
    else {
        if (d.diagnosticPrice > 0) msg += `🔧 *Diagnostika:* ${d.diagnosticPrice.toLocaleString()} so'm\n`;
        if (d.laborPrice > 0) msg += `🔨 *Mehnat:* ${d.laborPrice.toLocaleString()} so'm\n`;
    }
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `💰 *JAMI TO'LOV:* ${total.toLocaleString()} so'm\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (d.bonusMessage) msg += `\n${d.bonusMessage}\n`;
    if (d.bonusInfo) msg += `\n📊 *BONUS HOLATI:*\n🎁 ${d.bonusInfo.bonusCount}/5 bonus | 🎉 ${d.bonusInfo.freeDiagnostics} bepul\n`;
    msg += "\n✅ Foydalanuvchiga bildirishnoma yuborildi.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
    return msg;
}

async function generateFullReport(chatId) {
    const stats = getStatistics();
    const todayDiags = getTodayDiagnostics();
    const nearBonus = getNearBonusCars();
    let r = "📊 *ISUZU DOCTOR BOT HISOBOTI*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    r += `📅 Sana: ${formatTashkentDateTime(new Date())}\n📌 Bot versiyasi: V${currentVersion}\n\n`;
    r += "👥 *FOYDALANUVCHILAR*\n";
    r += `   • Faol: ${stats.totalUsers} ta\n   • Bloklangan: ${stats.blockedUsers} ta\n`;
    r += `   • Avtomobillar: ${stats.totalCars} ta\n   • Jami ro'yxatdan o'tgan: ${users.filter(u => !u.isAdmin).length} ta\n\n`;
    r += "🔧 *DIAGNOSTIKA*\n";
    r += `   • Jami: ${stats.totalDiagnostics} ta\n   • Diagnostika daromadi: ${stats.diagnosticIncome.toLocaleString()} so'm\n`;
    r += `   • Mehnat daromadi: ${stats.laborIncome.toLocaleString()} so'm\n   • Jami daromad: ${stats.totalIncome.toLocaleString()} so'm\n\n`;
    r += "🗑️ *O'CHIRILGANLAR*\n";
    r += `   • Avtomobillar: ${stats.deletedCarsCount} ta\n   • Diagnostikalar: ${stats.deletedDiagnosticsCount} ta\n`;
    r += `   • Summa: ${stats.deletedTotalAmount.toLocaleString()} so'm\n\n`;
    r += "📅 *BUGUNGI*\n";
    if (todayDiags.length === 0) r += "   • Bugun diagnostika yo'q\n";
    else {
        let todayIncome=0;
        for(const d of todayDiags) todayIncome += (d.diagnosticPrice||0)+(d.laborPrice||0);
        r += `   • ${todayDiags.length} ta diagnostika\n   • Bugungi daromad: ${todayIncome.toLocaleString()} so'm\n`;
    }
    r += "\n🎁 *BONUSGA YAQINLAR*\n";
    if (nearBonus.length === 0) r += "   • Yo'q\n";
    else for(const nb of nearBonus.slice(0,5)) r += `   • ${nb.carNumber} (${nb.bonusCount}/5) - ${nb.remaining} ta qoldi\n`;
    r += "\n📹 *VIDEO*\n";
    r += `   • Jami: ${stats.totalVideos} ta\n   • Ko'rishlar: ${stats.totalVideoViews} ta\n\n`;
    r += "💬 *MUHOQOTLAR*\n";
    r += `   • O'qilmagan: ${stats.unreadMessages} ta\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n© ${BOT_OWNER} | Isuzu Doctor Bot`;
    return r;
}

async function generateDiagnosticsHistoryFile(chatId, limit = 500) {
    const diags = getAllDiagnostics(limit);
    if (diags.length === 0) {
        await bot.sendMessage(chatId, "📭 Diagnostikalar mavjud emas!", { parse_mode:"Markdown" });
        return null;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filepath = safePath(path.join(REPORTS_DIR, `diagnostika_tarixi_${timestamp}.txt`));
    let c = "=".repeat(80) + "\n                    DIAGNOSTIKA TARIXI\n" + "=".repeat(80) + "\n\n";
    c += `📅 Yaratilgan: ${formatTashkentDateTime(new Date())}\n📊 Jami: ${diags.length} ta\n` + "=".repeat(80) + "\n\n";
    let totalDiag=0, totalLabor=0, freeCount=0, paidCount=0;
    for (let i=0; i<diags.length; i++) {
        const d = diags[i];
        const dp = d.diagnosticPrice || 0, lp = d.laborPrice || 0;
        if (dp>0) paidCount++;
        if (d.isFree) freeCount++;
        totalDiag += dp; totalLabor += lp;
        c += `📌 ${diags.length-i}-DIAGNOSTIKA\n` + "─".repeat(80) + "\n";
        c += `📆 Sana: ${formatTashkentDateTime(d.date)}\n🚗 Avtomobil: ${d.carNumber}\n👤 Telefon: ${d.phoneNumber}\n\n`;
        c += "📝 BAJARILGAN ISHLAR:\n" + d.workDescription + "\n\n";
        if (d.laborDescription && d.laborPrice>0) c += "🔨 QO'SHIMCHA ISH:\n" + d.laborDescription + "\n💰 " + d.laborPrice.toLocaleString() + " so'm\n\n";
        if (d.additionalNotes) c += "📌 ESLATMA:\n" + d.additionalNotes + "\n\n";
        c += "💰 NARXLAR:\n";
        if (d.isFree) c += "   🎉 BEPUL\n";
        else {
            if (dp>0) c += `   🔧 Diagnostika: ${dp.toLocaleString()} so'm\n`;
            if (lp>0) c += `   🔨 Mehnat: ${lp.toLocaleString()} so'm\n`;
        }
        c += `   💰 JAMI: ${(dp+lp).toLocaleString()} so'm\n\n` + "─".repeat(80) + "\n\n";
    }
    c += "=".repeat(80) + "\n📊 JAMI STATISTIKA\n" + "=".repeat(80) + "\n";
    c += `📊 Jami: ${diags.length} ta\n💰 To'lovli: ${paidCount} ta\n🎉 Bepul: ${freeCount} ta\n`;
    c += `💵 Diagnostika: ${totalDiag.toLocaleString()} so'm\n🔨 Mehnat: ${totalLabor.toLocaleString()} so'm\n`;
    c += `💰 Umumiy: ${(totalDiag+totalLabor).toLocaleString()} so'm\n` + "=".repeat(80) + "\n© " + BOT_OWNER + "\n";
    fs.writeFileSync(filepath, c, "utf8");
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
        [{ text:"👥 Guruh", callback_data:"user_telegram_group" }, { text:"💬 Admin"+badge, callback_data:"user_contact_admin" }],
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
    if(videos.length===0) { await bot.sendMessage(chatId, "📹 Videolar yo'q", { parse_mode: "Markdown" }); return; }
    let msg=`📹 *VIDEO GALEREYA*\n━━━━━━━━━━━━━━━━━━\n📊 Jami: ${videos.length} ta\n━━━━━━━━━━━━━━━━━━\n\n`;
    const kb=[];
    for(let i=0;i<pageVids.length;i++) {
        const v=pageVids[i], num=start+i+1;
        const ti = v.videoType === "document" ? "📄" : (v.videoType === "animation" ? "🎞️" : "🎬");
        msg+=`${num}. ${ti} *${v.title}*\n👁️ ${v.views||0} | 👍 ${v.likes||0}\n━━━━━━━━━━━━━━━━━━\n`;
        kb.push([{ text:`▶️ ${num}. ${v.title.substring(0,25)}`, callback_data:`watch_video_${v.id}` }]);
    }
    const nav=[];
    if(page>0) nav.push({ text:"◀️", callback_data:`video_page_${page-1}` });
    if(start+items<videos.length) nav.push({ text:"▶️", callback_data:`video_page_${page+1}` });
    if(nav.length) kb.push(nav);
    kb.push([{ text:"🔙 Asosiy menyu", callback_data:"back_to_main" }]);
    await bot.sendMessage(chatId, msg, { parse_mode:"Markdown", reply_markup:{ inline_keyboard:kb } });
}

async function showVideoManagement(chatId, page=0) {
    const videos = getActiveVideos();
    const items=5, start=page*items, pageVids=videos.slice(start,start+items);
    if(videos.length===0) { await bot.sendMessage(chatId, "📹 Videolar yo'q", { parse_mode: "Markdown" }); return; }
    let msg=`📹 *VIDEO BOSHQARISH*\n━━━━━━━━━━━━━━━━━━\n📊 Jami: ${videos.length} ta\n━━━━━━━━━━━━━━━━━━\n\n`;
    const kb=[];
    for(let i=0;i<pageVids.length;i++) {
        const v=pageVids[i], num=start+i+1;
        const ti = v.videoType === "document" ? "📄" : (v.videoType === "animation" ? "🎞️" : "🎬");
        msg+=`${num}. ${ti} *${v.title}*\n👁️ ${v.views||0} | 👍 ${v.likes||0}\n━━━━━━━━━━━━━━━━━━\n`;
        kb.push([{ text:`🗑️ ${num}. ${v.title.substring(0,25)}`, callback_data:`delete_video_${v.id}` }]);
    }
    const nav=[];
    if(page>0) nav.push({ text:"◀️ Oldingi", callback_data:`video_manage_page_${page-1}` });
    if(start+items<videos.length) nav.push({ text:"Keyingi ▶️", callback_data:`video_manage_page_${page+1}` });
    if(nav.length) kb.push(nav);
    kb.push([{ text:"🔙 Ortga", callback_data:"back_to_main" }]);
    await bot.sendMessage(chatId, msg, { parse_mode:"Markdown", reply_markup:{ inline_keyboard:kb } });
}

// ========== FOYDALANUVCHILAR RO'YXATI ==========
let usersListPage = 0;
const USERS_PER_PAGE = 10;

async function showUsersList(chatId, page, messageId = null) {
    const usersList = getAllUsersWithDetails();
    if (usersList.length === 0) {
        const msg = "📭 Hech qanday foydalanuvchi yo'q";
        if (messageId) { try { await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" }); } catch(e) { await bot.sendMessage(chatId, msg); } }
        else await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
        return;
    }
    const start = page * USERS_PER_PAGE;
    const pageUsers = usersList.slice(start, start + USERS_PER_PAGE);
    const totalPages = Math.ceil(usersList.length / USERS_PER_PAGE);
    let msg = "👥 *FOYDALANUVCHILAR RO'YXATI*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `📄 Sahifa: ${page + 1}/${totalPages}\n👤 Jami: ${usersList.length} ta\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += "🟢 Faol | 🔴 Bloklangan\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    for (let i = 0; i < pageUsers.length; i++) {
        const u = pageUsers[i], num = start + i + 1;
        const status = u.isBlocked ? "🔴" : "🟢";
        msg += `${status} *${num}. ${(u.fullName || "Ismsiz").substring(0, 25)}*\n`;
        msg += `📞 ${u.phone}\n📅 Ro'yxat: ${formatDateSimple(u.registeredDate)} ${formatTimeSimple(u.registeredDate)}\n`;
        msg += `📊 Jami diagnostika: ${u.totalDiagnostics} ta\n`;
        if (u.cars && u.cars.length > 0) {
            msg += `🚗 *Avtomobillar (${u.cars.length}):*\n`;
            for (let j = 0; j < u.cars.length; j++) {
                const car = u.cars[j];
                msg += `   ${j+1}. ${car.carNumber} - 🎁${car.bonusCount}/5 - 🎉${car.freeDiagnostics}\n`;
            }
        } else msg += `🚗 Avtomobillar: ❌ Yo'q\n`;
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    }
    const kb = [];
    const nav = [];
    if (page > 0) nav.push({ text: "◀️ Oldingi", callback_data: `users_page_${page - 1}` });
    if (page + 1 < totalPages) nav.push({ text: "Keyingi ▶️", callback_data: `users_page_${page + 1}` });
    if (nav.length > 0) kb.push(nav);
    kb.push([{ text: "🔙 Ortga", callback_data: "back_to_main" }]);
    if (messageId) {
        try { await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } }); }
        catch(e) { await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } }); }
    } else {
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } });
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
                userId: u.userId, fullName: u.fullName || "Ismsiz", phone: u.phone,
                cars: u.cars, totalDiagnostics: u.totalDiagnosticsAll || 0,
                isBlocked: u.isBlocked === true, registeredDate: u.registeredDate || "2000-01-01T00:00:00.000Z"
            });
        }
    }
    allUsers.sort((a, b) => new Date(b.registeredDate) - new Date(a.registeredDate));
    const start = page * USERS_MANAGE_PER_PAGE;
    const pageUsers = allUsers.slice(start, start + USERS_MANAGE_PER_PAGE);
    const totalPages = Math.ceil(allUsers.length / USERS_MANAGE_PER_PAGE) || 1;
    if (allUsers.length === 0) {
        const msg = "📭 Avtomobili bo'lgan foydalanuvchilar yo'q!";
        if (messageId) { try { await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" }); } catch(e) { await bot.sendMessage(chatId, msg); } }
        else await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
        return;
    }
    let msg = "👥 *FOYDALANUVCHILARNI BOSHQARISH*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `🚗 Avtomobili bo'lganlar: ${allUsers.length} ta\n📄 Sahifa: ${page + 1}/${totalPages}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    const kb = [];
    for (let i = 0; i < pageUsers.length; i++) {
        const u = pageUsers[i], num = start + i + 1;
        const status = u.isBlocked ? "🔴" : "🟢";
        let mainCar = "";
        let allCarsStr = "";
        for (let j = 0; j < u.cars.length; j++) {
            if (j === 0) mainCar = u.cars[j].carNumber;
            allCarsStr += `${j+1}.${u.cars[j].carNumber} `;
        }
        msg += `${status} *${num}. ${mainCar}*\n👤 ${u.fullName}\n📞 ${u.phone}\n🚗 ${allCarsStr}\n📊 ${u.totalDiagnostics} ta\n📅 ${formatDateSimple(u.registeredDate)}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        kb.push([{ text: `${status} ${mainCar} (${(u.fullName || "").substring(0, 12)})`, callback_data: `manage_user_cars_${u.userId}` }]);
    }
    const nav = [];
    if (page > 0) nav.push({ text: "◀️ Oldingi", callback_data: "users_manage_page_prev" });
    if (page + 1 < totalPages) nav.push({ text: "Keyingi ▶️", callback_data: "users_manage_page_next" });
    if (nav.length > 0) kb.push(nav);
    kb.push([{ text: "🔙 Ortga", callback_data: "back_to_main" }]);
    if (messageId) {
        try { await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } }); }
        catch(e) { await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } }); }
    } else {
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } });
    }
}

async function showUserCars(chatId, userId, messageId = null) {
    const targetUser = getUserByUserId(userId);
    if (!targetUser) { await bot.sendMessage(chatId, "❌ Foydalanuvchi topilmadi!", { parse_mode: "Markdown" }); return; }
    if (!targetUser.cars || targetUser.cars.length === 0) {
        await bot.sendMessage(chatId, `📭 ${targetUser.fullName || "Foydalanuvchi"} da avtomobillar yo'q!`, { parse_mode: "Markdown" });
        return;
    }
    let msg = `👤 *FOYDALANUVCHI MA'LUMOTLARI*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👤 *Ism:* ${targetUser.fullName || "Ismsiz"}\n📞 *Telefon:* ${targetUser.phone}\n`;
    msg += `🚦 *Holat:* ${targetUser.isBlocked ? "🔴 Bloklangan" : "🟢 Faol"}\n`;
    msg += `📊 *Jami diagnostika:* ${targetUser.totalDiagnosticsAll || 0} ta\n`;
    msg += `🎁 *Jami bonus:* ${targetUser.totalBonusCount || 0} ta\n🎉 *Jami bepul:* ${targetUser.totalFreeDiagnostics || 0} ta\n`;
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🚗 *AVTOMOBILLAR RO'YXATI*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    const kb = [];
    for (let i = 0; i < targetUser.cars.length; i++) {
        const car = targetUser.cars[i], num = i + 1;
        const carDiags = diagnostics.filter(d => d.carNumber === car.carNumber && d.phoneNumber === targetUser.phone);
        const diagTotal = carDiags.reduce((s, d) => s + (d.diagnosticPrice || 0) + (d.laborPrice || 0), 0);
        msg += `${num}. 🚗 *${car.carNumber}*\n   📊 Diagnostika: ${car.totalDiagnostics || 0} ta\n`;
        msg += `   🎁 Bonus: ${car.bonusCount}/5\n   🎉 Bepul: ${car.freeDiagnostics} ta\n`;
        msg += `   💰 Jami summa: ${diagTotal.toLocaleString()} so'm\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        kb.push([{ text: `🗑️ ${num}. ${car.carNumber} (${carDiags.length} diag)`, callback_data: `delete_car_from_user_${targetUser.userId}|${car.carNumber}` }]);
    }
    kb.push([{ text: "🔙 Foydalanuvchilar ro'yxati", callback_data: "back_to_users_manage" }]);
    kb.push([{ text: "🔙 Asosiy menyu", callback_data: "back_to_main" }]);
    if (messageId) {
        try { await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } }); }
        catch(e) { await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } }); }
    } else {
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } });
    }
}

async function confirmDeleteCar(chatId, userId, carNumber, messageId) {
    const targetUser = getUserByUserId(userId);
    if (!targetUser) return;
    const car = targetUser.cars.find(c => c.carNumber === carNumber);
    if (!car) return;
    const carDiags = diagnostics.filter(d => d.carNumber === carNumber && d.phoneNumber === targetUser.phone);
    const diagTotal = carDiags.reduce((s, d) => s + (d.diagnosticPrice || 0) + (d.laborPrice || 0), 0);
    let msg = `⚠️ *DIQQAT! AVTOMOBIL O'CHIRILMOQDA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `🚗 *Avtomobil:* ${carNumber}\n👤 *Foydalanuvchi:* ${targetUser.fullName || targetUser.phone}\n\n`;
    msg += `📊 *O'chiriladigan ma'lumotlar:*\n   • Diagnostikalar: ${carDiags.length} ta\n`;
    msg += `   • Jami summa: ${diagTotal.toLocaleString()} so'm\n   • Bonuslar: ${car.bonusCount}/5\n   • Bepul xizmatlar: ${car.freeDiagnostics} ta\n\n`;
    msg += "⚠️ *BU AMALNI QAYTARIB BO'LMAYDI!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nHaqiqatan ham o'chirmoqchimisiz?";
    const kb = { inline_keyboard: [
        [{ text: "✅ HA, O'CHIRISH", callback_data: `confirm_delete_car_${userId}|${carNumber}` }],
        [{ text: "❌ BEKOR QILISH", callback_data: `cancel_delete_car_${userId}` }]
    ] };
    if (messageId) {
        try { await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: kb }); }
        catch(e) { await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: kb }); }
    } else {
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: kb });
    }
}

// -------------------- SESSIONS --------------------
const userSessions = new Map();
function getUserSession(id) {
    if(!userSessions.has(id)) userSessions.set(id,{step:null,data:{}});
    return userSessions.get(id);
}
function clearUserSession(id) { userSessions.delete(id); }

// -------------------- BOT YARATISH --------------------
const bot = new TelegramBot(BOT_TOKEN, {
    polling: { interval: 1000, autoStart: true, params: { timeout: 10 } },
    request: { timeout: 30000 }
});

bot.deleteWebHook().catch(e => console.log('Webhook:', security.sanitizeLog(e.message)));
bot.on('polling_error', (error) => {
    console.log('⚠️ Polling xatosi:', error.code, security.sanitizeLog(error.message));
});

// ======================== XAVFSIZLIK MIDDLEWARE ========================
async function securityCheck(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text || msg.caption || "";
    const flood = security.checkFlood(userId);
    if (flood.blocked) {
        const waitSec = Math.ceil(flood.remainingMs / 1000);
        await bot.sendMessage(chatId, `⚠️ *Juda ko'p xabar yubordingiz!*\n\n${waitSec} soniya kuting.`, { parse_mode: "Markdown" });
        return false;
    }
    const rate = security.checkRateLimit(userId, "message", 30, 60000);
    if (!rate.allowed) {
        await bot.sendMessage(chatId, `⚠️ *So'rovlar limiti oshdi!*\n\n1 daqiqadan keyin urinib ko'ring.`, { parse_mode: "Markdown" });
        return false;
    }
    if (!isAdmin(userId)) {
        const tc = security.isSuspiciousMessage(text);
        if (tc.suspicious) {
            addSecurityLog("SPAM_BLOCKED", userId, `Sabab: ${tc.reason}`);
            for (const aid of ADMIN_IDS) {
                bot.sendMessage(aid, `🚨 *SPAM ANIQLANDI!*\n\n👤 ${msg.from.first_name || 'Noma\'lum'}\n🆔 ${userId}\n📝 ${tc.reason}\n💬 ${security.sanitizeLog(text).substring(0,200)}`, { parse_mode: "Markdown" }).catch(() => {});
            }
            await bot.sendMessage(chatId, `🚫 *Xabaringiz rad etildi!*\n\nShubhali kontent aniqlandi.\nIltimos, faqat Isuzu Doctor xizmatiga oid savollarni yuboring.`, { parse_mode: "Markdown" });
            return false;
        }
        const fc = security.isSuspiciousFile(msg);
        if (fc.suspicious) {
            addSecurityLog("MALICIOUS_FILE_BLOCKED", userId, `Sabab: ${fc.reason}`);
            await bot.sendMessage(chatId, `🚫 *Fayl rad etildi!*\n\n${fc.reason}\n\nXavfsizlik uchun faqat rasm/video yuborishingiz mumkin.`, { parse_mode: "Markdown" });
            return false;
        }
    }
    if (msg.text) msg.text = security.sanitizeInput(msg.text);
    return true;
}

// -------------------- BACKUP --------------------
function createBackup() {
    const timestamp = getCurrentTashkentTime().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const files = [
        [USERS_FILE, `users_backup_${timestamp}.json`],
        [DIAGNOSTICS_FILE, `diagnostics_backup_${timestamp}.json`],
        [CONVERSATIONS_FILE, `conversations_backup_${timestamp}.json`],
        [DELETED_CARS_FILE, `deleted_cars_backup_${timestamp}.json`],
        [DELETED_DIAGNOSTICS_FILE, `deleted_diagnostics_backup_${timestamp}.json`],
        [VIDEOS_FILE, `videos_backup_${timestamp}.json`]
    ];
    for (const [src, dst] of files) {
        try { if (fs.existsSync(safePath(src))) fs.copyFileSync(safePath(src), safePath(path.join(BACKUP_DIR, dst))); } catch(e) {}
    }
    console.log("✅ Backup yaratildi");
}

// -------------------- /start --------------------
bot.onText(/\/start/, async (msg) => {
    try {
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
            const carsCount = (existingUser.cars || []).length;
            const wt = `👋 *Xush kelibsiz, ${existingUser.fullName || firstName || "hurmatli mijoz"}!*\n\n📞 Telefon: ${existingUser.phone}\n🚗 Avtomobillar: ${carsCount} ta\n🎁 Bonus: ${existingUser.totalBonusCount || 0}\n🎉 Bepul: ${existingUser.totalFreeDiagnostics || 0} ta\n📊 Diagnostika: ${existingUser.totalDiagnosticsAll || 0} ta\n📌 Bot versiyasi: V${currentVersion}`;
            await bot.sendMessage(chatId, wt, { parse_mode: "Markdown" });
            await sendMainMenu(chatId, isAdmin(userId), userId);
        } else {
            const session = getUserSession(userId);
            session.data = { firstName, lastName, username };
            await bot.sendMessage(chatId, "🚗 *ISUZU DOCTOR* tizimiga xush kelibsiz! (Versiya V" + currentVersion + ")\n\n© " + BOT_OWNER + "\n\n📱 Iltimos, telefon raqamingizni yuboring:", { parse_mode: "Markdown", ...getPhoneKeyboard() });
        }
    } catch(e) { console.error('start:', security.sanitizeLog(e.message)); }
});

// -------------------- CONTACT --------------------
bot.on("contact", async (msg) => {
    try {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const contact = msg.contact;
        if (!contact) return;
        const firstName = msg.from.first_name || "";
        const lastName = msg.from.last_name || "";
        const username = msg.from.username || "";
        let phoneNumber = contact.phone_number;
        if (!phoneNumber.startsWith("+")) phoneNumber = "+" + phoneNumber;
        const session = getUserSession(userId);
        session.data.phone = phoneNumber;
        session.data.firstName = firstName;
        session.data.lastName = lastName;
        session.data.username = username;
        if (phoneNumber === ADMIN_PHONE) {
            let adminUser = getUserByUserId(userId);
            if (!adminUser) {
                users.push({
                    userId, phone: phoneNumber, firstName, lastName, username,
                    fullName: `${firstName} ${lastName}`.trim(),
                    isAdmin: true, isActive: true, isBlocked: false,
                    registeredDate: getCurrentTashkentTime().toISOString(),
                    cars: [], totalBonusCount: 0, totalFreeDiagnostics: 0, totalDiagnosticsAll: 0
                });
                saveUsers();
            }
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
            await bot.sendMessage(chatId, "✅ Telefon tasdiqlandi!\n\n🚗 *Yangi avtomobil raqamini kiriting:*\n\nMasalan: 01A777AA", { parse_mode: "Markdown", ...removeKeyboard() });
        } else {
            session.step = "first_car_number";
            await bot.sendMessage(chatId, "✅ Telefon qabul qilindi!\n\n🚗 *Birinchi avtomobil raqamini kiriting:*\n\nMasalan: 01A777AA", { parse_mode: "Markdown", ...removeKeyboard() });
        }
    } catch(e) { console.error('contact:', security.sanitizeLog(e.message)); }
});

// -------------------- ASOSIY MESSAGE HANDLER --------------------
bot.on("message", async (msg) => {
    try {
        // 🔒 XAVFSIZLIK TEKSHIRUVI
        const passed = await securityCheck(msg);
        if (!passed) return;

        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text || null;
        const video = msg.video;
        const voice = msg.voice;
        const photo = msg.photo;
        const document = msg.document;
        const animation = msg.animation;
        const location = msg.location;
        const session = getUserSession(userId);
        const user = getUserByUserId(userId);
        const isVideoUploadState = session.step === "admin_waiting_video";

        if (!isVideoUploadState && (video || voice || photo || document || animation)) {
            await bot.sendMessage(chatId, "❌ *Faqat matn yoki lokatsiya yuboring!*", { parse_mode: "Markdown" });
            return;
        }

        // Lokatsiya
        if (location) {
            if (session.step === "conversation_mode" || session.data.inConversation) {
                if (isAdmin(userId)) {
                    const targetId = session.data.replyingToUserId;
                    if (targetId) {
                        addAdminReply(userId, targetId, "", "location", { latitude: location.latitude, longitude: location.longitude });
                        await bot.sendMessage(chatId, "✅ *Lokatsiya yuborildi!*", { parse_mode: "Markdown" });
                        const lat = location.latitude, lng = location.longitude;
                        const lmsg = `📍 *Admin lokatsiya yubordi*\n\n🗺️ [Google Maps](https://www.google.com/maps?q=${lat},${lng})\n🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${lng},${lat}&z=15)\n🗺️ [2GIS](https://2gis.uz/search/${lat},${lng})\n🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15)`;
                        await bot.sendMessage(targetId, lmsg, { parse_mode: "Markdown", disable_web_page_preview: true });
                        await showConversation(chatId, userId, true, targetId);
                    }
                } else {
                    addMessage(userId, ADMIN_IDS[0], "", "location", { latitude: location.latitude, longitude: location.longitude });
                    await bot.sendMessage(chatId, "✅ *Lokatsiya yuborildi! Admin javob beradi.*", { parse_mode: "Markdown" });
                    const uname = user ? (user.fullName || user.phone) : "Foydalanuvchi";
                    const lat = location.latitude, lng = location.longitude;
                    const lmsg = `📍 *Yangi lokatsiya*\n👤 ${uname}\n🆔 ${userId}\n\n🗺️ [Google Maps](https://www.google.com/maps?q=${lat},${lng})\n🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${lng},${lat}&z=15)\n🗺️ [2GIS](https://2gis.uz/search/${lat},${lng})\n🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15)\n\n💬 Javob berish uchun "💬 Muloqotlar" tugmasini bosing!`;
                    for (const aid of ADMIN_IDS) await bot.sendMessage(aid, lmsg, { parse_mode: "Markdown", disable_web_page_preview: true });
                    session.step = "conversation_mode";
                    session.data.inConversation = true;
                }
            } else if (!isAdmin(userId) && user && !user.isBlocked) {
                addMessage(userId, ADMIN_IDS[0], "", "location", { latitude: location.latitude, longitude: location.longitude });
                await bot.sendMessage(chatId, "✅ *Lokatsiya yuborildi! Admin javob beradi.*", { parse_mode: "Markdown" });
                const uname = user ? (user.fullName || user.phone) : "Foydalanuvchi";
                const lat = location.latitude, lng = location.longitude;
                const lmsg = `📍 *Yangi lokatsiya*\n👤 ${uname}\n🆔 ${userId}\n\n🗺️ [Google Maps](https://www.google.com/maps?q=${lat},${lng})\n🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${lng},${lat}&z=15)\n🗺️ [2GIS](https://2gis.uz/search/${lat},${lng})\n🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15)\n\n💬 Javob berish uchun "💬 Muloqotlar" tugmasini bosing!`;
                for (const aid of ADMIN_IDS) await bot.sendMessage(aid, lmsg, { parse_mode: "Markdown", disable_web_page_preview: true });
                session.step = "conversation_mode";
                session.data.inConversation = true;
            }
            return;
        }

        // Bekor qilish
        if (text === "🔙 Bekor qilish" || text === "🔙 Asosiy menyu" || text === "🔙 Muloqotlar ro'yxati") {
            clearUserSession(userId);
            await sendMainMenu(chatId, isAdmin(userId), userId);
            return;
        }

        // Birinchi avtomobil
        if (session.step === "first_car_number") {
            if (!text) { await bot.sendMessage(chatId, "❌ Matn kiriting!", { parse_mode: "Markdown" }); return; }
            const carNumber = text.toUpperCase().trim();
            if (carNumber.length < 2 || carNumber.length > 10) {
                await bot.sendMessage(chatId, "❌ *Noto'g'ri raqam!* 2-10 belgi kiriting:", { parse_mode: "Markdown" });
                return;
            }
            addNewUser(userId, session.data.phone, carNumber, session.data.firstName || "", session.data.lastName || "", session.data.username || "");
            await bot.sendMessage(chatId, `✅ *Ro'yxatdan o'tdingiz!*\n\n🚗 ${carNumber}\n📞 ${session.data.phone}\n🎁 Har 5 diagnostikada 1 BEPUL!\n📌 Versiya: V${currentVersion}`, { parse_mode: "Markdown" });
            for (const adminId of ADMIN_IDS) {
                bot.sendMessage(adminId, `🆕 *YANGI FOYDALANUVCHI!*\n\n👤 ${session.data.firstName || ""} ${session.data.lastName || ""}\n📞 ${session.data.phone}\n🚗 ${carNumber}\n🆔 ID: ${userId}`, { parse_mode: "Markdown" }).catch(() => {});
            }
            clearUserSession(userId);
            await sendMainMenu(chatId, false, userId);
            return;
        }

        // Yangi avtomobil
        if (session.step === "add_new_car") {
            if (!text) { await bot.sendMessage(chatId, "❌ Matn kiriting!", { parse_mode: "Markdown" }); return; }
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
            await bot.sendMessage(chatId, "❌ *Ro'yxatdan o'tmagansiz!* /start bosing.", { parse_mode: "Markdown" });
            return;
        }
        if (user.isBlocked) {
            await bot.sendMessage(chatId, "🚫 *Siz bloklangansiz!*", { parse_mode: "Markdown" });
            return;
        }

        // VIDEO YUKLASH
        if (session.step === "admin_waiting_video") {
            if (!isAdmin(userId)) return;
            if (text === "/cancel" || text === "❌ Asosiy menyu") {
                clearUserSession(userId);
                await bot.sendMessage(chatId, "❌ Bekor qilindi", { parse_mode: "Markdown" });
                await sendMainMenu(chatId, true, userId);
                return;
            }
            const videoFile = msg.video || msg.document || msg.animation;
            if (videoFile) {
                session.data.videoFileId = videoFile.file_id;
                session.data.videoType = msg.video ? "video" : (msg.document ? "document" : "animation");
                session.step = "admin_waiting_video_title";
                await bot.sendMessage(chatId, "✅ *Video/fayl qabul qilindi!*\n\n📝 Video nomini kiriting:", { parse_mode: "Markdown", ...removeKeyboard() });
            } else if (text) {
                await bot.sendMessage(chatId, "❌ *Video yoki fayl yuboring!* /cancel - bekor qilish.", { parse_mode: "Markdown" });
            } else {
                await bot.sendMessage(chatId, "❌ *Video yoki fayl yuboring!*", { parse_mode: "Markdown" });
            }
            return;
        }

        if (session.step === "admin_waiting_video_title") {
            if (!isAdmin(userId)) return;
            if (text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
            if (!text || text.length < 3) { await bot.sendMessage(chatId, "❌ Kamida 3 harf kiriting"); return; }
            session.data.title = text;
            session.step = "admin_waiting_video_description";
            await bot.sendMessage(chatId, "✅ Nom qabul qilindi!\n\n📝 Tavsif (ixtiyoriy, yo'q bo'lsa '-' yuboring):", { parse_mode: "Markdown" });
            return;
        }

        if (session.step === "admin_waiting_video_description") {
            if (!isAdmin(userId)) return;
            if (text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor qilindi"); await sendMainMenu(chatId, true, userId); return; }
            const finalDesc = (text && text !== "yoq" && text !== "yo'q" && text !== "-") ? text : "";
            const ok = addVideo(session.data.videoFileId, session.data.title, finalDesc, userId, session.data.videoType || "video");
            if (ok) {
                await bot.sendMessage(chatId, `✅ *Video yuklandi!*\n\n📹 ${session.data.title}\n📝 ${finalDesc || "yo'q"}`, { parse_mode: "Markdown" });
            } else {
                await bot.sendMessage(chatId, "❌ Video saqlanmadi! Ma'lumotlar noto'g'ri.", { parse_mode: "Markdown" });
            }
            clearUserSession(userId);
            await sendMainMenu(chatId, true, userId);
            return;
        }

        // Admin xabar yuborish
        if (session.step === "admin_send_message") {
            if (!isAdmin(userId)) return;
            if (text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor"); await sendMainMenu(chatId, true, userId); return; }
            if (!text) { await bot.sendMessage(chatId, "❌ Matn kiriting!"); return; }
            await bot.sendMessage(chatId, "📢 Xabar yuborilmoqda...", { parse_mode: "Markdown" });
            const res = await sendNotificationToAllUsers(text);
            await bot.sendMessage(chatId, `✅ Yuborildi: ${res.success} ta\n❌ Yuborilmadi: ${res.fail} ta`, { parse_mode: "Markdown" });
            clearUserSession(userId);
            await sendMainMenu(chatId, true, userId);
            return;
        }

        // Versiya yangilash
        if (session.step === "admin_update_version") {
            if (!isAdmin(userId)) return;
            if (text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor"); await sendMainMenu(chatId, true, userId); return; }
            if (!text || !/^\d+\.\d+$/.test(text)) { await bot.sendMessage(chatId, "❌ Format: 2.2", { parse_mode: "Markdown" }); return; }
            session.data.newVersion = text;
            session.step = "admin_version_changes";
            await bot.sendMessage(chatId, "📝 O'zgarishlar tavsifi:", { parse_mode: "Markdown" });
            return;
        }

        if (session.step === "admin_version_changes") {
            if (!isAdmin(userId)) return;
            if (text === "/cancel") { clearUserSession(userId); await bot.sendMessage(chatId, "❌ Bekor"); await sendMainMenu(chatId, true, userId); return; }
            currentVersion = session.data.newVersion;
            await bot.sendMessage(chatId, `✅ Versiya: V${currentVersion}`, { parse_mode: "Markdown" });
            clearUserSession(userId);
            await sendMainMenu(chatId, true, userId);
            return;
        }

        // Xaritadan lokatsiya
        if (isAdmin(userId) && text === "🗺️ Xaritadan lokatsiya tanlash") {
            if (session.step === "conversation_mode") {
                await bot.sendMessage(chatId, "🗺️ *Xaritadan lokatsiya*\n\nGoogle Maps linki yoki koordinata kiriting:\nhttps://www.google.com/maps?q=40.7128,-74.0060\nYoki: 40.7128, -74.0060", { parse_mode: "Markdown" });
                session.step = "admin_waiting_map_location";
                return;
            }
        }

        if (session.step === "admin_waiting_map_location") {
            if (!isAdmin(userId)) return;
            if (text === "/cancel") { clearUserSession(userId); await showConversation(chatId, userId, true, session.data.replyingToUserId); return; }
            const loc = parseMapUrl(text);
            if (!loc) { await bot.sendMessage(chatId, "❌ Noto'g'ri format!", { parse_mode: "Markdown" }); return; }
            const targetId = session.data.replyingToUserId;
            if (targetId) {
                addAdminReply(userId, targetId, "", "location", { latitude: loc.lat, longitude: loc.lng });
                await bot.sendMessage(chatId, `✅ Lokatsiya yuborildi! ${loc.lat}, ${loc.lng}`, { parse_mode: "Markdown" });
                const lmsg = `📍 *Admin lokatsiya yubordi*\n\n🗺️ [Google Maps](https://www.google.com/maps?q=${loc.lat},${loc.lng})\n🗺️ [Yandex Maps](https://yandex.uz/maps/?ll=${loc.lng},${loc.lat}&z=15)\n🗺️ [2GIS](https://2gis.uz/search/${loc.lat},${loc.lng})\n🗺️ [OpenStreetMap](https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}&zoom=15)`;
                await bot.sendMessage(targetId, lmsg, { parse_mode: "Markdown", disable_web_page_preview: true });
                await showConversation(chatId, userId, true, targetId);
                clearUserSession(userId);
            }
            return;
        }

        // Muloqotni o'chirish
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

        // Muloqot rejimi
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

        // Diagnostika qo'shish
        if (session.step === "admin_add_diagnostic") {
            if (!isAdmin(userId)) return;
            if (!text) { await bot.sendMessage(chatId, "❌ Avto raqamini kiriting!"); return; }
            const car = text.toUpperCase().trim();
            let foundUser = null, foundCar = null;
            for (const u of users) {
                const c = u.cars.find(c => c.carNumber === car);
                if (c) { foundUser = u; foundCar = c; break; }
            }
            if (!foundUser) { await bot.sendMessage(chatId, "❌ Avto topilmadi!", { parse_mode: "Markdown" }); return; }
            session.data.targetUser = foundUser;
            session.data.targetCar = foundCar;
            session.step = "admin_work_description";
            await bot.sendMessage(chatId, `✅ ${foundUser.fullName}\n🚗 ${foundCar.carNumber}\n🔧 Ish tavsifi:`, { parse_mode: "Markdown" });
            return;
        }
        if (session.step === "admin_work_description") {
            if (!isAdmin(userId)) return;
            if (!text) { await bot.sendMessage(chatId, "❌ Ish tavsifini kiriting!"); return; }
            session.data.workDescription = text;
            session.step = "admin_extra_work_question";
            await bot.sendMessage(chatId, "➕ Qo'shimcha ish? (ha/yo'q)", { parse_mode: "Markdown" });
            return;
        }
        if (session.step === "admin_extra_work_question") {
            if (!isAdmin(userId)) return;
            if (!text) return;
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
            if (!text) return;
            const price = parseInt(text);
            if (isNaN(price)) { await bot.sendMessage(chatId, "❌ Son kiriting!", { parse_mode: "Markdown" }); return; }
            session.data.extraWorkPrice = price;
            session.step = "admin_extra_work_description";
            await bot.sendMessage(chatId, "📝 Ish tavsifi:", { parse_mode: "Markdown" });
            return;
        }
        if (session.step === "admin_extra_work_description") {
            if (!isAdmin(userId)) return;
            if (!text) return;
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

        // ADMIN MENYU
        if (isAdmin(userId)) {
            if (text === "📊 Statistika") {
                const s = getStatistics();
                let msg = "📊 *STATISTIKA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
                msg += `👥 Foydalanuvchilar: ${s.totalUsers}\n🚫 Bloklangan: ${s.blockedUsers}\n`;
                msg += `🚗 Avtomobillar: ${s.totalCars}\n🔧 Diagnostikalar: ${s.totalDiagnostics}\n`;
                msg += `💰 Diagnostika: ${s.diagnosticIncome.toLocaleString()} so'm\n🔨 Mehnat: ${s.laborIncome.toLocaleString()} so'm\n`;
                msg += `💵 Jami daromad: ${s.totalIncome.toLocaleString()} so'm\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                msg += `🗑️ O'chirilgan avtomobillar: ${s.deletedCarsCount}\n🗑️ O'chirilgan diagnostikalar: ${s.deletedDiagnosticsCount}\n`;
                msg += `🗑️ O'chirilgan summa: ${s.deletedTotalAmount.toLocaleString()} so'm\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                msg += `📹 Videolar: ${s.totalVideos}\n💬 O'qilmagan: ${s.unreadMessages}\n📌 Versiya: V${s.currentVersion}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
                await sendMainMenu(chatId, true, userId);
            }
            else if (text === "👥 Foydalanuvchilar") { usersListPage = 0; await showUsersList(chatId, usersListPage); }
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
                const kb = { inline_keyboard: [
                    [{ text: "📄 Fayl sifatida yuklab olish", callback_data: "download_diagnostics_history" }],
                    [{ text: "📝 Matn sifatida ko'rish", callback_data: "view_diagnostics_text" }],
                    [{ text: "🔙 Ortga", callback_data: "back_to_main" }]
                ] };
                await bot.sendMessage(chatId, "📋 *DIAGNOSTIKA TARIXI*\n\nQanday ko'rinishda olishni tanlang:", { parse_mode: "Markdown", reply_markup: kb });
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
                    const filepath = safePath(path.join(REPORTS_DIR, `hisobot_${timestamp}.txt`));
                    const plain = report.replace(/\*/g, '').replace(/━/g, '-');
                    fs.writeFileSync(filepath, plain, "utf8");
                    await bot.sendMessage(chatId, report, { parse_mode: "Markdown" });
                    await bot.sendDocument(chatId, filepath, { caption: `📊 *HISOBOT*\n📅 ${formatTashkentDateTime(new Date())}\n📌 V${currentVersion}`, parse_mode: "Markdown" });
                    setTimeout(() => { try { if (fs.existsSync(filepath)) fs.unlinkSync(filepath); } catch(e) {} }, 60000);
                } catch (e) { await bot.sendMessage(chatId, "❌ Xatolik!", { parse_mode: "Markdown" }); }
                await sendMainMenu(chatId, true, userId);
                return;
            }
            else if (text === "📹 Video galereya") { await showVideoGallery(chatId); await sendMainMenu(chatId, true, userId); }
            else if (text === "📤 Video yuklash") {
                const s = getUserSession(userId);
                s.step = "admin_waiting_video";
                s.data = {};
                await bot.sendMessage(chatId,
                    "📤 *VIDEO YUKLASH*\n\n━━━━━━━━━━━━━━━━━━\n📹 Video faylni yuboring\n📄 Yoki document sifatida yuboring\n🎞️ Yoki GIF/animation yuboring\n\n❌ Bekor qilish uchun /cancel yuboring",
                    { parse_mode: "Markdown", ...removeKeyboard() }
                );
            }
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
                await bot.sendMessage(chatId, "🧹 *Tozalanmoqda...*", { parse_mode: "Markdown" });
                const dc = cleanAllInvalidUsers();
                if (dc > 0) await bot.sendMessage(chatId, `✅ *${dc} ta yaroqsiz o'chirildi!*\n\n📊 Jami: ${users.length}`, { parse_mode: "Markdown" });
                else await bot.sendMessage(chatId, "✅ *Yaroqsiz topilmadi!*", { parse_mode: "Markdown" });
                usersListPage = 0; userManagePage = 0;
                await sendMainMenu(chatId, true, userId);
                return;
            }
            else if (text && (text === "💬 Muloqotlar" || text.includes("💬 Muloqotlar"))) { await showAllConversations(chatId, 0); return; }
            else if (text === "❌ Asosiy menyu") { clearUserSession(userId); userManagePage = 0; usersListPage = 0; await sendMainMenu(chatId, true, userId); }
            return;
        }

        // FOYDALANUVCHI TUGMALARI (matn)
        if (text === "🏠 Asosiy menyu") { await sendMainMenu(chatId, false, userId); return; }

    } catch (e) {
        console.error('Message handler xatosi:', security.sanitizeLog(e.message));
    }
});

// -------------------- CALLBACK QUERY HANDLER --------------------
bot.on('callback_query', async (query) => {
    try {
        const msg = query.message;
        const chatId = msg.chat.id;
        const userId = query.from.id;
        const data = query.data;
        const messageId = msg.message_id;

        await bot.answerCallbackQuery(query.id).catch(() => {});

        if (!isAdmin(userId)) {
            const rate = security.checkRateLimit(userId, 'callback', 30, 60000);
            if (!rate.allowed) return;
        }

        const user = getUserByUserId(userId);

        // Foydalanuvchi callbacklari
        if (data === "user_profile" && user) {
            const carList = user.cars.map((c, i) => `${i+1}. ${c.carNumber} - 🎁${c.bonusCount}/5 - 🎉${c.freeDiagnostics}`).join('\n');
            let m = `📊 *PROFIL*\n━━━━━━━━━━━━━━━━━━\n👤 ${user.fullName || "Ismsiz"}\n📞 ${user.phone}\n🚦 ${user.isBlocked ? "🔴 Bloklangan" : "🟢 Faol"}\n`;
            m += `🎁 Jami bonus: ${user.totalBonusCount || 0}\n🎉 Bepul: ${user.totalFreeDiagnostics || 0}\n📊 Diagnostika: ${user.totalDiagnosticsAll || 0}\n`;
            m += `📅 Ro'yxat: ${formatDateSimple(user.registeredDate)}\n━━━━━━━━━━━━━━━━━━\n🚗 *Avtomobillar:*\n${carList || "Yo'q"}`;
            await bot.editMessageText(m, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: getCompactInlineKeyboard(userId).reply_markup });
        }
        else if (data === "user_my_cars" && user) {
            if (!user.cars || user.cars.length === 0) {
                await bot.editMessageText("🚗 *Avtomobillar yo'q*\n\n➕ tugmasi orqali qo'shing.", { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: getCompactInlineKeyboard(userId).reply_markup });
                return;
            }
            let m = "🚗 *MENING AVTOMOBILLARIM*\n━━━━━━━━━━━━━━━━━━\n";
            user.cars.forEach((c, i) => {
                const info = getBonusInfo(c);
                m += `\n${i+1}. *${c.carNumber}*\n   🎁 Bonus: ${info.bonusCount}/5\n   🎉 Bepul: ${info.freeDiagnostics}\n   📊 Diagnostika: ${info.totalDiagnostics}\n   ✨ Yana ${info.remainingToFree} ta → 1 BEPUL\n━━━━━━━━━━━━━━━━━━\n`;
            });
            await bot.editMessageText(m, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: getCompactInlineKeyboard(userId).reply_markup });
        }
        else if (data === "user_my_bonus" && user) {
            if (!user.cars || user.cars.length === 0) {
                await bot.editMessageText("🎁 *Bonuslar yo'q*", { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: getCompactInlineKeyboard(userId).reply_markup });
                return;
            }
            let m = "🎁 *BONUSLAR*\n━━━━━━━━━━━━━━━━━━\n";
            user.cars.forEach((c, i) => {
                const info = getBonusInfo(c);
                m += `\n${i+1}. *${c.carNumber}*\n   🎁 ${info.bonusCount}/5\n   🎉 Bepul: ${info.freeDiagnostics}\n   ✨ ${info.remainingToFree} ta qoldi\n━━━━━━━━━━━━━━━━━━\n`;
            });
            m += "\n📌 *QOIDA:* Har 5 diagnostikada 1 BEPUL!";
            await bot.editMessageText(m, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: getCompactInlineKeyboard(userId).reply_markup });
        }
        else if (data === "user_add_car" && user) {
            if (user.cars.length >= MAX_CARS_PER_USER) {
                await bot.editMessageText(`❌ *Maksimum ${MAX_CARS_PER_USER} ta avtomobil!*`, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: getCompactInlineKeyboard(userId).reply_markup });
                return;
            }
            const s = getUserSession(userId);
            s.step = "add_new_car";
            s.data.phone = user.phone;
            await bot.sendMessage(chatId, "🚗 *Yangi avtomobil raqamini kiriting:*\n\nMasalan: 01A777AA", { parse_mode: "Markdown", ...removeKeyboard() });
        }
        else if (data === "user_history" && user) {
            const diags = diagnostics.filter(d => d.phoneNumber === user.phone).slice(-20).reverse();
            if (diags.length === 0) {
                await bot.editMessageText("📋 *Tarix bo'sh*", { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: getCompactInlineKeyboard(userId).reply_markup });
                return;
            }
            let m = "📋 *DIAGNOSTIKA TARIXI*\n━━━━━━━━━━━━━━━━━━\n";
            diags.forEach((d, i) => {
                m += `\n${i+1}. *${d.carNumber}*\n📅 ${formatDateSimple(d.date)} ${formatTimeSimple(d.date)}\n`;
                m += `📝 ${d.workDescription.substring(0, 80)}\n`;
                m += d.isFree ? `🎉 BEPUL\n` : `💰 ${(d.diagnosticPrice + d.laborPrice).toLocaleString()} so'm\n`;
                m += "━━━━━━━━━━━━━━━━━━\n";
            });
            await bot.editMessageText(m, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: getCompactInlineKeyboard(userId).reply_markup });
        }
        else if (data === "user_video_gallery") { await showVideoGallery(chatId); }
        else if (data === "user_payment") {
            await bot.editMessageText(getCardInfoMessage(), { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: getCompactInlineKeyboard(userId).reply_markup });
        }
        else if (data === "user_instagram") {
            await bot.editMessageText(`📸 *INSTAGRAM*\n\n${INSTAGRAM_LINK}`, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", disable_web_page_preview: true, reply_markup: getCompactInlineKeyboard(userId).reply_markup });
        }
        else if (data === "user_telegram_group") {
            await bot.editMessageText(`👥 *TELEGRAM GURUH*\n\n${TELEGRAM_GROUP_LINK}`, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", disable_web_page_preview: true, reply_markup: getCompactInlineKeyboard(userId).reply_markup });
        }
        else if (data === "user_contact_admin" && user) {
            const s = getUserSession(userId);
            s.step = "conversation_mode";
            s.data.inConversation = true;
            await showConversation(chatId, userId, false);
        }
        else if (data === "user_info") {
            let m = `ℹ️ *MA'LUMOT*\n━━━━━━━━━━━━━━━━━━\n🚗 *Isuzu Doctor*\n📌 Versiya: V${currentVersion}\n\n`;
            m += `🎁 Har 5 diagnostikada 1 BEPUL\n💰 Diagnostika narxi: ${DIAGNOSTIC_PRICE.toLocaleString()} so'm\n\n`;
            m += `👨‍💼 *Egasi:* ${BOT_OWNER}\n📞 ${ADMIN_PHONE}\n`;
            m += "━━━━━━━━━━━━━━━━━━";
            await bot.editMessageText(m, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: getCompactInlineKeyboard(userId).reply_markup });
        }
        else if (data === "user_version_info") {
            await bot.editMessageText(`📌 *VERSIYA*\n\nV${currentVersion}\n\n© ${BOT_OWNER}`, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: getCompactInlineKeyboard(userId).reply_markup });
        }
        else if (data === "back_to_main") {
            await sendMainMenu(chatId, isAdmin(userId), userId);
        }
        // Video callbacklari
        else if (data.startsWith("watch_video_")) {
            const vid = videoList.find(v => v.id === parseInt(data.replace("watch_video_", "")));
            if (!vid) { await bot.answerCallbackQuery(query.id, { text: "Video topilmadi" }); return; }
            vid.views = (vid.views || 0) + 1;
            saveVideos();
            const cap = `📹 *${vid.title}*\n\n${vid.description || ""}\n\n👁️ ${vid.views} | 👍 ${vid.likes || 0}`;
            try {
                if (vid.videoType === "document") await bot.sendDocument(chatId, vid.fileId, { caption: cap, parse_mode: "Markdown" });
                else if (vid.videoType === "animation") await bot.sendAnimation(chatId, vid.fileId, { caption: cap, parse_mode: "Markdown" });
                else await bot.sendVideo(chatId, vid.fileId, { caption: cap, parse_mode: "Markdown" });
            } catch(e) { await bot.sendMessage(chatId, "❌ Video yuklanmadi"); }
        }
        else if (data.startsWith("video_page_")) {
            const page = parseInt(data.replace("video_page_", ""));
            await showVideoGallery(chatId, page);
        }
        else if (data.startsWith("delete_video_")) {
            if (!isAdmin(userId)) return;
            const vidId = parseInt(data.replace("delete_video_", ""));
            deleteVideo(vidId);
            addSecurityLog("VIDEO_DELETED", userId, `Video o'chirildi: ${vidId}`);
            await bot.editMessageText("✅ Video o'chirildi!", { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
            await showVideoManagement(chatId, 0);
        }
        else if (data.startsWith("video_manage_page_")) {
            if (!isAdmin(userId)) return;
            const page = parseInt(data.replace("video_manage_page_", ""));
            await showVideoManagement(chatId, page);
        }
        // Foydalanuvchilar sahifalash
        else if (data.startsWith("users_page_")) {
            if (!isAdmin(userId)) return;
            const page = parseInt(data.replace("users_page_", ""));
            usersListPage = page;
            await showUsersList(chatId, page, messageId);
        }
        else if (data === "users_manage_page_prev") {
            if (!isAdmin(userId)) return;
            userManagePage = Math.max(0, userManagePage - 1);
            await showUsersForManage(chatId, userManagePage, messageId);
        }
        else if (data === "users_manage_page_next") {
            if (!isAdmin(userId)) return;
            userManagePage++;
            await showUsersForManage(chatId, userManagePage, messageId);
        }
        else if (data === "back_to_users_manage") {
            if (!isAdmin(userId)) return;
            await showUsersForManage(chatId, userManagePage);
        }
        else if (data.startsWith("manage_user_cars_")) {
            if (!isAdmin(userId)) return;
            const targetId = parseInt(data.replace("manage_user_cars_", ""));
            await showUserCars(chatId, targetId, messageId);
        }
        else if (data.startsWith("delete_car_from_user_")) {
            if (!isAdmin(userId)) return;
            const parts = data.replace("delete_car_from_user_", "").split("|");
            const targetId = parseInt(parts[0]);
            const carNumber = parts[1];
            await confirmDeleteCar(chatId, targetId, carNumber, messageId);
        }
        else if (data.startsWith("confirm_delete_car_")) {
            if (!isAdmin(userId)) return;
            const parts = data.replace("confirm_delete_car_", "").split("|");
            const targetId = parseInt(parts[0]);
            const carNumber = parts[1];
            await deleteCarWithDiagnostics(chatId, targetId, carNumber, userId);
            await showUserCars(chatId, targetId);
        }
        else if (data.startsWith("cancel_delete_car_")) {
            if (!isAdmin(userId)) return;
            const targetId = parseInt(data.replace("cancel_delete_car_", ""));
            await showUserCars(chatId, targetId, messageId);
        }
        // Diagnostika tarixi
        else if (data === "download_diagnostics_history") {
            if (!isAdmin(userId)) return;
            const filepath = await generateDiagnosticsHistoryFile(chatId);
            if (filepath) {
                await bot.sendDocument(chatId, filepath, { caption: `📋 *DIAGNOSTIKA TARIXI*\n📅 ${formatTashkentDateTime(new Date())}`, parse_mode: "Markdown" });
                setTimeout(() => { try { if (fs.existsSync(filepath)) fs.unlinkSync(filepath); } catch(e) {} }, 60000);
            }
        }
        else if (data === "view_diagnostics_text") {
            if (!isAdmin(userId)) return;
            const diags = getAllDiagnostics(20);
            if (diags.length === 0) { await bot.sendMessage(chatId, "📭 Bo'sh"); return; }
            let m = "📋 *OXIRGI 20 TA DIAGNOSTIKA*\n━━━━━━━━━━━━━━━━━━\n";
            diags.forEach((d, i) => {
                m += `\n${i+1}. 🚗 ${d.carNumber}\n👤 ${d.phoneNumber}\n📅 ${formatTashkentDateTime(d.date)}\n`;
                m += `📝 ${d.workDescription.substring(0, 60)}\n`;
                m += d.isFree ? `🎉 BEPUL\n` : `💰 ${((d.diagnosticPrice || 0) + (d.laborPrice || 0)).toLocaleString()} so'm\n`;
                m += "━━━━━━━━━━━━━━━━━━\n";
            });
            await bot.sendMessage(chatId, m, { parse_mode: "Markdown" });
        }
        // Muloqotlar
        else if (data.startsWith("open_conversation_")) {
            if (!isAdmin(userId)) return;
            const targetId = parseInt(data.replace("open_conversation_", ""));
            const s = getUserSession(userId);
            s.step = "conversation_mode";
            s.data.inConversation = true;
            s.data.replyingToUserId = targetId;
            await showConversation(chatId, userId, true, targetId);
        }
        else if (data.startsWith("delete_conv_")) {
            if (!isAdmin(userId)) return;
            const convId = parseInt(data.replace("delete_conv_", ""));
            const result = deleteConversation(convId, userId);
            await bot.answerCallbackQuery(query.id, { text: result.message });
            await showAllConversations(chatId, 0);
        }
        else if (data.startsWith("conversations_page_")) {
            if (!isAdmin(userId)) return;
            const page = parseInt(data.replace("conversations_page_", ""));
            await showAllConversations(chatId, page);
        }
        else if (data === "security_back") {
            if (!isAdmin(userId)) return;
            await sendMainMenu(chatId, true, userId);
        }
    } catch(e) {
        console.error('Callback xatosi:', security.sanitizeLog(e.message));
    }
});

// -------------------- GLOBAL ERROR HANDLERS --------------------
process.on('uncaughtException', (err) => {
    console.error('❌ uncaughtException:', security.sanitizeLog(err.message));
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ unhandledRejection:', security.sanitizeLog(String(reason)));
});

// -------------------- ISHGA TUSHIRISH --------------------
console.log('🚀 Bot ishga tushirilmoqda...');
console.log('📌 Versiya:', currentVersion);
console.log('🔒 Xavfsizlik: Yoqilgan');
loadData();
loadDeletedData();
loadConversations();
loadVideos();
loadAdminSettings();
console.log('✅ Bot tayyor!');
