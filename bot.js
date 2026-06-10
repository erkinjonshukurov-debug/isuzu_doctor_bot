const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

// ======================== AVTORLIK HUQUQI VA LITSENZIYA ========================
const LICENSE_KEY = "ISUZU_DOCTOR_BOT_V2";
const BOT_OWNER = "Erkinjon Shukurov";
const BOT_OWNER_TELEGRAM = "@Erkinjon_Shukurov";

// ======================== VERSIYA TIZIMI ========================
let currentVersion = "2.3";

function getVersionInfo() {
    return {
        currentVersion: currentVersion,
        newBotLink: NEW_BOT_LINK
    };
}

// ======================== LINKLAR ========================
const NEW_BOT_LINK = "https://t.me/Isuzu_doctor_bot";
const INSTAGRAM_LINK = "https://www.instagram.com/isuzudoctor.979247888/";
const TELEGRAM_GROUP_LINK = "https://t.me/+piY0W4XrGqFkN2Iy";

// -------------------- VAQT ZONASI (TOSHKENT UTC+5) --------------------
function getTashkentTime(date) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const tashkentOffset = 5 * 60 * 60 * 1000;
    const utcTime = dateObj.getTime();
    return new Date(utcTime + tashkentOffset);
}

function formatTashkentDate(date) {
    const tashkentDate = getTashkentTime(date);
    return tashkentDate.toLocaleDateString('uz-UZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTashkentTime(date) {
    const tashkentDate = getTashkentTime(date);
    return tashkentDate.toLocaleTimeString('uz-UZ', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function formatTashkentDateTime(date) {
    return `${formatTashkentDate(date)} ${formatTashkentTime(date)}`;
}

function formatMonthName(year, month) {
    const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    return `${monthNames[month - 1]} ${year}`;
}

// -------------------- TO'LOV MA'LUMOTLARI --------------------
const CARD_NUMBER = "9860040115220143";
const CARD_OWNER = "Erkinjon Shukurov";
const BANK_NAME = "Xalq Bank";

function getCardInfoMessage() {
    return `
🏦 *KARTA MA'LUMOTLARI*

💳 *Karta raqami:* \`${CARD_NUMBER}\`
👤 *Karta egasi:* ${CARD_OWNER}
🏛 *Bank:* ${BANK_NAME}

📌 *To'lov qilish uchun:*
1. Karta raqamini nusxalang
2. O'z bankingiz ilovasida to'lov qiling
3. To'lov chekini saqlang

✅ To'lov amalga oshirilgandan so'ng, administrator bilan bog'lanishingiz mumkin.
    `;
}

// -------------------- XAVFSIZLIK VA ADMIN --------------------
const BOT_TOKEN = process.env.BOT_TOKEN || '8779251766:AAH12INusgBCawsk5awqIjcyHnNLiq5A33A';

const ADMIN_PHONE = "+998979247888";
const ADMIN_IDS = [1437230485];
const SUPER_ADMIN_ID = 1437230485;

let adminSettings = {
    allowedEditors: [],
    lastChanges: [],
    securityLog: []
};

const DIAGNOSTIC_PRICE = 250000;
const MAX_CARS_PER_USER = 20;

// -------------------- RAILWAY VOLUME YO'LLARI --------------------
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const BACKUP_DIR = path.join(VOLUME_PATH, 'backups');
const REPORTS_DIR = path.join(VOLUME_PATH, 'reports');
const VIDEOS_DIR = path.join(VOLUME_PATH, 'videos');

const USERS_FILE = path.join(VOLUME_PATH, 'users.json');
const DIAGNOSTICS_FILE = path.join(VOLUME_PATH, 'diagnostics.json');
const ERRORS_FILE = path.join(VOLUME_PATH, 'errors.json');
const VERSION_FILE = path.join(VOLUME_PATH, 'version.json');
const ADMIN_SETTINGS_FILE = path.join(VOLUME_PATH, 'admin_settings.json');
const VIDEOS_FILE = path.join(VOLUME_PATH, 'videos.json');
const VERSION_HISTORY_FILE = path.join(VOLUME_PATH, 'version_history.json');
const CONVERSATIONS_FILE = path.join(VOLUME_PATH, 'conversations.json');

// ======================== MUHOQOT TIZIMI ========================
let conversations = [];

function loadConversations() {
    try {
        if (fs.existsSync(CONVERSATIONS_FILE)) {
            conversations = JSON.parse(fs.readFileSync(CONVERSATIONS_FILE, "utf8"));
        } else {
            conversations = [];
            saveConversations();
        }
        console.log("✅ Muloqotlar yuklandi: " + conversations.length + " ta");
    } catch (err) {
        console.error("Muloqotlarni yuklashda xatolik:", err);
        conversations = [];
    }
}

function saveConversations() {
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2));
}

function getOrCreateConversation(userId, adminId = ADMIN_IDS[0]) {
    let conversation = conversations.find(c => c.userId === userId);
    if (!conversation) {
        conversation = {
            id: Date.now(),
            userId: userId,
            adminId: adminId,
            messages: [],
            createdAt: new Date().toISOString(),
            isActive: true,
            userUnreadCount: 0,
            adminUnreadCount: 0
        };
        conversations.push(conversation);
        saveConversations();
    }
    return conversation;
}

function addMessage(userId, adminId, message, type = "text", location = null) {
    const conversation = getOrCreateConversation(userId, adminId);
    
    const messageObj = {
        id: Date.now(),
        fromUserId: userId,
        toUserId: adminId,
        message: message,
        type: type,
        location: location,
        timestamp: new Date().toISOString(),
        isRead: false
    };
    
    conversation.messages.push(messageObj);
    
    if (userId === conversation.userId) {
        conversation.adminUnreadCount = (conversation.adminUnreadCount || 0) + 1;
    } else {
        conversation.userUnreadCount = (conversation.userUnreadCount || 0) + 1;
    }
    
    saveConversations();
    return messageObj;
}

function addAdminReply(adminId, userId, message, type = "text", location = null) {
    const conversation = getOrCreateConversation(userId, adminId);
    
    const messageObj = {
        id: Date.now(),
        fromUserId: adminId,
        toUserId: userId,
        message: message,
        type: type,
        location: location,
        timestamp: new Date().toISOString(),
        isRead: false
    };
    
    conversation.messages.push(messageObj);
    conversation.userUnreadCount = (conversation.userUnreadCount || 0) + 1;
    
    saveConversations();
    return messageObj;
}

function markMessagesAsRead(conversationId, userId) {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
        if (userId === conversation.userId) {
            conversation.userUnreadCount = 0;
        } else {
            conversation.adminUnreadCount = 0;
        }
        saveConversations();
        return true;
    }
    return false;
}

function getUserConversation(userId) {
    return conversations.find(c => c.userId === userId);
}

function getUserUnreadCount(userId) {
    const conv = getUserConversation(userId);
    return conv ? conv.userUnreadCount || 0 : 0;
}

function getTotalUnreadForAdmin(adminId) {
    let total = 0;
    conversations.forEach(c => {
        if (c.adminId === adminId) {
            total += c.adminUnreadCount || 0;
        }
    });
    return total;
}

function getAllConversations() {
    return conversations.filter(c => c.isActive).sort((a, b) => {
        const lastMsgA = a.messages[a.messages.length - 1];
        const lastMsgB = b.messages[b.messages.length - 1];
        if (!lastMsgA || !lastMsgB) return 0;
        return new Date(lastMsgB.timestamp) - new Date(lastMsgA.timestamp);
    });
}

// -------------------- VERSIYA TARIXI --------------------
let versionHistory = [];

function loadVersionHistory() {
    try {
        if (fs.existsSync(VERSION_HISTORY_FILE)) {
            versionHistory = JSON.parse(fs.readFileSync(VERSION_HISTORY_FILE, "utf8"));
        } else {
            versionHistory = [];
            saveVersionHistory();
        }
        console.log("✅ Versiya tarixi yuklandi: " + versionHistory.length + " ta yozuv");
    } catch (err) {
        console.error("Versiya tarixini yuklashda xatolik:", err);
        versionHistory = [];
    }
}

function saveVersionHistory() {
    fs.writeFileSync(VERSION_HISTORY_FILE, JSON.stringify(versionHistory, null, 2));
}

function addVersionRecord(version, changes, adminId) {
    const record = {
        id: Date.now(),
        version: version,
        changes: changes,
        adminId: adminId,
        date: new Date().toISOString()
    };
    versionHistory.unshift(record);
    if (versionHistory.length > 50) {
        versionHistory = versionHistory.slice(0, 50);
    }
    saveVersionHistory();
    addSecurityLog("VERSION_RECORD", adminId, `Yangi yozuv: ${changes}`);
    return record;
}

function updateBotVersion(newVersion, changes, adminId) {
    currentVersion = newVersion;
    saveVersion();
    addVersionRecord(newVersion, changes, adminId);
    console.log(`✅ Bot versiyasi yangilandi: V${newVersion}`);
    return true;
}

// -------------------- ESLATMA MATNI --------------------
const REMINDER_MESSAGE = `
🚗 **Hurmatli mijoz!**

Agar avtomobilingiz doimo soz, ishonchli va yo'llarda sizni yarim yo'lda qoldirmasligini istasangiz — unda unga faqat professional va malakali mutaxassislar xizmat ko'rsatishi muhim.

🛠️ **Sifatli xizmat** — bu nafaqat qulaylik, balki sizning xavfsizligingiz kafolatidir.

✅ Shuning uchun avtomobilingizni haqiqiy professionallarga ishonib topshiring!
`;

// -------------------- QURILMA TURINI ANIQLASH --------------------
let userDevices = new Map();

function getDeviceType(userAgent) {
    if (!userAgent) return "web";
    const ua = userAgent.toLowerCase();
    if (ua.includes("android")) return "android";
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "ios";
    return "web";
}

function getUserDevice(userId) {
    return userDevices.get(userId) || "web";
}

function setUserDevice(userId, deviceType) {
    userDevices.set(userId, deviceType);
}

// -------------------- UNIQUE INSTALL ID --------------------
let uniqueInstallId = null;

function generateUniqueInstallId() {
    const systemInfo = [
        os.hostname(),
        os.cpus()[0]?.model || "unknown",
        os.totalmem().toString(),
        os.networkInterfaces()
    ].join("|");
    return crypto.createHash('sha256').update(systemInfo + LICENSE_KEY).digest('hex').substring(0, 16);
}

uniqueInstallId = generateUniqueInstallId();

function checkLicenseIntegrity() {
    try {
        const installFile = path.join(VOLUME_PATH, '.install_id');
        if (fs.existsSync(installFile)) {
            const savedId = fs.readFileSync(installFile, 'utf8');
            if (savedId !== uniqueInstallId) {
                console.error("⚠️ LITSENZIYA BUZILGAN!");
                return false;
            }
        } else {
            fs.writeFileSync(installFile, uniqueInstallId);
        }
        return true;
    } catch (err) {
        return true;
    }
}

function checkBotIntegrity() {
    const expectedChecksum = "ISUZU_DOCTOR_CHECKSUM_V2";
    try {
        const checkFile = path.join(VOLUME_PATH, '.integrity');
        if (fs.existsSync(checkFile)) {
            const saved = fs.readFileSync(checkFile, 'utf8');
            if (saved !== expectedChecksum) {
                console.error("⚠️ BOT INTEGRITY BUZILGAN!");
                return false;
            }
        } else {
            fs.writeFileSync(checkFile, expectedChecksum);
        }
        return true;
    } catch (err) {
        return true;
    }
}

// -------------------- VIDEO GALEREYA --------------------
let videoList = [];

function loadVideos() {
    try {
        if (fs.existsSync(VIDEOS_FILE)) {
            videoList = JSON.parse(fs.readFileSync(VIDEOS_FILE, "utf8"));
        } else {
            videoList = [];
            saveVideos();
        }
        console.log("✅ Videolar yuklandi: " + videoList.length + " ta video");
    } catch (err) {
        console.error("Videolarni yuklashda xatolik:", err);
        videoList = [];
    }
}

function saveVideos() {
    fs.writeFileSync(VIDEOS_FILE, JSON.stringify(videoList, null, 2));
}

function addVideo(videoFileId, title, description, adminId) {
    const newVideo = {
        id: Date.now(),
        fileId: videoFileId,
        title: title.substring(0, 100),
        description: description ? description.substring(0, 500) : "",
        views: 0,
        likes: 0,
        likedBy: [],
        uploadedBy: adminId,
        uploadDate: new Date().toISOString(),
        isActive: true
    };
    videoList.unshift(newVideo);
    saveVideos();
    addSecurityLog("VIDEO_UPLOADED", adminId, "Video yuklandi: " + title);
    return newVideo;
}

function updateVideoViews(videoId) {
    const video = videoList.find(v => v.id === videoId);
    if (video) {
        video.views = (video.views || 0) + 1;
        saveVideos();
        return true;
    }
    return false;
}

function updateVideoLikes(videoId, userId) {
    const video = videoList.find(v => v.id === videoId);
    if (video) {
        if (!video.likedBy) video.likedBy = [];
        if (!video.likedBy.includes(userId)) {
            video.likedBy.push(userId);
            video.likes = (video.likes || 0) + 1;
            saveVideos();
            return true;
        }
    }
    return false;
}

function getActiveVideos() {
    return videoList.filter(v => v.isActive);
}

function deleteVideo(videoId, adminId) {
    const index = videoList.findIndex(v => v.id === videoId);
    if (index === -1) return { success: false, message: "Video topilmadi" };
    videoList.splice(index, 1);
    saveVideos();
    return { success: true, message: "Video o'chirildi" };
}

// -------------------- PAPKALARNI YARATISH --------------------
function ensureVolumeDir() {
    if (!fs.existsSync(VOLUME_PATH)) fs.mkdirSync(VOLUME_PATH, { recursive: true });
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

ensureVolumeDir();

// -------------------- DATABASE --------------------
let users = [];
let diagnostics = [];
let errors = [];

function loadData() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
            users.forEach(u => {
                if (u.isBlocked === undefined) u.isBlocked = false;
                if (!u.cars) u.cars = [];
                if (u.totalDiagnosticsAll === undefined) u.totalDiagnosticsAll = 0;
                if (u.totalBonusCount === undefined) u.totalBonusCount = 0;
                if (u.totalFreeDiagnostics === undefined) u.totalFreeDiagnostics = 0;
            });
        } else {
            users = [];
        }
        
        if (fs.existsSync(DIAGNOSTICS_FILE)) {
            diagnostics = JSON.parse(fs.readFileSync(DIAGNOSTICS_FILE, "utf8"));
        } else {
            diagnostics = [];
        }
        
        if (fs.existsSync(ERRORS_FILE)) {
            errors = JSON.parse(fs.readFileSync(ERRORS_FILE, "utf8"));
        } else {
            errors = [];
        }
        
        console.log("✅ Yuklandi: " + users.length + " foydalanuvchi");
    } catch (err) {
        console.error("Ma'lumot yuklashda xatolik:", err);
        users = [];
        diagnostics = [];
        errors = [];
    }
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function saveDiagnostics() {
    fs.writeFileSync(DIAGNOSTICS_FILE, JSON.stringify(diagnostics, null, 2));
}

function saveErrors() {
    fs.writeFileSync(ERRORS_FILE, JSON.stringify(errors, null, 2));
}

function loadVersion() {
    try {
        if (fs.existsSync(VERSION_FILE)) {
            const data = JSON.parse(fs.readFileSync(VERSION_FILE, "utf8"));
            currentVersion = data.version;
        } else {
            currentVersion = "2.3";
            saveVersion();
        }
    } catch (err) {
        currentVersion = "2.3";
    }
}

function saveVersion() {
    fs.writeFileSync(VERSION_FILE, JSON.stringify({ version: currentVersion, lastUpdate: new Date().toISOString() }, null, 2));
}

// -------------------- BACKUP --------------------
function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    if (fs.existsSync(USERS_FILE)) {
        fs.copyFileSync(USERS_FILE, path.join(BACKUP_DIR, `users_backup_${timestamp}.json`));
    }
    if (fs.existsSync(DIAGNOSTICS_FILE)) {
        fs.copyFileSync(DIAGNOSTICS_FILE, path.join(BACKUP_DIR, `diagnostics_backup_${timestamp}.json`));
    }
    if (fs.existsSync(CONVERSATIONS_FILE)) {
        fs.copyFileSync(CONVERSATIONS_FILE, path.join(BACKUP_DIR, `conversations_backup_${timestamp}.json`));
    }
    console.log("✅ Backup yaratildi");
    return true;
}

function listBackups() {
    return fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("users_backup_"));
}

function restoreBackup(backupName) {
    const backupPath = path.join(BACKUP_DIR, backupName);
    if (fs.existsSync(backupPath)) {
        const data = JSON.parse(fs.readFileSync(backupPath, "utf8"));
        fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
        loadData();
        return true;
    }
    return false;
}

// -------------------- XAVFSIZLIK --------------------
function loadAdminSettings() {
    try {
        if (fs.existsSync(ADMIN_SETTINGS_FILE)) {
            adminSettings = JSON.parse(fs.readFileSync(ADMIN_SETTINGS_FILE, "utf8"));
        }
    } catch (err) {
        adminSettings = { allowedEditors: [], lastChanges: [], securityLog: [] };
    }
}

function saveAdminSettings() {
    fs.writeFileSync(ADMIN_SETTINGS_FILE, JSON.stringify(adminSettings, null, 2));
}

function isSuperAdmin(userId) {
    return userId === SUPER_ADMIN_ID;
}

function canEditCode(userId) {
    return isSuperAdmin(userId) || adminSettings.allowedEditors.includes(userId);
}

function addSecurityLog(action, userId, details) {
    adminSettings.securityLog.unshift({
        id: Date.now(),
        action, userId, details,
        date: new Date().toISOString()
    });
    if (adminSettings.securityLog.length > 100) adminSettings.securityLog = adminSettings.securityLog.slice(0, 100);
    saveAdminSettings();
}

function grantEditPermission(adminId, targetUserId) {
    if (!isSuperAdmin(adminId)) return { success: false, message: "Faqat Super Admin!" };
    if (adminSettings.allowedEditors.includes(targetUserId)) return { success: false, message: "Allaqachon ruxsat bor!" };
    adminSettings.allowedEditors.push(targetUserId);
    saveAdminSettings();
    return { success: true, message: "Ruxsat berildi!" };
}

function revokeEditPermission(adminId, targetUserId) {
    if (!isSuperAdmin(adminId)) return { success: false, message: "Faqat Super Admin!" };
    const index = adminSettings.allowedEditors.indexOf(targetUserId);
    if (index === -1) return { success: false, message: "Ruxsat yo'q!" };
    adminSettings.allowedEditors.splice(index, 1);
    saveAdminSettings();
    return { success: true, message: "Ruxsat olib qo'yildi!" };
}

// -------------------- FOYDALANUVCHI FUNKSIYALARI --------------------
function getUserByPhone(phone) {
    return users.find(u => u.phone === phone);
}

function getUserByUserId(userId) {
    return users.find(u => u.userId === userId);
}

function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

function deleteUser(userId) {
    const index = users.findIndex(u => u.userId === userId);
    if (index === -1) return { success: false, message: "Foydalanuvchi topilmadi" };
    if (users[index].isAdmin) return { success: false, message: "Adminni o'chirib bo'lmaydi" };
    users.splice(index, 1);
    saveUsers();
    return { success: true, message: "Foydalanuvchi o'chirildi" };
}

function blockUser(userId) {
    const user = getUserByUserId(userId);
    if (!user) return { success: false, message: "Foydalanuvchi topilmadi" };
    user.isBlocked = true;
    saveUsers();
    return { success: true, message: "Foydalanuvchi bloklandi" };
}

function unblockUser(userId) {
    const user = getUserByUserId(userId);
    if (!user) return { success: false, message: "Foydalanuvchi topilmadi" };
    user.isBlocked = false;
    saveUsers();
    return { success: true, message: "Foydalanuvchi blokdan ochildi" };
}

function getActiveUsers() {
    return users.filter(u => !u.isAdmin && !u.isBlocked);
}

function getBlockedUsers() {
    return users.filter(u => !u.isAdmin && u.isBlocked);
}

function addNewUser(userId, phoneNumber, carNumber, firstName, lastName, username) {
    const newUser = {
        userId, phone: phoneNumber, firstName, lastName, username,
        fullName: `${firstName} ${lastName}`.trim(),
        isAdmin: false, isActive: true, isBlocked: false,
        registeredDate: new Date().toISOString(),
        cars: [{ carId: Date.now(), carNumber, bonusCount: 0, freeDiagnostics: 0, totalDiagnostics: 0, addedDate: new Date().toISOString(), isActive: true }],
        totalBonusCount: 0, totalFreeDiagnostics: 0, totalDiagnosticsAll: 0
    };
    users.push(newUser);
    saveUsers();
    return newUser;
}

function addCarToUser(phoneNumber, carNumber) {
    const user = getUserByPhone(phoneNumber);
    if (!user) return { success: false, message: "Foydalanuvchi topilmadi" };
    if (user.cars.length >= MAX_CARS_PER_USER) return { success: false, message: "Maksimum avtomobil" };
    if (user.cars.find(c => c.carNumber === carNumber)) return { success: false, message: "Bu avtomobil allaqachon bor" };
    user.cars.push({ carId: Date.now(), carNumber, bonusCount: 0, freeDiagnostics: 0, totalDiagnostics: 0, addedDate: new Date().toISOString(), isActive: true });
    saveUsers();
    return { success: true, message: "Avtomobil qo'shildi" };
}

// -------------------- DIAGNOSTIKA --------------------
function addDiagnosticToCar(phoneNumber, carNumber, workDescription, additionalNotes, extraWorkPrice = 0, extraWorkDescription = "") {
    const user = getUserByPhone(phoneNumber);
    if (!user) return { success: false, message: "Foydalanuvchi topilmadi" };
    const car = user.cars.find(c => c.carNumber === carNumber);
    if (!car) return { success: false, message: "Avtomobil topilmadi" };
    
    let isFree = false;
    let bonusMessage = "";
    let newBonusCount = car.bonusCount;
    let newFreeDiagnostics = car.freeDiagnostics;
    let finalBasePrice = DIAGNOSTIC_PRICE;
    
    if (car.freeDiagnostics > 0) {
        isFree = true;
        newFreeDiagnostics--;
        finalBasePrice = 0;
        bonusMessage = "🎉 BEPUL diagnostikadan foydalandingiz!";
    } else {
        newBonusCount++;
        if (newBonusCount >= 5) {
            const bonusCount = Math.floor(newBonusCount / 5);
            newFreeDiagnostics += bonusCount;
            newBonusCount = newBonusCount % 5;
            bonusMessage = "🎉 TABRIKLAYMIZ! 5-diagnostikani tugatdingiz va 1 ta BEPUL diagnostika qozondingiz!";
        }
    }
    
    const diagnostic = {
        id: Date.now(), userId: user.userId, phoneNumber, carNumber,
        date: new Date().toISOString(), workDescription, additionalNotes: additionalNotes || "",
        diagnosticPrice: finalBasePrice, laborPrice: extraWorkPrice, laborDescription: extraWorkDescription,
        totalPrice: finalBasePrice + extraWorkPrice, isFree
    };
    diagnostics.push(diagnostic);
    saveDiagnostics();
    
    car.bonusCount = newBonusCount;
    car.freeDiagnostics = newFreeDiagnostics;
    car.totalDiagnostics++;
    user.totalDiagnosticsAll++;
    if (!isFree) user.totalBonusCount++;
    if (isFree) user.totalFreeDiagnostics++;
    saveUsers();
    
    return {
        success: true, isFree, diagnosticPrice: finalBasePrice, laborPrice: extraWorkPrice,
        totalPrice: finalBasePrice + extraWorkPrice, newBonusCount, newFreeDiagnostics,
        bonusMessage, carNumber, laborDescription: extraWorkDescription
    };
}

// -------------------- STATISTIKA --------------------
function getStatistics() {
    const activeUsers = getActiveUsers();
    let totalCars = 0;
    for (const user of activeUsers) totalCars += user.cars.length;
    
    let diagnosticIncome = 0, laborIncome = 0, freeCount = 0, laborCount = 0;
    for (const d of diagnostics) {
        const diagPrice = d.diagnosticPrice || 0;
        if (diagPrice > 0) diagnosticIncome += diagPrice;
        else if (d.isFree) freeCount++;
        if (d.laborPrice > 0) {
            laborIncome += d.laborPrice;
            laborCount++;
        }
    }
    
    return {
        totalUsers: activeUsers.length, blockedUsers: getBlockedUsers().length,
        totalCars, totalDiagnostics: diagnostics.length,
        diagnosticIncome, laborIncome, totalIncome: diagnosticIncome + laborIncome,
        laborCount, freeCount, currentVersion,
        totalVideos: videoList.length,
        unreadMessages: getTotalUnreadForAdmin(ADMIN_IDS[0])
    };
}

function getTodayDiagnostics() {
    const today = new Date().toISOString().split("T")[0];
    return diagnostics.filter(d => d.date.split("T")[0] === today);
}

function getAllDiagnostics(limit = 500) {
    return diagnostics.slice(-limit).reverse();
}

function getErrors() {
    return errors.slice(-50).reverse();
}

function getNearBonusCars() {
    const near = [];
    for (const user of users) {
        if (user.isAdmin) continue;
        for (const car of user.cars) {
            if (car.bonusCount >= 3 && car.bonusCount < 5) {
                near.push({ fullName: user.fullName, phone: user.phone, carNumber: car.carNumber, bonusCount: car.bonusCount, remaining: 5 - car.bonusCount });
            }
        }
    }
    return near;
}

function getAllUsersWithDetails() {
    return users.filter(u => !u.isAdmin).map(u => ({
        userId: u.userId, fullName: u.fullName || "Ismsiz", phone: u.phone,
        cars: u.cars, totalDiagnostics: u.totalDiagnosticsAll || 0, isBlocked: u.isBlocked || false
    }));
}

// -------------------- HISOBOT --------------------
async function generateDiagnosticsReport(diagnosticsList) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filepath = path.join(REPORTS_DIR, `diagnostics_report_${timestamp}.txt`);
    let content = "DIAGNOSTIKA HISOBOTI\n";
    content += "=".repeat(50) + "\n\n";
    content += `Sana: ${formatTashkentDateTime(new Date())}\n`;
    content += `Jami: ${diagnosticsList.length} ta\n\n`;
    
    for (const d of diagnosticsList.slice(0, 100)) {
        content += `🚗 ${d.carNumber}\n`;
        content += `📅 ${formatTashkentDate(d.date)}\n`;
        content += `📝 ${d.workDescription}\n`;
        content += `💰 ${(d.diagnosticPrice + (d.laborPrice || 0)).toLocaleString()} so'm\n`;
        content += "-".repeat(30) + "\n";
    }
    
    fs.writeFileSync(filepath, content);
    return filepath;
}

// -------------------- XABAR YUBORISH --------------------
async function sendNotificationToAllUsers(message, keyboard = null) {
    const activeUsers = getActiveUsers();
    let success = 0, fail = 0;
    for (const user of activeUsers) {
        try {
            await bot.sendMessage(user.userId, message, { parse_mode: "Markdown", reply_markup: keyboard });
            success++;
            await new Promise(r => setTimeout(r, 100));
        } catch (err) {
            fail++;
        }
    }
    return { success, fail };
}

async function sendReminder(chatId) {
    await bot.sendMessage(chatId, REMINDER_MESSAGE, { parse_mode: "Markdown" });
}

// ======================== MUHOQOT FUNKSIYALARI ========================
async function showConversation(chatId, userId, isAdminView = false, targetUserId = null) {
    let conversation;
    let otherUserName = "";
    
    if (isAdminView && targetUserId) {
        conversation = getOrCreateConversation(targetUserId, chatId);
        const targetUser = getUserByUserId(targetUserId);
        otherUserName = targetUser ? (targetUser.fullName || targetUser.phone) : "Foydalanuvchi";
    } else {
        conversation = getOrCreateConversation(userId, ADMIN_IDS[0]);
        otherUserName = "Admin";
    }
    
    markMessagesAsRead(conversation.id, chatId);
    
    let msg = `💬 *${otherUserName} bilan muloqot*\n━━━━━━━━━━━━━━━━━━\n\n`;
    const lastMessages = conversation.messages.slice(-20);
    
    for (const m of lastMessages) {
        const sender = m.fromUserId === conversation.userId ? "👤 Siz" : "👑 Admin";
        const time = formatTashkentDateTime(m.timestamp);
        if (m.type === "location" && m.location) {
            msg += `📍 *${sender}* (${time}):\n   🗺️ [Xarita](https://maps.google.com/?q=${m.location.latitude},${m.location.longitude})\n`;
        } else {
            msg += `💬 *${sender}* (${time}):\n   ${m.message}\n`;
        }
        msg += "━━━━━━━━━━━━━━━━━━\n";
    }
    
    if (isAdminView) {
        msg += "\n✏️ *Javob yozish uchun matn yozing*\n📍 Lokatsiya yuborish uchun tugmani bosing\n🔙 Muloqotlar ro'yxati - tugmasini bosing";
        const keyboard = {
            reply_markup: {
                keyboard: [
                    [{ text: "📍 Lokatsiya yuborish", request_location: true }],
                    [{ text: "🔙 Muloqotlar ro'yxati" }]
                ],
                resize_keyboard: true
            }
        };
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", disable_web_page_preview: true, ...keyboard });
    } else {
        msg += "\n✏️ *Xabaringizni yozing*\n📍 Lokatsiya yuborish uchun tugmani bosing\n🔙 Asosiy menyu - tugmasini bosing";
        const keyboard = {
            reply_markup: {
                keyboard: [
                    [{ text: "📍 Lokatsiya yuborish", request_location: true }],
                    [{ text: "🔙 Asosiy menyu" }]
                ],
                resize_keyboard: true
            }
        };
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", disable_web_page_preview: true, ...keyboard });
    }
}

async function showAllConversations(chatId, page = 0) {
    const allConversations = getAllConversations();
    const itemsPerPage = 10;
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageConvs = allConversations.slice(start, end);
    
    if (allConversations.length === 0) {
        await bot.sendMessage(chatId, "💬 *MUHOQOTLAR*\n\nHozircha hech qanday muloqot yo'q.", { parse_mode: "Markdown" });
        await sendMainMenu(chatId, true, chatId);
        return;
    }
    
    let msg = "💬 *MUHOQOTLAR RO'YXATI*\n━━━━━━━━━━━━━━━━━━\n\n";
    msg += `📊 Jami: ${allConversations.length} ta muloqot\n`;
    msg += `📄 Sahifa ${page + 1}/${Math.ceil(allConversations.length / itemsPerPage)}\n`;
    msg += "━━━━━━━━━━━━━━━━━━\n\n";
    
    const keyboard = [];
    for (let i = 0; i < pageConvs.length; i++) {
        const conv = pageConvs[i];
        const user = getUserByUserId(conv.userId);
        const userName = user ? (user.fullName || user.phone || `ID: ${conv.userId}`) : `ID: ${conv.userId}`;
        const lastMsg = conv.messages[conv.messages.length - 1];
        const lastMsgText = lastMsg ? (lastMsg.type === "location" ? "📍 Lokatsiya" : lastMsg.message.substring(0, 30)) : "Xabar yo'q";
        const unread = conv.adminUnreadCount || 0;
        const unreadIcon = unread > 0 ? `🔴 ${unread}🆕 ` : "";
        const num = start + i + 1;
        msg += `${num}. ${unreadIcon}*${userName.substring(0, 25)}*\n`;
        msg += `   📝 ${lastMsgText}\n`;
        msg += `   📅 ${lastMsg ? formatTashkentDateTime(lastMsg.timestamp) : "-"}\n`;
        msg += "━━━━━━━━━━━━━━━━━━\n";
        keyboard.push([{ text: `💬 ${num}. ${userName.substring(0, 20)}`, callback_data: `open_conversation_${conv.userId}` }]);
    }
    
    const navButtons = [];
    if (page > 0) navButtons.push({ text: "◀️ Oldingi", callback_data: `conversations_page_${page - 1}` });
    if (end < allConversations.length) navButtons.push({ text: "Keyingi ▶️", callback_data: `conversations_page_${page + 1}` });
    if (navButtons.length > 0) keyboard.push(navButtons);
    
    keyboard.push([{ text: "🔙 Ortga", callback_data: "back_to_main" }]);
    
    await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
}

// ======================== KEYBOARDS ========================
function getCompactInlineKeyboard(userId) {
    const unreadCount = getUserUnreadCount(userId);
    const unreadBadge = unreadCount > 0 ? ` (${unreadCount})` : "";
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Profil", callback_data: "user_profile" }, { text: "🚗 Avtomobillar", callback_data: "user_my_cars" }],
                [{ text: "🎁 Bonuslar", callback_data: "user_my_bonus" }, { text: "➕ Avto qo'shish", callback_data: "user_add_car" }],
                [{ text: "📋 Tarix", callback_data: "user_history" }, { text: "📹 Video", callback_data: "user_video_gallery" }],
                [{ text: "💳 To'lov", callback_data: "user_payment" }, { text: "📸 Instagram", callback_data: "user_instagram" }],
                [{ text: "👥 Guruh", callback_data: "user_telegram_group" }, { text: "💬 Admin bilan bog'lanish" + unreadBadge, callback_data: "user_contact_admin" }],
                [{ text: "ℹ️ Ma'lumot", callback_data: "user_info" }, { text: "📌 Versiya", callback_data: "user_version_info" }]
            ]
        }
    };
}

function getAdminReplyKeyboard() {
    const unreadCount = getTotalUnreadForAdmin(ADMIN_IDS[0]);
    const unreadBadge = unreadCount > 0 ? ` (${unreadCount}🆕)` : "";
    return {
        reply_markup: {
            keyboard: [
                ["📊 Statistika", "👥 Foydalanuvchilar"],
                ["🔧 Diagnostika", "🎁 Bonusga yaqinlar"],
                ["⚠️ Xatoliklar", "📋 Diagnostika tarixi"],
                ["📅 Bugungi", "📄 Hisobot"],
                ["📹 Video galereya", "📤 Video yuklash"],
                ["🗑️ Video o'chirish", "💾 Backup"],
                ["🔄 Tiklash", "🚫 Foyd. boshqarish"],
                ["🔐 Xavfsizlik", "📌 Versiya"],
                ["📢 Xabar yuborish", "💬 Muloqotlar" + unreadBadge],
                ["❌ Asosiy menyu"]
            ],
            resize_keyboard: true
        }
    };
}

function getPhoneKeyboard() {
    return {
        reply_markup: {
            keyboard: [[{ text: "📱 Telefon raqamini yuborish", request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };
}

function getLocationKeyboard() {
    return {
        reply_markup: {
            keyboard: [
                [{ text: "📍 Lokatsiya yuborish", request_location: true }],
                [{ text: "🔙 Bekor qilish" }]
            ],
            resize_keyboard: true
        }
    };
}

function removeKeyboard() {
    return { reply_markup: { remove_keyboard: true } };
}

async function sendMainMenu(chatId, isAdminUser = false, userId = null) {
    if (isAdminUser) {
        await bot.sendMessage(chatId, "👑 *Admin paneli*\n\n📌 Bot versiyasi: `V" + currentVersion + "`\n© " + BOT_OWNER, {
            parse_mode: "Markdown",
            ...getAdminReplyKeyboard()
        });
    } else {
        await bot.sendMessage(chatId, "🏠 *Asosiy menyu*\n\n📌 Versiya: `V" + currentVersion + "`\n🚗 Isuzu Doctor bot", {
            parse_mode: "Markdown",
            ...getCompactInlineKeyboard(userId)
        });
    }
}

async function showVideoGallery(chatId, page = 0) {
    const videos = getActiveVideos();
    const itemsPerPage = 5;
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageVideos = videos.slice(start, end);
    
    if (videos.length === 0) {
        await bot.sendMessage(chatId, "📹 *VIDEO GALEREYA*\n\nHozircha videolar mavjud emas.", { parse_mode: "Markdown" });
        return;
    }
    
    let msg = "📹 *VIDEO GALEREYA*\n━━━━━━━━━━━━━━━━━━\n\n";
    msg += `📊 Jami: ${videos.length} ta video\n━━━━━━━━━━━━━━━━━━\n\n`;
    
    const keyboard = [];
    for (let i = 0; i < pageVideos.length; i++) {
        const v = pageVideos[i];
        const num = start + i + 1;
        msg += `${num}. *${v.title}*\n`;
        if (v.description) msg += `   📝 ${v.description.substring(0, 50)}\n`;
        msg += "━━━━━━━━━━━━━━━━━━\n";
        keyboard.push([{ text: `▶️ ${num}. ${v.title.substring(0, 25)}`, callback_data: `watch_video_${v.id}` }]);
    }
    
    const nav = [];
    if (page > 0) nav.push({ text: "◀️", callback_data: `video_page_${page - 1}` });
    if (end < videos.length) nav.push({ text: "▶️", callback_data: `video_page_${page + 1}` });
    if (nav.length) keyboard.push(nav);
    keyboard.push([{ text: "🔙 Asosiy menyu", callback_data: "back_to_main" }]);
    
    await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
}

async function showVideoManagement(chatId, page = 0) {
    const videos = getActiveVideos();
    const itemsPerPage = 5;
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageVideos = videos.slice(start, end);
    
    if (videos.length === 0) {
        await bot.sendMessage(chatId, "📹 *VIDEO BOSHQARISH*\n\nVideolar mavjud emas.", { parse_mode: "Markdown" });
        return;
    }
    
    let msg = "📹 *VIDEO BOSHQARISH PANELI*\n━━━━━━━━━━━━━━━━━━\n\n";
    const keyboard = [];
    for (let i = 0; i < pageVideos.length; i++) {
        const v = pageVideos[i];
        const num = start + i + 1;
        msg += `${num}. *${v.title}*\n`;
        msg += `   👁️ ${v.views || 0} | 👍 ${v.likes || 0}\n`;
        msg += "━━━━━━━━━━━━━━━━━━\n";
        keyboard.push([{ text: `🗑️ ${num}. ${v.title.substring(0, 25)}`, callback_data: `delete_video_${v.id}` }]);
    }
    
    const nav = [];
    if (page > 0) nav.push({ text: "◀️ Oldingi", callback_data: `video_manage_page_${page - 1}` });
    if (end < videos.length) nav.push({ text: "Keyingi ▶️", callback_data: `video_manage_page_${page + 1}` });
    if (nav.length) keyboard.push(nav);
    keyboard.push([{ text: "🔙 Ortga", callback_data: "back_to_main" }]);
    
    await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
}

async function showUsersList(chatId, page, messageId = null) {
    const usersList = getAllUsersWithDetails();
    const itemsPerPage = 10;
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageUsers = usersList.slice(start, end);
    const totalPages = Math.ceil(usersList.length / itemsPerPage);
    
    let msg = "👥 *FOYDALANUVCHILAR*\n";
    msg += `📄 Sahifa ${page + 1}/${totalPages}\n`;
    msg += `👤 Jami: ${usersList.length} ta\n━━━━━━━━━━━━━━━━━━\n\n`;
    
    for (let i = 0; i < pageUsers.length; i++) {
        const u = pageUsers[i];
        const num = start + i + 1;
        const status = u.isBlocked ? "🔴" : "🟢";
        const carNumber = u.cars.length > 0 ? u.cars[0].carNumber : "❌";
        msg += `${status} *${num}. ${u.fullName.substring(0, 20)}*\n📞 ${u.phone}\n🚗 ${carNumber}\n━━━━━━━━━━━━━━━━━━\n`;
    }
    
    const keyboard = [];
    const nav = [];
    if (page > 0) nav.push({ text: "◀️ Oldingi", callback_data: "users_page_prev" });
    if (end < usersList.length) nav.push({ text: "Keyingi ▶️", callback_data: "users_page_next" });
    if (nav.length) keyboard.push(nav);
    keyboard.push([{ text: "🔙 Ortga", callback_data: "back_to_main" }]);
    
    if (messageId) {
        await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
    } else {
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
    }
}

function formatDiagnosticMessage(diagnostic, includePhone = false) {
    let msg = `🔧 *DIAGNOSTIKA*\n\n🚗 ${diagnostic.carNumber}\n📅 ${formatTashkentDate(diagnostic.date)}\n\n📝 *Bajarilgan ishlar:*\n${diagnostic.workDescription}\n`;
    if (diagnostic.additionalNotes) msg += `\n📌 *Eslatma:*\n${diagnostic.additionalNotes}\n`;
    msg += `\n💰 *Narx:* ${(diagnostic.diagnosticPrice + (diagnostic.laborPrice || 0)).toLocaleString()} so'm`;
    if (diagnostic.isFree) msg += `\n🎉 BEPUL!`;
    return msg;
}

// -------------------- SESSIONS --------------------
const userSessions = new Map();

function getUserSession(userId) {
    if (!userSessions.has(userId)) userSessions.set(userId, { step: null, data: {} });
    return userSessions.get(userId);
}

function clearUserSession(userId) {
    userSessions.delete(userId);
}

let usersListPage = 0;
let userManagePage = 0;

// -------------------- BOTNI YARATISH --------------------
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.deleteWebHook().catch(e => console.log(e.message));
// ======================== BOT HANDLERLARI ========================

// -------------------- /start KOMANDASI --------------------
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || "";
    const lastName = msg.from.last_name || "";
    const username = msg.from.username || "";
    
    const deviceType = getDeviceType(msg.from?.userAgent || "");
    setUserDevice(userId, deviceType);
    
    clearUserSession(userId);
    const existingUser = getUserByUserId(userId);
    
    if (existingUser && existingUser.isBlocked) {
        await bot.sendMessage(chatId, "🚫 *Siz botdan bloklangansiz!*\n\nIltimos, administrator bilan bog'laning.\n📞 Aloqa: " + ADMIN_PHONE, { 
            parse_mode: "Markdown",
            ...removeKeyboard()
        });
        return;
    }
    
    try {
        await sendReminder(chatId);
        
        if (existingUser) {
            if (!existingUser.firstName && firstName) {
                existingUser.firstName = firstName;
                existingUser.lastName = lastName;
                existingUser.username = username;
                existingUser.fullName = firstName + " " + lastName;
                saveUsers();
            }
            
            const carsCount = existingUser.cars.length;
            const welcomeText = "👋 *Xush kelibsiz, " + (existingUser.fullName || firstName || "hurmatli mijoz") + "!*\n\n📞 Telefon: " + existingUser.phone + "\n🚗 Avtomobillar: " + carsCount + " ta\n🎁 Bonus: " + (existingUser.totalBonusCount || 0) + "\n🎉 Bepul: " + (existingUser.totalFreeDiagnostics || 0) + " ta\n📊 Diagnostika: " + (existingUser.totalDiagnosticsAll || 0) + " ta\n📌 Bot versiyasi: `V" + currentVersion + "`\n📸 Instagram: " + INSTAGRAM_LINK;
            await bot.sendMessage(chatId, welcomeText, { parse_mode: "Markdown" });
            await sendMainMenu(chatId, existingUser.isAdmin, userId);
        } else {
            const session = getUserSession(userId);
            session.data.firstName = firstName;
            session.data.lastName = lastName;
            session.data.username = username;
            
            await bot.sendMessage(chatId, "🚗 *ISUZU DOCTOR* tizimiga xush kelibsiz! (Versiya V" + currentVersion + ")\n📸 Instagram: " + INSTAGRAM_LINK + "\n\n© " + BOT_OWNER + "\n\n📱 Iltimos, telefon raqamingizni yuboring:", {
                parse_mode: "Markdown",
                ...getPhoneKeyboard()
            });
        }
    } catch (error) {
        console.error("/start xatolik:", error);
        await bot.sendMessage(chatId, "❌ *Xatolik yuz berdi!* Iltimos, qaytadan /start bosing.", { parse_mode: "Markdown" });
    }
});

// -------------------- KONTAKT QABUL QILISH --------------------
bot.on("contact", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const contact = msg.contact;
    const firstName = msg.from.first_name || "";
    const lastName = msg.from.last_name || "";
    const username = msg.from.username || "";
    
    if (!contact) return;
    
    let phoneNumber = contact.phone_number;
    if (!phoneNumber.startsWith("+")) {
        phoneNumber = "+" + phoneNumber;
    }
    
    const session = getUserSession(userId);
    session.data.phone = phoneNumber;
    
    if (!session.data.firstName) {
        session.data.firstName = firstName;
        session.data.lastName = lastName;
        session.data.username = username;
    }
    
    if (phoneNumber === ADMIN_PHONE) {
        const newUser = {
            userId: userId,
            phone: phoneNumber,
            firstName: firstName,
            lastName: lastName,
            username: username,
            fullName: firstName + " " + lastName,
            isAdmin: true,
            isActive: true,
            isBlocked: false,
            registeredDate: new Date().toISOString(),
            cars: [{
                carId: Date.now(),
                carNumber: "ADMIN",
                bonusCount: 0,
                freeDiagnostics: 0,
                totalDiagnostics: 0,
                addedDate: new Date().toISOString(),
                isActive: true
            }],
            totalBonusCount: 0,
            totalFreeDiagnostics: 0,
            totalDiagnosticsAll: 0
        };
        users.push(newUser);
        saveUsers();
        
        try {
            await sendReminder(chatId);
            await bot.sendMessage(chatId, "👑 *Siz ADMIN sifatida tizimga kirdingiz!*\n\n📞 Telefon: " + phoneNumber + "\n📌 Versiya: V" + currentVersion + "\n📸 Instagram: " + INSTAGRAM_LINK, { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, userId);
        } catch (error) {
            console.error("Admin xabar xatolik:", error);
        }
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
        session.data.isExistingUser = true;
        await bot.sendMessage(chatId, "✅ Telefon raqam tasdiqlandi: " + phoneNumber + "\n\n🚗 *Yangi avtomobil raqamini kiriting:*\n\nMasalan: 01A777AA\n\n⚠️ Siz maksimum " + MAX_CARS_PER_USER + " tagacha avtomobil qo'sha olasiz.", {
            parse_mode: "Markdown",
            ...removeKeyboard()
        });
    } else {
        session.step = "first_car_number";
        session.data.isExistingUser = false;
        await bot.sendMessage(chatId, "✅ Telefon raqam qabul qilindi: " + phoneNumber + "\n\n🚗 *Birinchi avtomobil raqamini kiriting:*\n\nMasalan: 01A777AA", {
            parse_mode: "Markdown",
            ...removeKeyboard()
        });
    }
});

// -------------------- ADMIN MATNLI BUYRUQLAR (TELEGRAM COMMANDS) --------------------
bot.onText(/\/deleteuser (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
    const phoneOrCar = match[1].trim();
    
    let targetUser = getUserByPhone(phoneOrCar);
    
    if (!targetUser) {
        targetUser = users.find(u => u.cars.some(c => c.carNumber === phoneOrCar));
    }
    
    if (!targetUser) {
        await bot.sendMessage(chatId, "❌ *Foydalanuvchi topilmadi!*", { parse_mode: "Markdown" });
        return;
    }
    
    const result = deleteUser(targetUser.userId);
    await bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
});

bot.onText(/\/listusers/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
    let msgText = "📋 *FOYDALANUVCHILAR RO'YXATI (ID bilan)*\n━━━━━━━━━━━━━━━━━━\n\n";
    
    users.filter(u => !u.isAdmin).forEach((u, index) => {
        const carNumber = u.cars.length > 0 ? u.cars[0].carNumber : "❌ Avto yo'q";
        msgText += `${index + 1}. ID: \`${u.userId}\`\n`;
        msgText += `   👤 ${u.fullName || "Ismsiz"}\n`;
        msgText += `   📞 ${u.phone}\n`;
        msgText += `   🚗 ${carNumber}\n`;
        msgText += `   🚦 ${u.isBlocked ? "🔴 Bloklangan" : "🟢 Faol"}\n`;
        msgText += "━━━━━━━━━━━━━━━━━━\n";
    });
    
    await bot.sendMessage(chatId, msgText, { parse_mode: "Markdown" });
});

bot.onText(/\/cleanusers/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const usersWithoutCars = users.filter(u => !u.isAdmin && (!u.cars || u.cars.length === 0));
    
    if (usersWithoutCars.length === 0) {
        await bot.sendMessage(chatId, "✅ *Avtomobili bo'lmagan foydalanuvchilar yo'q!*", { parse_mode: "Markdown" });
        return;
    }
    
    let deleted = 0;
    let msgText = "🗑️ *O'CHIRILGANLAR*\n━━━━━━━━━━━━━━━━━━\n\n";
    
    for (const u of usersWithoutCars) {
        msgText += `👤 ${u.fullName || "Ismsiz"}\n📞 ${u.phone}\n🆔 ID: ${u.userId}\n━━━━━━━━━━━━━━━━━━\n`;
        const result = deleteUser(u.userId);
        if (result.success) deleted++;
    }
    
    msgText += `\n✅ *${deleted} ta foydalanuvchi o'chirildi!*`;
    await bot.sendMessage(chatId, msgText, { parse_mode: "Markdown" });
});

// -------------------- FOYDALANUVCHI BUYRUQLARI --------------------
bot.onText(/\/profile/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = getUserByUserId(userId);
    
    if (!user) {
        await bot.sendMessage(chatId, "❌ Ro'yxatdan o'tmagan! /start bosing.");
        return;
    }
    
    const carsList = user.cars.map(c => "🚗 " + c.carNumber + " (" + c.totalDiagnostics + " ta diagnostika)").join("\n");
    await sendReminder(chatId);
    await bot.sendMessage(chatId, "📊 *MENGING SAHIFAM*\n\n👤 *Ism:* " + (user.fullName || "Kiritilmagan") + "\n📞 *Telefon:* " + user.phone + "\n🚗 *Avtomobillar:* " + user.cars.length + "/" + MAX_CARS_PER_USER + "\n\n" + carsList + "\n\n🎁 *Umumiy bonuslar:* " + (user.totalBonusCount || 0) + "\n🎉 *Bepul diagnostika:* " + (user.totalFreeDiagnostics || 0) + " ta\n📊 *Jami diagnostika:* " + (user.totalDiagnosticsAll || 0) + " ta\n📌 *Versiya:* `V" + currentVersion + "`", { parse_mode: "Markdown" });
    await sendMainMenu(chatId, isAdmin(userId), userId);
});

bot.onText(/\/my_cars/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = getUserByUserId(userId);
    
    if (!user) {
        await bot.sendMessage(chatId, "❌ Ro'yxatdan o'tmagan! /start bosing.");
        return;
    }
    
    if (user.cars.length === 0) {
        await bot.sendMessage(chatId, "📭 Sizda hali avtomobillar mavjud emas!\n\n➕ '➕ Yangi avtomobil qo'shish' tugmasini bosing.");
        return;
    }
    
    let carsText = "🚗 *MENGING AVTOMOBILLARIM*\n\n📌 *Bonus qoidasi:* 5 diagnostika = 1 BEPUL\n━━━━━━━━━━━━━━━━━━\n\n";
    for (const car of user.cars) {
        const nextFree = 5 - car.bonusCount;
        carsText += "🚗 *" + car.carNumber + "*\n";
        carsText += "🎁 Bonus: " + car.bonusCount + "/5\n";
        carsText += "🎉 Bepul: " + car.freeDiagnostics + " ta\n";
        carsText += "📊 Diagnostika: " + car.totalDiagnostics + " ta\n";
        carsText += "📅 Qo'shilgan: " + formatTashkentDate(car.addedDate) + "\n";
        
        if (car.freeDiagnostics > 0) {
            carsText += "✅ *Bepul diagnostika mavjud!*\n";
        } else if (nextFree > 0) {
            carsText += "📌 Keyingi BEPUL: " + nextFree + " ta diagnostikadan keyin\n";
        }
        
        carsText += "━━━━━━━━━━━━━━━━━━\n";
    }
    await sendReminder(chatId);
    await bot.sendMessage(chatId, carsText, { parse_mode: "Markdown" });
    await sendMainMenu(chatId, isAdmin(userId), userId);
});

bot.onText(/\/my_bonus/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = getUserByUserId(userId);
    
    if (!user) {
        await bot.sendMessage(chatId, "❌ Ro'yxatdan o'tmagan! /start bosing.");
        return;
    }
    
    let bonusText = "🎁 *MENGING BONUSLARIM*\n\n📌 *Qoida:* Har 5 diagnostikada 1 ta BEPUL!\n━━━━━━━━━━━━━━━━━━\n\n";
    for (const car of user.cars) {
        const nextFree = 5 - car.bonusCount;
        bonusText += "🚗 *" + car.carNumber + "*\n";
        bonusText += "📊 To'plangan: " + car.bonusCount + "/5\n";
        bonusText += "🎉 Bepul diagnostika: " + car.freeDiagnostics + " ta\n";
        
        if (car.freeDiagnostics > 0) {
            bonusText += "✅ *Sizda " + car.freeDiagnostics + " ta BEPUL diagnostika bor!*\n";
            bonusText += "💡 Keyingi diagnostikangiz BEPUL bo'ladi!\n";
        } else if (nextFree > 0) {
            bonusText += "📌 *Keyingi BEPUL diagnostika:* " + nextFree + " ta diagnostikadan keyin\n";
        } else if (nextFree === 0 && car.bonusCount === 5) {
            bonusText += "🎉 *DARHOL BEPUL diagnostika qozondingiz!*\n";
            bonusText += "✅ Keyingi diagnostikangiz BEPUL bo'ladi!\n";
        }
        
        bonusText += "━━━━━━━━━━━━━━━━━━\n";
    }
    bonusText += "\n🎯 *QANDAY ISHLAYDI?*\n";
    bonusText += "• Har 5 ta to'lovli diagnostika = 1 ta BEPUL\n";
    bonusText += "• Har bir avtomobil uchun bonus alohida hisoblanadi\n";
    bonusText += "• Bepul diagnostika cheksiz muddatga amal qiladi\n";
    bonusText += "• Admin diagnostika qo'shganda avtomatik hisoblanadi";
    
    await sendReminder(chatId);
    await bot.sendMessage(chatId, bonusText, { parse_mode: "Markdown" });
    await sendMainMenu(chatId, isAdmin(userId), userId);
});

bot.onText(/\/history/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = getUserByUserId(userId);
    
    if (!user) {
        await bot.sendMessage(chatId, "❌ Ro'yxatdan o'tmagan! /start bosing.");
        return;
    }
    
    const diags = diagnostics.filter(d => d.phoneNumber === user.phone).slice(-15).reverse();
    if (diags.length === 0) {
        await bot.sendMessage(chatId, "📭 *Sizda hali diagnostikalar mavjud emas!*", { parse_mode: "Markdown" });
        await sendMainMenu(chatId, isAdmin(userId), userId);
        return;
    }
    
    await sendReminder(chatId);
    for (const d of diags) {
        const msgText = formatDiagnosticMessage(d, false);
        await bot.sendMessage(chatId, msgText, { parse_mode: "Markdown" });
    }
    await sendMainMenu(chatId, isAdmin(userId), userId);
});

bot.onText(/\/info/, async (msg) => {
    const chatId = msg.chat.id;
    await sendReminder(chatId);
    await bot.sendMessage(chatId, "ℹ️ *ISUZU DOCTOR BOT*\n\n🚗 Avtomobil diagnostikasi\n🎁 Har 5 diagnostikada 1 ta BEPUL\n📱 Bitta telefon bilan " + MAX_CARS_PER_USER + " tagacha avtomobil\n📞 Aloqa: " + ADMIN_PHONE + "\n📌 Bot versiyasi: `V" + currentVersion + "`\n🔗 Bot linki: " + NEW_BOT_LINK + "\n📸 Instagram: " + INSTAGRAM_LINK + "\n👥 Telegram guruhimiz: " + TELEGRAM_GROUP_LINK + "\n\n© " + BOT_OWNER, { parse_mode: "Markdown" });
    await sendMainMenu(chatId, isAdmin(msg.from.id), msg.from.id);
});

bot.onText(/\/close/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    clearUserSession(userId);
    await sendMainMenu(chatId, isAdmin(userId), userId);
});

// -------------------- ADMIN MATNLI BUYRUQLAR --------------------
bot.onText(/\/statistika/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const stats = getStatistics();
    
    let statMsg = "📊 *STATISTIKA* 📊\n";
    statMsg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    
    statMsg += "👥 *FOYDALANUVCHILAR*\n";
    statMsg += `   👤 Faol: ${stats.totalUsers}\n`;
    statMsg += `   🚫 Bloklangan: ${stats.blockedUsers}\n`;
    statMsg += `   🚗 Avtomobillar: ${stats.totalCars}\n\n`;
    
    statMsg += "🔧 *DIAGNOSTIKA*\n";
    statMsg += `   📊 Jami: ${stats.totalDiagnostics} ta\n`;
    statMsg += `   💵 Diagnostika daromadi: ${stats.diagnosticIncome.toLocaleString()} so'm\n`;
    statMsg += `   🔨 Mehnat daromadi: ${stats.laborIncome.toLocaleString()} so'm\n\n`;
    
    statMsg += "💰 *JAMI DAROMAD*\n";
    statMsg += `   💵 Umumiy: ${stats.totalIncome.toLocaleString()} so'm\n\n`;
    
    statMsg += "📹 *VIDEO*\n";
    statMsg += `   🎬 Videolar: ${stats.totalVideos} ta\n\n`;
    
    statMsg += "ℹ️ *TEXNIK MA'LUMOT*\n";
    statMsg += `   📌 Versiya: \`V${stats.currentVersion}\`\n`;
    statMsg += `   💬 О'қилмаган хабарлар: ${stats.unreadMessages}\n`;
    statMsg += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    statMsg += `© ${BOT_OWNER}`;
    
    await bot.sendMessage(chatId, statMsg, { parse_mode: "Markdown" });
    await sendMainMenu(chatId, true, userId);
});

bot.onText(/\/users/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    usersListPage = 0;
    await showUsersList(chatId, usersListPage);
});

bot.onText(/\/add_diagnostic/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!isAdmin(userId)) return;
    
    const session = getUserSession(userId);
    session.step = "admin_add_diagnostic";
    await bot.sendMessage(chatId, "🔧 *Diagnostika qo'shish*\n\n🚗 Avtomobil raqamini kiriting:", { parse_mode: "Markdown", ...removeKeyboard() });
});
// -------------------- ASOSIY MESSAGE HANDLER (FILTRLAR BILAN) --------------------
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
    const deviceType = getUserDevice(userId);
    const user = getUserByUserId(userId);
    
    // ========== 1. VIDEO QABUL QILINMAYDI ==========
    if (video) {
        await bot.sendMessage(chatId, "❌ *Video qabul qilinmaydi!*\n\nFaqat matnli xabar yoki lokatsiya yuborishingiz mumkin.", { parse_mode: "Markdown" });
        return;
    }
    
    // ========== 2. OVOZLI XABAR QABUL QILINMAYDI ==========
    if (voice) {
        await bot.sendMessage(chatId, "❌ *Ovozli xabar qabul qilinmaydi!*\n\nIltimos, matnli xabar yozing.", { parse_mode: "Markdown" });
        return;
    }
    
    // ========== 3. RASM QABUL QILINMAYDI ==========
    if (photo) {
        await bot.sendMessage(chatId, "❌ *Rasm qabul qilinmaydi!*\n\nFaqat matnli xabar yoki lokatsiya yuborishingiz mumkin.", { parse_mode: "Markdown" });
        return;
    }
    
    // ========== 4. HUJJAT QABUL QILINMAYDI ==========
    if (document) {
        await bot.sendMessage(chatId, "❌ *Hujjat qabul qilinmaydi!*\n\nFaqat matnli xabar yoki lokatsiya yuborishingiz mumkin.", { parse_mode: "Markdown" });
        return;
    }
    
    // ========== 5. LOKATSIYA QABUL QILISH ==========
    if (location) {
        // Muloqot rejimida lokatsiya yuborish
        if (session.step === "conversation_mode" || session.data.inConversation) {
            if (isAdmin(userId)) {
                const targetUserId = session.data.replyingToUserId;
                if (targetUserId) {
                    addAdminReply(userId, targetUserId, "", "location", { latitude: location.latitude, longitude: location.longitude });
                    await bot.sendMessage(chatId, "✅ *Lokatsiya yuborildi!*", { parse_mode: "Markdown" });
                    const userMsg = `📍 *Admin lokatsiya yubordi*\n\n🗺️ [Xaritada ko'rish](https://maps.google.com/?q=${location.latitude},${location.longitude})`;
                    await bot.sendMessage(targetUserId, userMsg, { parse_mode: "Markdown", disable_web_page_preview: true });
                    await showConversation(chatId, userId, true, targetUserId);
                }
            } else {
                addMessage(userId, ADMIN_IDS[0], "", "location", { latitude: location.latitude, longitude: location.longitude });
                await bot.sendMessage(chatId, "✅ *Lokatsiya yuborildi! Admin tez orada javob beradi.*\n\n💬 Xabar yozishda davom eting:", { parse_mode: "Markdown" });
                
                const userInfo = user ? (user.fullName || user.phone) : "Foydalanuvchi";
                const adminMsg = `📍 *Yangi lokatsiya*\n\n👤 ${userInfo}\n🆔 ID: ${userId}\n🗺️ [Xaritada ko'rish](https://maps.google.com/?q=${location.latitude},${location.longitude})\n\n💬 Javob berish uchun "💬 Muloqotlar" tugmasini bosing!`;
                for (const adminId of ADMIN_IDS) {
                    await bot.sendMessage(adminId, adminMsg, { parse_mode: "Markdown", disable_web_page_preview: true });
                }
                
                const userSession = getUserSession(userId);
                userSession.step = "conversation_mode";
                userSession.data.inConversation = true;
            }
            return;
        }
        
        // Oddiy lokatsiya - muloqot boshlash
        if (!isAdmin(userId) && user && !user.isBlocked) {
            addMessage(userId, ADMIN_IDS[0], "", "location", { latitude: location.latitude, longitude: location.longitude });
            await bot.sendMessage(chatId, "✅ *Lokatsiya yuborildi! Admin tez orada javob beradi.*\n\n💬 Xabar yozishda davom eting:", { parse_mode: "Markdown" });
            
            const userInfo = user ? (user.fullName || user.phone) : "Foydalanuvchi";
            const adminMsg = `📍 *Yangi lokatsiya*\n\n👤 ${userInfo}\n🆔 ID: ${userId}\n🗺️ [Xaritada ko'rish](https://maps.google.com/?q=${location.latitude},${location.longitude})\n\n💬 Javob berish uchun "💬 Muloqotlar" tugmasini bosing!`;
            for (const adminId of ADMIN_IDS) {
                await bot.sendMessage(adminId, adminMsg, { parse_mode: "Markdown", disable_web_page_preview: true });
            }
            
            const userSession = getUserSession(userId);
            userSession.step = "conversation_mode";
            userSession.data.inConversation = true;
            return;
        }
        return;
    }
    
    // ========== 6. "BEKOR QILISH" TUGMASI ==========
    if (text === "🔙 Bekor qilish" || text === "🔙 Asosiy menyu" || text === "🔙 Muloqotlar ro'yxati") {
        clearUserSession(userId);
        await sendMainMenu(chatId, isAdmin(userId), userId);
        return;
    }
    
    // ========== 7. ADMIN VIDEO YUKLASH ==========
    if (session.step === "admin_waiting_video") {
        if (!isAdmin(userId)) {
            clearUserSession(userId);
            await sendMainMenu(chatId, false, deviceType);
            return;
        }
        
        if (text === "/cancel") {
            clearUserSession(userId);
            await bot.sendMessage(chatId, "❌ *Video yuklash bekor qilindi!*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, deviceType);
            return;
        }
        
        if (msg.video) {
            session.data.videoFileId = msg.video.file_id;
            session.step = "admin_waiting_video_title";
            await bot.sendMessage(chatId, "✅ *Video qabul qilindi!*\n\n📝 Endi video *NOMINI* kiriting:", { parse_mode: "Markdown" });
        } else {
            await bot.sendMessage(chatId, "❌ *Iltimos, VIDEO fayl yuboring!*\n\n📤 Video faylni yuboring (MP4, AVI, MOV formatlarida)\n\n❌ Bekor qilish: /cancel", { parse_mode: "Markdown" });
        }
        return;
    }
    
    if (session.step === "admin_waiting_video_title") {
        if (!isAdmin(userId)) {
            clearUserSession(userId);
            await sendMainMenu(chatId, false, deviceType);
            return;
        }
        
        if (text === "/cancel") {
            clearUserSession(userId);
            await bot.sendMessage(chatId, "❌ *Video yuklash bekor qilindi!*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, deviceType);
            return;
        }
        
        if (!text || text.length < 3) {
            await bot.sendMessage(chatId, "❌ *Iltimos, video nomini kiriting!* (kamida 3 harf)", { parse_mode: "Markdown" });
            return;
        }
        
        session.data.title = text;
        session.step = "admin_waiting_video_description";
        await bot.sendMessage(chatId, "✅ *Nom qabul qilindi:* " + text + "\n\n📝 Endi video *TAVSIFINI* kiriting (ixtiyoriy):\n\n❌ Bekor qilish: /cancel", { parse_mode: "Markdown" });
        return;
    }
    
    if (session.step === "admin_waiting_video_description") {
        if (!isAdmin(userId)) {
            clearUserSession(userId);
            await sendMainMenu(chatId, false, deviceType);
            return;
        }
        
        if (text === "/cancel") {
            clearUserSession(userId);
            await bot.sendMessage(chatId, "❌ *Video yuklash bekor qilindi!*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, deviceType);
            return;
        }
        
        session.data.description = text || "";
        
        const newVideo = addVideo(session.data.videoFileId, session.data.title, session.data.description, userId);
        
        if (newVideo) {
            await bot.sendMessage(chatId, "✅ *Video muvaffaqiyatli yuklandi!*\n\n📹 *Nomi:* " + session.data.title, { parse_mode: "Markdown" });
        } else {
            await bot.sendMessage(chatId, "❌ *Video yuklashda xatolik!*\n\nIltimos, qaytadan urinib ko'ring.", { parse_mode: "Markdown" });
        }
        
        clearUserSession(userId);
        await sendMainMenu(chatId, true, deviceType);
        return;
    }
    
    // ========== 8. ADMIN XABAR YUBORISH ==========
    if (session.step === "admin_send_message") {
        if (!isAdmin(userId)) {
            clearUserSession(userId);
            await sendMainMenu(chatId, false, deviceType);
            return;
        }
        
        if (text === "/cancel") {
            clearUserSession(userId);
            await bot.sendMessage(chatId, "❌ *Xabar yuborish bekor qilindi.*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, deviceType);
            return;
        }
        
        await bot.sendMessage(chatId, "📢 *Xabar yuborilmoqda...*", { parse_mode: "Markdown" });
        
        const keyboard = {
            inline_keyboard: [
                [{ text: "🚀 Yangi botga o'tish", url: NEW_BOT_LINK }],
                [{ text: "🏠 Asosiy menyu", callback_data: "back_to_main" }]
            ]
        };
        
        const result = await sendNotificationToAllUsers(text, keyboard);
        
        await bot.sendMessage(chatId, `✅ *Xabar yuborildi!*\n\n✅ Yuborildi: ${result.success} ta foydalanuvchiga\n❌ Yuborilmadi: ${result.fail} ta`, { parse_mode: "Markdown" });
        
        clearUserSession(userId);
        await sendMainMenu(chatId, true, deviceType);
        return;
    }
    
    // ========== 9. ADMIN VERSIYA YANGILASH ==========
    if (session.step === "admin_update_version") {
        if (!isAdmin(userId)) {
            clearUserSession(userId);
            await sendMainMenu(chatId, false, deviceType);
            return;
        }
        
        if (text === "/cancel") {
            clearUserSession(userId);
            await bot.sendMessage(chatId, "❌ *Versiya yangilash bekor qilindi.*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, deviceType);
            return;
        }
        
        const versionPattern = /^\d+\.\d+$/;
        if (!versionPattern.test(text)) {
            await bot.sendMessage(chatId, "❌ *Noto'g'ri versiya formati!*\n\nMasalan: 2.2 yoki 3.0 formatida kiriting.", { parse_mode: "Markdown" });
            return;
        }
        
        session.data.newVersion = text;
        session.step = "admin_version_changes";
        await bot.sendMessage(chatId, "✅ *Yangi versiya:* V" + text + "\n\n📝 Endi o'zgarishlar tavsifini kiriting:", { parse_mode: "Markdown" });
        return;
    }
    
    if (session.step === "admin_version_changes") {
        if (!isAdmin(userId)) {
            clearUserSession(userId);
            await sendMainMenu(chatId, false, deviceType);
            return;
        }
        
        if (text === "/cancel") {
            clearUserSession(userId);
            await bot.sendMessage(chatId, "❌ *Versiya yangilash bekor qilindi.*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, deviceType);
            return;
        }
        
        updateBotVersion(session.data.newVersion, text, userId);
        
        await bot.sendMessage(chatId, `✅ *Versiya yangilandi!*\n\n📌 Yangi versiya: \`V${session.data.newVersion}\`\n📝 O'zgarishlar: ${text}`, { parse_mode: "Markdown" });
        
        clearUserSession(userId);
        await sendMainMenu(chatId, true, deviceType);
        return;
    }
    
    // ========== 10. MUHOQOT REJIMIDA XABAR YOZISH ==========
    if (session.step === "conversation_mode" || session.data.inConversation) {
        if (isAdmin(userId)) {
            const targetUserId = session.data.replyingToUserId;
            if (targetUserId && text && !text.startsWith("/")) {
                addAdminReply(userId, targetUserId, text, "text", null);
                await bot.sendMessage(chatId, "✅ *Javob yuborildi!*", { parse_mode: "Markdown" });
                await bot.sendMessage(targetUserId, `👑 *Admin javobi:*\n\n${text}`, { parse_mode: "Markdown" });
                await showConversation(chatId, userId, true, targetUserId);
                return;
            }
        } else {
            if (text && !text.startsWith("/")) {
                addMessage(userId, ADMIN_IDS[0], text, "text", null);
                await bot.sendMessage(chatId, "✅ *Xabar yuborildi! Admin tez orada javob beradi.*\n\n💬 Davom eting:", { parse_mode: "Markdown" });
                
                const userInfo = user ? (user.fullName || user.phone) : "Foydalanuvchi";
                const adminMsg = `💬 *Yangi xabar*\n\n👤 ${userInfo}\n🆔 ID: ${userId}\n📝 Xabar: ${text}\n\n💬 Javob berish uchun "💬 Muloqotlar" tugmasini bosing!`;
                for (const adminId of ADMIN_IDS) {
                    await bot.sendMessage(adminId, adminMsg, { parse_mode: "Markdown" });
                }
                return;
            }
        }
    }
    
    if (photo) return;
    if (!text) return;
    if (text === "/start") return;
    if (text.startsWith("/")) return;
    
    // ========== 11. RO'YXATDAN O'TMAGAN FOYDALANUVCHI ==========
    if (!user) {
        await bot.sendMessage(chatId, "❌ Ro'yxatdan o'tmagansiz! Iltimos, /start bosing.", { parse_mode: "Markdown" });
        return;
    }
    
    if (user.isBlocked) {
        await bot.sendMessage(chatId, "🚫 *Siz botdan bloklangansiz!*", { parse_mode: "Markdown" });
        return;
    }
    
    // ========== 12. YANGI AVTOMOBIL QO'SHISH ==========
    if (session.step === "first_car_number") {
        const carNumber = text.toUpperCase().trim();
        
        if (carNumber.length < 2 || carNumber.length > 10) {
            await bot.sendMessage(chatId, "❌ *Noto'g'ri avtomobil raqami!*\n\n2-10 belgi kiriting:", { parse_mode: "Markdown" });
            return;
        }
        
        const userFullName = (session.data.firstName || "") + " " + (session.data.lastName || "");
        
        addNewUser(
            userId, 
            session.data.phone, 
            carNumber,
            session.data.firstName || "",
            session.data.lastName || "",
            session.data.username || ""
        );
        
        try {
            await sendReminder(chatId);
            await bot.sendMessage(chatId, "✅ *Ro'yxatdan o'tdingiz!*\n\n👤 " + (userFullName.trim() || "Mijoz") + "\n🚗 " + carNumber + "\n📞 " + session.data.phone + "\n📌 Versiya: `V" + currentVersion + "`\n\n🎁 Har 5 diagnostikada 1 BEPUL!", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, false, userId);
            
            for (const adminId of ADMIN_IDS) {
                bot.sendMessage(adminId, "🆕 *YANGI FOYDALANUVCHI!*\n\n👤 " + (userFullName.trim() || "Mijoz") + "\n📞 " + session.data.phone + "\n🚗 " + carNumber + "\n📌 Versiya: V" + currentVersion, { parse_mode: "Markdown" }).catch(() => {});
            }
        } catch (error) {
            console.error("Ro'yxatdan o'tkazish xatolik:", error);
        }
        clearUserSession(userId);
        return;
    }
    
    if (session.step === "add_new_car") {
        const carNumber = text.toUpperCase().trim();
        
        if (carNumber.length < 2 || carNumber.length > 10) {
            await bot.sendMessage(chatId, "❌ *Noto'g'ri raqam!*", { parse_mode: "Markdown" });
            return;
        }
        
        const result = addCarToUser(session.data.phone, carNumber);
        
        if (result.success) {
            await bot.sendMessage(chatId, "✅ *Yangi avtomobil qo'shildi!*\n\n🚗 " + carNumber, { parse_mode: "Markdown" });
        } else {
            await bot.sendMessage(chatId, "❌ " + result.message, { parse_mode: "Markdown" });
        }
        
        clearUserSession(userId);
        await sendMainMenu(chatId, false, userId);
        return;
    }
    // ========== 13. ADMIN DIAGNOSTIKA QO'SHISH ==========
    if (session.step === "admin_add_diagnostic") {
        if (!isAdmin(userId)) {
            clearUserSession(userId);
            await sendMainMenu(chatId, false, deviceType);
            return;
        }
        
        const carNumber = text.toUpperCase().trim();
        
        let foundUser = null;
        let foundCar = null;
        
        for (const userObj of users) {
            const car = userObj.cars.find(c => c.carNumber === carNumber);
            if (car) {
                foundUser = userObj;
                foundCar = car;
                break;
            }
        }
        
        if (!foundUser) {
            await bot.sendMessage(chatId, "❌ *Bunday avtomobil topilmadi!*", { parse_mode: "Markdown" });
            return;
        }
        
        session.data.targetUser = foundUser;
        session.data.targetCar = foundCar;
        session.step = "admin_work_description";
        
        await bot.sendMessage(chatId, "✅ Foydalanuvchi topildi:\n\n👤 " + (foundUser.fullName || "Ismsiz") + "\n🚗 " + foundCar.carNumber + "\n🎁 Bonus: " + foundCar.bonusCount + "/5\n🎉 Bepul: " + foundCar.freeDiagnostics + "\n\n🔧 *Asosiy bajarilgan ishlarni kiriting:*", { parse_mode: "Markdown" });
        return;
    }
    
    if (session.step === "admin_work_description") {
        if (!isAdmin(userId)) {
            clearUserSession(userId);
            await sendMainMenu(chatId, false, deviceType);
            return;
        }
        session.data.workDescription = text;
        session.step = "admin_extra_work_question";
        await bot.sendMessage(chatId, "✅ Asosiy ishlar qabul qilindi!\n\n➕ *Qo'shimcha mehnat (ish) bajarildimi?*\n\n🟢 Ha bo'lsa: 'ha' yoki 'bor' yozing\n🔴 Yo'q bo'lsa: 'yo'q' yoki 0 yozing\n\n❌ Bekor qilish: /cancel", { parse_mode: "Markdown" });
        return;
    }
    
    if (session.step === "admin_extra_work_question") {
        if (!isAdmin(userId)) {
            clearUserSession(userId);
            await sendMainMenu(chatId, false, deviceType);
            return;
        }
        
        const answer = text.toLowerCase().trim();
        
        if (answer === "/cancel") {
            clearUserSession(userId);
            await bot.sendMessage(chatId, "❌ *Bekor qilindi!*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, deviceType);
            return;
        }
        
        if (answer === "ha" || answer === "bor" || answer === "yes") {
            session.step = "admin_extra_work_price";
            await bot.sendMessage(chatId, "💰 *Qo'shimcha mehnat (ish) narxini kiriting:*\n\nMasalan: 50000 yoki 150000\n\n⚠️ Faqat son kiriting (so'mda)\n❌ Bekor qilish: /cancel", { parse_mode: "Markdown" });
        } else {
            session.data.extraWorkPrice = 0;
            session.data.extraWorkDescription = "";
            session.step = "admin_additional_notes";
            await bot.sendMessage(chatId, "✅ Qo'shimcha ish yo'q!\n\n📝 *Qo'shimcha eslatmalar kiriting* (ixtiyoriy):\n\n❌ Bekor qilish: /cancel", { parse_mode: "Markdown" });
        }
        return;
    }
    
    if (session.step === "admin_extra_work_price") {
        if (!isAdmin(userId)) {
            clearUserSession(userId);
            await sendMainMenu(chatId, false, deviceType);
            return;
        }
        
        if (text === "/cancel") {
            clearUserSession(userId);
            await bot.sendMessage(chatId, "❌ *Bekor qilindi!*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, deviceType);
            return;
        }
        
        const price = parseInt(text);
        if (isNaN(price) || price < 0) {
            await bot.sendMessage(chatId, "❌ *Noto'g'ri narx!* Iltimos, faqat son kiriting (masalan: 50000):", { parse_mode: "Markdown" });
            return;
        }
        
        session.data.extraWorkPrice = price;
        session.step = "admin_extra_work_description";
        await bot.sendMessage(chatId, "✅ Narx qabul qilindi: " + price.toLocaleString() + " so'm\n\n🔧 *Qo'shimcha mehnat (ish) tavsifini kiriting:*\n\nMasalan: 'Moy almashtirish', 'Filtr tozalash'\n\n❌ Bekor qilish: /cancel", { parse_mode: "Markdown" });
        return;
    }
    
    if (session.step === "admin_extra_work_description") {
        if (!isAdmin(userId)) {
            clearUserSession(userId);
            await sendMainMenu(chatId, false, deviceType);
            return;
        }
        
        if (text === "/cancel") {
            clearUserSession(userId);
            await bot.sendMessage(chatId, "❌ *Bekor qilindi!*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, deviceType);
            return;
        }
        
        session.data.extraWorkDescription = text;
        session.step = "admin_additional_notes";
        await bot.sendMessage(chatId, "✅ Qo'shimcha mehnat ma'lumotlari qabul qilindi!\n\n📝 *Qo'shimcha eslatmalar kiriting* (ixtiyoriy):\n\n❌ Bekor qilish: /cancel", { parse_mode: "Markdown" });
        return;
    }
    
    if (session.step === "admin_additional_notes") {
        if (!isAdmin(userId)) {
            clearUserSession(userId);
            await sendMainMenu(chatId, false, deviceType);
            return;
        }
        
        if (text === "/cancel") {
            clearUserSession(userId);
            await bot.sendMessage(chatId, "❌ *Bekor qilindi!*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, deviceType);
            return;
        }
        
        session.data.additionalNotes = text || "";
        
        const result = addDiagnosticToCar(
            session.data.targetUser.phone,
            session.data.targetCar.carNumber,
            session.data.workDescription,
            session.data.additionalNotes,
            session.data.extraWorkPrice || 0,
            session.data.extraWorkDescription || ""
        );
        
        let adminResponse = "🔧 *DIAGNOSTIKA QO'SHILDI*\n\n";
        adminResponse += "👤 " + (session.data.targetUser.fullName || "Ismsiz") + "\n";
        adminResponse += "🚗 " + result.carNumber + "\n";
        adminResponse += "📅 " + formatTashkentDate(new Date()) + "\n";
        adminResponse += "🕐 " + formatTashkentTime(new Date()) + "\n\n";
        adminResponse += "📝 *Asosiy bajarilgan ishlar:*\n" + session.data.workDescription + "\n\n";
        
        if (session.data.additionalNotes && session.data.additionalNotes !== "") {
            adminResponse += "📌 *Eslatma:*\n" + session.data.additionalNotes + "\n\n";
        }
        
        adminResponse += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        adminResponse += "💰 *NARXLAR:*\n";
        adminResponse += "   🔧 Diagnostika: " + (result.diagnosticPrice > 0 ? result.diagnosticPrice.toLocaleString() + " so'm" : "BEPUL") + "\n";
        if (result.laborPrice > 0) {
            adminResponse += "   🔨 Qo'shimcha mehnat: " + result.laborPrice.toLocaleString() + " so'm\n";
            adminResponse += "   📝 " + session.data.extraWorkDescription + "\n";
        }
        adminResponse += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        adminResponse += "💰 *JAMI:* " + result.totalPrice.toLocaleString() + " so'm\n\n";
        adminResponse += result.bonusMessage;
        
        await bot.sendMessage(chatId, adminResponse, { parse_mode: "Markdown" });
        
        let userMsg = "🔧 *DIAGNOSTIKA NATIJALARI*\n\n";
        userMsg += "🚗 *" + result.carNumber + "*\n";
        userMsg += "📅 " + formatTashkentDate(new Date()) + "\n";
        userMsg += "🕐 " + formatTashkentTime(new Date()) + "\n\n";
        userMsg += "📝 *Bajarilgan ishlar:*\n" + session.data.workDescription + "\n\n";
        
        if (session.data.additionalNotes && session.data.additionalNotes !== "") {
            userMsg += "📌 *Eslatma:*\n" + session.data.additionalNotes + "\n\n";
        }
        
        userMsg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        userMsg += "💰 *NARXLAR:*\n";
        userMsg += "   🔧 Diagnostika: " + (result.diagnosticPrice > 0 ? result.diagnosticPrice.toLocaleString() + " so'm" : "BEPUL") + "\n";
        if (result.laborPrice > 0) {
            userMsg += "   🔨 Qo'shimcha mehnat: " + result.laborPrice.toLocaleString() + " so'm\n";
            userMsg += "   📝 " + session.data.extraWorkDescription + "\n";
        }
        userMsg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        userMsg += "💰 *JAMI:* " + result.totalPrice.toLocaleString() + " so'm\n\n";
        userMsg += result.bonusMessage;
        
        await bot.sendMessage(session.data.targetUser.userId, userMsg, { parse_mode: "Markdown" }).catch(() => {});
        
        clearUserSession(userId);
        await sendMainMenu(chatId, true, deviceType);
        return;
    }
    
    // ========== 14. ADMIN QO'SHISH SESSION ==========
    if (session.step === "add_admin_permission") {
        if (text === "/cancel") {
            clearUserSession(userId);
            await bot.sendMessage(chatId, "❌ *Amal bekor qilindi.*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, deviceType);
            return;
        }
        
        const targetAdminId = parseInt(text);
        if (isNaN(targetAdminId)) {
            await bot.sendMessage(chatId, "❌ *Noto'g'ri ID!* Iltimos, faqat raqam kiriting.", { parse_mode: "Markdown" });
            return;
        }
        
        const result = grantEditPermission(userId, targetAdminId);
        await bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
        
        clearUserSession(userId);
        await sendMainMenu(chatId, true, deviceType);
        return;
    }
    
    // ========== 15. ADMIN MATNLI BUYRUQLAR ==========
    if (isAdmin(userId)) {
        if (text === "📊 Statistika") {
            const stats = getStatistics();
            
            let statMsg = "📊 *STATISTIKA* 📊\n";
            statMsg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
            statMsg += "👥 *FOYDALANUVCHILAR*\n";
            statMsg += `   👤 Faol: ${stats.totalUsers}\n`;
            statMsg += `   🚫 Bloklangan: ${stats.blockedUsers}\n`;
            statMsg += `   🚗 Avtomobillar: ${stats.totalCars}\n\n`;
            statMsg += "🔧 *DIAGNOSTIKA*\n";
            statMsg += `   📊 Jami: ${stats.totalDiagnostics} ta\n`;
            statMsg += `   💵 Diagnostika daromadi: ${stats.diagnosticIncome.toLocaleString()} so'm\n`;
            statMsg += `   🔨 Mehnat daromadi: ${stats.laborIncome.toLocaleString()} so'm\n\n`;
            statMsg += "💰 *JAMI DAROMAD*\n";
            statMsg += `   💵 Umumiy: ${stats.totalIncome.toLocaleString()} so'm\n\n`;
            statMsg += "📹 *VIDEO*\n";
            statMsg += `   🎬 Videolar: ${stats.totalVideos} ta\n\n`;
            statMsg += "ℹ️ *TEXNIK MA'LUMOT*\n";
            statMsg += `   📌 Versiya: \`V${stats.currentVersion}\`\n`;
            statMsg += `   💬 O'qilmagan xabarlar: ${stats.unreadMessages}\n`;
            statMsg += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
            statMsg += `© ${BOT_OWNER}`;
            
            await bot.sendMessage(chatId, statMsg, { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, userId);
        }
        else if (text === "👥 Foydalanuvchilar") {
            usersListPage = 0;
            await showUsersList(chatId, usersListPage);
        }
        else if (text === "🔧 Diagnostika") {
            const adminSession = getUserSession(userId);
            adminSession.step = "admin_add_diagnostic";
            await bot.sendMessage(chatId, "🔧 *Diagnostika qo'shish*\n\n🚗 Avtomobil raqamini kiriting:", { parse_mode: "Markdown", ...removeKeyboard() });
        }
        else if (text === "🎁 Bonusga yaqinlar") {
            const nearBonus = getNearBonusCars();
            if (nearBonus.length === 0) {
                await bot.sendMessage(chatId, "📭 Bonusga yaqin avtomobillar yo'q", { parse_mode: "Markdown" });
            } else {
                let msg = "🎁 *BONUSGA YAQINLAR*\n━━━━━━━━━━━━━━━━━━\n\n";
                nearBonus.forEach(c => {
                    msg += `👤 ${c.fullName}\n🚗 ${c.carNumber}\n🎁 ${c.bonusCount}/5\n📌 ${c.remaining} diagnostikadan keyin BEPUL\n━━━━━━━━━━━━━━━━━━\n`;
                });
                await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
            }
            await sendMainMenu(chatId, true, userId);
        }
        else if (text === "⚠️ Xatoliklar") {
            const errorsList = getErrors();
            if (errorsList.length === 0) {
                await bot.sendMessage(chatId, "✅ Xatoliklar yo'q", { parse_mode: "Markdown" });
            } else {
                let msg = "⚠️ *XATOLIKLAR*\n\n";
                errorsList.slice(0, 10).forEach(e => {
                    msg += `🚗 ${e.carNumber}\n📝 ${(e.errorDescription || "Xatolik").substring(0, 40)}\n📅 ${formatTashkentDate(e.date)}\n━━━━━━━━━━━━━━━━━━\n`;
                });
                await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
            }
            await sendMainMenu(chatId, true, userId);
        }
        else if (text === "📋 Diagnostika tarixi") {
            const diags = getAllDiagnostics(20);
            if (diags.length === 0) {
                await bot.sendMessage(chatId, "📭 Diagnostikalar yo'q", { parse_mode: "Markdown" });
            } else {
                for (const d of diags.slice(0, 10)) {
                    const msgText = formatDiagnosticMessage(d, true);
                    await bot.sendMessage(chatId, msgText, { parse_mode: "Markdown" });
                }
            }
            await sendMainMenu(chatId, true, userId);
        }
        else if (text === "📅 Bugungi") {
            const diags = getTodayDiagnostics();
            const keyboard = {
                inline_keyboard: [
                    [{ text: "📊 Bugungi diagnostikalar", callback_data: "today_diagnostics" }],
                    [{ text: "📈 Oylik daromad tahlili", callback_data: "monthly_income_analysis" }],
                    [{ text: "📅 Yillik daromad tahlili", callback_data: "yearly_income_analysis" }],
                    [{ text: "🔙 Ortga", callback_data: "back_to_main" }]
                ]
            };
            
            let msg = "📅 *DIAGNOSTIKA BO'LIMI*\n\n";
            if (diags.length === 0) {
                msg += "📭 Bugun diagnostika yo'q";
            } else {
                let diagIncome = 0, laborIncome = 0, freeCount = 0, laborCount = 0;
                for (const d of diags) {
                    const diagPrice = d.diagnosticPrice !== undefined ? d.diagnosticPrice : (d.isFree ? 0 : DIAGNOSTIC_PRICE);
                    if (diagPrice > 0) diagIncome += diagPrice;
                    else if (d.isFree) freeCount++;
                    const laborPrice = d.laborPrice || 0;
                    if (laborPrice > 0) {
                        laborIncome += laborPrice;
                        laborCount++;
                    }
                }
                msg += `📊 Bugungi diagnostikalar: ${diags.length} ta\n`;
                msg += `💰 Diagnostika daromadi: ${diagIncome.toLocaleString()} so'm\n`;
                msg += `🔨 Mehnat daromadi: ${laborIncome.toLocaleString()} so'm (${laborCount} ta ish)\n`;
                msg += `💵 Jami daromad: ${(diagIncome + laborIncome).toLocaleString()} so'm\n`;
                msg += `🎉 Bepul diagnostikalar: ${freeCount} ta\n`;
            }
            
            await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: keyboard });
        }
        else if (text === "📄 Hisobot") {
            await bot.sendMessage(chatId, "📄 *Hisobot tayyorlanmoqda...*", { parse_mode: "Markdown" });
            try {
                const allDiagnostics = getAllDiagnostics(500);
                const filepath = await generateDiagnosticsReport(allDiagnostics);
                await bot.sendDocument(chatId, filepath, { caption: "📊 Diagnostika va mehnat hisoboti\n📅 " + formatTashkentDateTime(new Date()) + "\n📌 Versiya: V" + currentVersion + "\n\n© " + BOT_OWNER });
                setTimeout(() => fs.unlinkSync(filepath), 60000);
            } catch (error) {
                await bot.sendMessage(chatId, "❌ *Xatolik!*", { parse_mode: "Markdown" });
            }
            await sendMainMenu(chatId, true, userId);
        }
        else if (text === "📹 Video galereya") {
            await showVideoGallery(chatId);
            await sendMainMenu(chatId, true, userId);
        }
        else if (text === "📤 Video yuklash") {
            const adminSession = getUserSession(userId);
            adminSession.step = "admin_waiting_video";
            adminSession.data = {};
            await bot.sendMessage(chatId, "📤 *VIDEO YUKLASH*\n\nIltimos, video faylni yuboring:\n\n💡 Maslahat: \n• MP4, AVI, MOV formatlarida\n• Video hajmi 50MB dan kichik bo'lishi kerak!\n\n❌ Bekor qilish: /cancel", { parse_mode: "Markdown" });
        }
        else if (text === "🗑️ Video o'chirish") {
            if (!isAdmin(userId)) return;
            await showVideoManagement(chatId);
        }
        else if (text === "💾 Backup") {
            await bot.sendMessage(chatId, "💾 *Backup yaratilmoqda...*", { parse_mode: "Markdown" });
            createBackup();
            await bot.sendMessage(chatId, "✅ *Backup yaratildi!*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, userId);
        }
        else if (text === "🔄 Tiklash") {
            const backups = listBackups();
            if (backups.length === 0) {
                await bot.sendMessage(chatId, "❌ *Backup topilmadi!*", { parse_mode: "Markdown" });
                await sendMainMenu(chatId, true, userId);
            } else {
                let msg = "🔄 *DATABASE TIKLASH*\n\nBackup tanlang:\n\n";
                const keyboard = backups.slice(0, 10).map(b => [{ text: "📁 " + b.name.substring(0, 30), callback_data: "restore_" + b.name }]);
                keyboard.push([{ text: "❌ Bekor qilish", callback_data: "restore_cancel" }]);
                await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
            }
        }
        else if (text === "🚫 Foyd. boshqarish") {
            const activeUsers = getActiveUsers();
            const blockedUsers = getBlockedUsers();
            const allUsers = [...activeUsers, ...blockedUsers].filter(u => u.cars && u.cars.length > 0);
            
            if (allUsers.length === 0) {
                await bot.sendMessage(chatId, "📭 *Avtomobili bo'lgan foydalanuvchilar yo'q!*", { parse_mode: "Markdown" });
                await sendMainMenu(chatId, true, userId);
                return;
            }
            
            const totalPages = Math.ceil(allUsers.length / USERS_PER_PAGE);
            if (userManagePage >= totalPages) userManagePage = 0;
            
            const start = userManagePage * USERS_PER_PAGE;
            const end = start + USERS_PER_PAGE;
            const pageUsers = allUsers.slice(start, end);
            
            let msg = `👥 *FOYDALANUVCHILARNI BOSHQARISH*\n`;
            msg += `🚗 *Avtomobili bo'lganlar:* ${allUsers.length} ta\n`;
            msg += `📄 Sahifa ${userManagePage + 1}/${totalPages}\n`;
            msg += "━━━━━━━━━━━━━━━━━━\n\n";
            
            const keyboard = [];
            let row = [];
            
            for (let i = 0; i < pageUsers.length; i++) {
                const userObj = pageUsers[i];
                const num = start + i + 1;
                const status = userObj.isBlocked ? "🔴" : "🟢";
                const carNumber = userObj.cars[0].carNumber;
                const displayText = `${status} ${num}. ${carNumber}`;
                row.push({ text: displayText.substring(0, 20), callback_data: `manage_user_${userObj.userId}` });
                if (row.length === 2) {
                    keyboard.push([...row]);
                    row = [];
                }
            }
            if (row.length > 0) keyboard.push([...row]);
            
            const navButtons = [];
            if (userManagePage > 0) navButtons.push({ text: "◀️ Oldingi", callback_data: "user_page_prev" });
            if (end < allUsers.length) navButtons.push({ text: "Keyingi ▶️", callback_data: "user_page_next" });
            if (navButtons.length > 0) keyboard.push(navButtons);
            keyboard.push([{ text: "🔙 Ortga", callback_data: "admin_manage_users_back" }]);
            
            await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
        }
        else if (text === "🔐 Xavfsizlik") {
            if (!isSuperAdmin(userId) && !canEditCode(userId)) {
                await bot.sendMessage(chatId, "❌ *Ruxsat yo'q!*", { parse_mode: "Markdown" });
                await sendMainMenu(chatId, true, userId);
                return;
            }
            const keyboard = [
                [{ text: "👥 Ruxsat berilgan adminlar", callback_data: "security_allowed_admins" }],
                [{ text: "➕ Admin qo'shish", callback_data: "security_add_admin" }],
                [{ text: "➖ Admin o'chirish", callback_data: "security_remove_admin" }],
                [{ text: "📜 Xavfsizlik jurnali", callback_data: "security_log" }],
                [{ text: "🔙 Orqaga", callback_data: "security_back" }]
            ];
            await bot.sendMessage(chatId, "🔐 *XAVFSIZLIK SOZLAMALARI*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
        }
        else if (text === "📌 Versiya") {
            const versionInfo = getVersionInfo();
            let msg = "📌 *VERSIYA MA'LUMOTLARI*\n\n";
            msg += `🔹 Joriy versiya: \`V${versionInfo.currentVersion}\`\n`;
            msg += `🔹 Yangi bot linki: ${NEW_BOT_LINK}\n\n`;
            
            if (versionHistory.length > 0) {
                msg += "📜 *O'ZGARISHLAR TARIXI*\n━━━━━━━━━━━━━━━━━━\n\n";
                versionHistory.slice(0, 10).forEach(v => {
                    msg += `📌 Versiya: \`V${v.version}\`\n`;
                    msg += `📅 Sana: ${formatTashkentDate(v.date)}\n`;
                    msg += `📝 O'zgarish: ${v.changes.substring(0, 50)}${v.changes.length > 50 ? "..." : ""}\n`;
                    msg += "━━━━━━━━━━━━━━━━━━\n";
                });
            }
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: "🔄 Versiyani yangilash (KOD O'ZGARGANDA)", callback_data: "admin_update_version" }],
                    [{ text: "🔙 Ortga", callback_data: "back_to_main" }]
                ]
            };
            await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: keyboard });
        }
        else if (text === "📢 Xabar yuborish") {
            const adminSession = getUserSession(userId);
            adminSession.step = "admin_send_message";
            await bot.sendMessage(chatId, "📢 *XABAR YUBORISH*\n\nBarcha foydalanuvchilarga yuboriladigan xabarni kiriting:\n\n❌ Bekor qilish uchun /cancel yozing.", { parse_mode: "Markdown" });
        }
        // ==================== MUHIM: "💬 Muloqotlar" TUGMASI ====================
        else if (text === "💬 Muloqotlar") {
            await showAllConversations(chatId, 0);
            return;
        }
        else if (text === "❌ Asosiy menyu") {
            clearUserSession(userId);
            userManagePage = 0;
            usersListPage = 0;
            await sendMainMenu(chatId, true, userId);
        }
        else if (!session.step) {
            await bot.sendMessage(chatId, "❌ *Tushunarsiz buyruq!*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, userId);
        }
        return;
    }
    
    // ========== 16. FOYDALANUVCHI MATN YUBORSA ==========
    if (!session.step) {
        await bot.sendMessage(chatId, "❌ *Iltimos, tugmalardan foydalaning!*", { parse_mode: "Markdown" });
        await sendMainMenu(chatId, false, userId);
    }
});
// -------------------- CALLBACK QUERY HANDLER --------------------
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = query.from.id;
    const messageId = query.message.message_id;
    
    await bot.answerCallbackQuery(query.id);
    
    const user = getUserByUserId(userId);
    if (!user && data !== "back_to_main" && !data.startsWith("open_conversation_") && !data.startsWith("conversations_page_")) {
        await bot.sendMessage(chatId, "❌ Ro'yxatdan o'tmagan! /start bosing.");
        return;
    }
    
    const deviceType = getUserDevice(userId);
    
    // ========== 1. MUHOQOT CALLBACKLARI ==========
    if (data === "user_contact_admin") {
        const session = getUserSession(userId);
        session.step = "conversation_mode";
        session.data.inConversation = true;
        
        await bot.sendMessage(chatId, "💬 *Admin bilan bog'lanish*\n\nXabaringizni yozing. Admin sizga javob beradi.\n\n📍 Lokatsiya yuborish uchun tugmani bosing.\n\n🔙 Bekor qilish tugmasini bosing.", {
            parse_mode: "Markdown",
            ...getLocationKeyboard()
        });
        return;
    }
    
    if (data.startsWith("open_conversation_")) {
        if (!isAdmin(userId)) return;
        const targetUserId = parseInt(data.split("_")[2]);
        const session = getUserSession(userId);
        session.step = "conversation_mode";
        session.data.inConversation = true;
        session.data.replyingToUserId = targetUserId;
        await showConversation(chatId, userId, true, targetUserId);
        return;
    }
    
    if (data.startsWith("conversations_page_")) {
        if (!isAdmin(userId)) return;
        const page = parseInt(data.split("_")[2]);
        await showAllConversations(chatId, page);
        return;
    }
    
    // ========== 2. VIDEO O'CHIRISH CALLBACKLARI ==========
    if (data.startsWith("delete_video_")) {
        if (!isAdmin(userId)) return;
        const videoId = parseInt(data.split("_")[2]);
        const confirmKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Ha, o'chirish", callback_data: "confirm_delete_video_" + videoId }],
                    [{ text: "❌ Yo'q, bekor qilish", callback_data: "video_manage_back" }]
                ]
            }
        };
        const video = videoList.find(v => v.id === videoId);
        if (video) {
            await bot.sendMessage(chatId, `⚠️ *DIQQAT!*\n\n"${video.title}" nomli videoni o'chirmoqchisiz?\nBu amal ortga qaytmaydi!`, {
                parse_mode: "Markdown",
                ...confirmKeyboard
            });
        }
        return;
    }
    
    if (data.startsWith("confirm_delete_video_")) {
        if (!isAdmin(userId)) return;
        const videoId = parseInt(data.split("_")[3]);
        const result = deleteVideo(videoId, userId);
        await bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
        await showVideoManagement(chatId);
        return;
    }
    
    if (data === "video_manage_back") {
        await showVideoManagement(chatId);
        return;
    }
    
    if (data.startsWith("video_manage_page_")) {
        if (!isAdmin(userId)) return;
        const page = parseInt(data.split("_")[3]);
        await showVideoManagement(chatId, page);
        return;
    }
    
    // ========== 3. VIDEO KO'RISH CALLBACKLARI ==========
    if (data.startsWith("watch_video_")) {
        const videoId = parseInt(data.split("_")[2]);
        const video = videoList.find(v => v.id === videoId);
        
        if (!video || !video.isActive) {
            await bot.sendMessage(chatId, "❌ *Video topilmadi yoki o'chirilgan!*", { parse_mode: "Markdown" });
            return;
        }
        
        updateVideoViews(videoId);
        
        const videoText = "📹 *" + video.title + "*\n\n" + (video.description || "📝 Tavsif mavjud emas") + "\n\n👁️ Ko'rishlar: " + (video.views || 0) + " | 👍 Layklar: " + (video.likes || 0) + "\n\n© " + BOT_OWNER + "\n📌 Versiya: V" + currentVersion;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: "👍 Like (" + (video.likes || 0) + ")", callback_data: "like_video_" + videoId }],
                [{ text: "📹 Boshqa videolar", callback_data: "user_video_gallery" }],
                [{ text: "🔙 Asosiy menyu", callback_data: "back_to_main" }]
            ]
        };
        
        try {
            if (!video.fileId) {
                throw new Error("Video fayl ID topilmadi!");
            }
            await bot.sendVideo(chatId, video.fileId, { 
                caption: videoText, 
                parse_mode: "Markdown",
                reply_markup: keyboard
            });
        } catch (err) {
            console.error("Video yuborish xatolik:", err);
            await bot.sendMessage(chatId, "❌ *Video yuborishda xatolik!*", { parse_mode: "Markdown" });
        }
        return;
    }
    
    if (data.startsWith("like_video_")) {
        const videoId = parseInt(data.split("_")[2]);
        const success = updateVideoLikes(videoId, userId);
        const video = videoList.find(v => v.id === videoId);
        if (success) {
            await bot.answerCallbackQuery(query.id, { text: "👍 Layk qo'shildi! Hozirgi layklar: " + (video?.likes || 0), show_alert: false });
        } else {
            await bot.answerCallbackQuery(query.id, { text: "❌ Siz allaqachon layk bosgansiz!", show_alert: true });
        }
        return;
    }
    
    if (data.startsWith("video_page_")) {
        const page = parseInt(data.split("_")[2]);
        await showVideoGallery(chatId, page);
        return;
    }
    
    // ========== 4. BACKUP CALLBACKLARI ==========
    if (data.startsWith("restore_")) {
        if (!isAdmin(userId)) return;
        const backupName = data.replace("restore_", "");
        await bot.sendMessage(chatId, "🔄 *Database tiklanmoqda...*", { parse_mode: "Markdown" });
        if (restoreBackup(backupName)) {
            loadData();
            loadVideos();
            loadConversations();
            loadVersionHistory();
            await bot.sendMessage(chatId, "✅ *Database tiklandi!*", { parse_mode: "Markdown" });
        } else {
            await bot.sendMessage(chatId, "❌ *Xatolik!*", { parse_mode: "Markdown" });
        }
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    if (data === "restore_cancel") {
        if (!isAdmin(userId)) return;
        await bot.sendMessage(chatId, "❌ *Bekor qilindi.*", { parse_mode: "Markdown" });
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    // ========== 5. FOYDALANUVCHI CALLBACKLARI ==========
    if (data === "user_profile") {
        const carsList = user.cars.map(c => "🚗 " + c.carNumber + " (" + c.totalDiagnostics + " ta)").join("\n");
        await bot.sendMessage(chatId, "📊 *MENGING SAHIFAM*\n\n👤 *Ism:* " + (user.fullName || "Kiritilmagan") + "\n📞 *Telefon:* " + user.phone + "\n🚗 *Avtomobillar:* " + user.cars.length + "/" + MAX_CARS_PER_USER + "\n\n" + carsList + "\n\n🎁 *Bonus:* " + (user.totalBonusCount || 0) + "\n🎉 *Bepul:* " + (user.totalFreeDiagnostics || 0) + " ta\n📊 *Jami:* " + (user.totalDiagnosticsAll || 0) + " ta\n📌 *Versiya:* `V" + currentVersion + "`", { parse_mode: "Markdown" });
        await sendMainMenu(chatId, false, userId);
        return;
    }
    
    if (data === "user_my_cars") {
        if (user.cars.length === 0) {
            await bot.sendMessage(chatId, "📭 Sizda hali avtomobillar mavjud emas!", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, false, userId);
            return;
        }
        let carsText = "🚗 *MENGING AVTOMOBILLARIM*\n📌 5 diagnostika = 1 BEPUL\n━━━━━━━━━━━━━━━━━━\n\n";
        for (const car of user.cars) {
            carsText += "🚗 *" + car.carNumber + "*\n";
            carsText += "🎁 Bonus: " + car.bonusCount + "/5\n";
            carsText += "🎉 Bepul: " + car.freeDiagnostics + " ta\n";
            carsText += "📊 Diagnostika: " + car.totalDiagnostics + " ta\n";
            if (car.freeDiagnostics > 0) {
                carsText += "✅ *Bepul mavjud!*\n";
            }
            carsText += "━━━━━━━━━━━━━━━━━━\n";
        }
        await bot.sendMessage(chatId, carsText, { parse_mode: "Markdown" });
        await sendMainMenu(chatId, false, userId);
        return;
    }
    
    if (data === "user_my_bonus") {
        let bonusText = "🎁 *MENGING BONUSLARIM*\n📌 Har 5 diagnostikada 1 BEPUL\n━━━━━━━━━━━━━━━━━━\n\n";
        for (const car of user.cars) {
            bonusText += "🚗 *" + car.carNumber + "*\n";
            bonusText += "📊 To'plangan: " + car.bonusCount + "/5\n";
            bonusText += "🎉 Bepul: " + car.freeDiagnostics + " ta\n";
            if (car.freeDiagnostics > 0) {
                bonusText += "✅ Sizda BEPUL diagnostika bor!\n";
            }
            bonusText += "━━━━━━━━━━━━━━━━━━\n";
        }
        await bot.sendMessage(chatId, bonusText, { parse_mode: "Markdown" });
        await sendMainMenu(chatId, false, userId);
        return;
    }
    
    if (data === "user_add_car") {
        if (user.cars.length >= MAX_CARS_PER_USER) {
            await bot.sendMessage(chatId, "❌ Maksimum " + MAX_CARS_PER_USER + " ta avtomobil!", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, false, userId);
            return;
        }
        const session = getUserSession(userId);
        session.step = "add_new_car";
        session.data.phone = user.phone;
        session.data.firstName = user.firstName;
        session.data.lastName = user.lastName;
        session.data.username = user.username;
        await bot.sendMessage(chatId, "🚗 *Yangi avtomobil raqamini kiriting:*\n\nMasalan: 01A777AA", {
            parse_mode: "Markdown",
            reply_markup: { remove_keyboard: true }
        });
        return;
    }
    
    if (data === "user_history") {
        const diags = diagnostics.filter(d => d.phoneNumber === user.phone).slice(-10).reverse();
        if (diags.length === 0) {
            await bot.sendMessage(chatId, "📭 *Sizda hali diagnostikalar mavjud emas!*", { parse_mode: "Markdown" });
        } else {
            for (const d of diags) {
                await bot.sendMessage(chatId, formatDiagnosticMessage(d), { parse_mode: "Markdown" });
            }
        }
        await sendMainMenu(chatId, false, userId);
        return;
    }
    
    if (data === "user_video_gallery") {
        await showVideoGallery(chatId);
        await sendMainMenu(chatId, false, userId);
        return;
    }
    
    if (data === "user_payment") {
        await bot.sendMessage(chatId, getCardInfoMessage(), {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🏦 Karta raqamini ko'rish", callback_data: "show_card_number" }],
                    [{ text: "🔙 Ortga", callback_data: "back_to_main" }]
                ]
            }
        });
        return;
    }
    
    if (data === "show_card_number") {
        await bot.sendMessage(chatId, getCardInfoMessage(), {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📋 Karta raqamini nusxalash", callback_data: "copy_card_number" }],
                    [{ text: "🔙 Ortga", callback_data: "user_payment" }]
                ]
            }
        });
        return;
    }
    
    if (data === "copy_card_number") {
        await bot.sendMessage(chatId, `💳 *Karta raqami:* \`${CARD_NUMBER}\`\n\n👤 *Karta egasi:* ${CARD_OWNER}`, { parse_mode: "Markdown" });
        return;
    }
    
    if (data === "user_instagram") {
        await bot.sendMessage(chatId, "📸 *BIZNING INSTAGRAM*\n\n🔗 " + INSTAGRAM_LINK, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "📸 Instagramga o'tish", url: INSTAGRAM_LINK }]] }
        });
        await sendMainMenu(chatId, false, userId);
        return;
    }
    
    if (data === "user_telegram_group") {
        await bot.sendMessage(chatId, "👥 *TELEGRAM GURUHIMIZ*\n\n🔗 " + TELEGRAM_GROUP_LINK, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "👥 Guruhga o'tish", url: TELEGRAM_GROUP_LINK }]] }
        });
        await sendMainMenu(chatId, false, userId);
        return;
    }
    
    if (data === "user_info") {
        await bot.sendMessage(chatId, "ℹ️ *ISUZU DOCTOR BOT*\n\n🚗 Avtomobil diagnostikasi\n🎁 Har 5 diagnostikada 1 ta BEPUL\n📱 " + MAX_CARS_PER_USER + " tagacha avtomobil\n📞 Aloqa: " + ADMIN_PHONE + "\n📌 Versiya: `V" + currentVersion + "`\n\n© " + BOT_OWNER, { parse_mode: "Markdown" });
        await sendMainMenu(chatId, false, userId);
        return;
    }
    
    if (data === "user_version_info") {
        let msg = "📌 *BOT VERSIYASI*\n\n";
        msg += `🔹 Joriy versiya: \`V${currentVersion}\`\n`;
        msg += `🔹 Bu versiya faqat KOD O'ZGARGANDA yangilanadi!`;
        const keyboard = { inline_keyboard: [[{ text: "🔙 Ortga", callback_data: "back_to_main" }]] };
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: keyboard });
        return;
    }
    
    // ========== 6. ADMIN CALLBACKLARI ==========
    if (data === "admin_update_version") {
        if (!isAdmin(userId)) return;
        const session = getUserSession(userId);
        session.step = "admin_update_version";
        await bot.sendMessage(chatId, "🔄 *VERSIYANI YANGILASH (KOD O'ZGARGANDA)*\n\nYangi versiya raqamini kiriting (masalan: 2.2):\n\n❌ Bekor qilish: /cancel", { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } });
        return;
    }
    
    if (data === "today_diagnostics") {
        const diags = getTodayDiagnostics();
        if (diags.length === 0) {
            await bot.sendMessage(chatId, "📭 *Bugun diagnostika yo'q*", { parse_mode: "Markdown" });
        } else {
            let msg = "📅 *BUGUNGI DIAGNOSTIKALAR*\n━━━━━━━━━━━━━━━━━━\n\n";
            let diagnosticIncome = 0, laborIncome = 0, freeCount = 0;
            for (const d of diags) {
                await bot.sendMessage(chatId, formatDiagnosticMessage(d, true), { parse_mode: "Markdown" });
                const diagPrice = d.diagnosticPrice !== undefined ? d.diagnosticPrice : (d.isFree ? 0 : DIAGNOSTIC_PRICE);
                if (diagPrice > 0) diagnosticIncome += diagPrice;
                else if (d.isFree) freeCount++;
                if (d.laborPrice) laborIncome += d.laborPrice;
            }
            msg += `\n📊 *JAMI:*\n💰 Diagnostika: ${diagnosticIncome.toLocaleString()} so'm\n🔨 Mehnat: ${laborIncome.toLocaleString()} so'm\n💵 Umumiy: ${(diagnosticIncome + laborIncome).toLocaleString()} so'm\n🎉 Bepul: ${freeCount} ta\n`;
            await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
        }
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    if (data === "monthly_income_analysis") {
        const monthsData = getAllMonthsIncome();
        if (monthsData.length === 0 || monthsData.every(m => m.totalDiagnostics === 0)) {
            await bot.sendMessage(chatId, "📭 *Hozircha daromad ma'lumotlari mavjud emas!*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, userId);
            return;
        }
        let msg = "📈 *OYLIK DAROMAD TAHLILI*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
        for (const month of monthsData) {
            if (month.totalDiagnostics > 0) {
                const monthName = formatMonthName(month.year, month.month);
                msg += `📅 *${monthName}*\n`;
                msg += `🔧 Diagnostika: ${month.diagnosticIncome.toLocaleString()} so'm\n`;
                msg += `🔨 Mehnat: ${month.laborIncome.toLocaleString()} so'm\n`;
                msg += `💰 Jami: ${month.totalIncome.toLocaleString()} so'm\n`;
                msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
            }
        }
        const keyboard = {
            inline_keyboard: [
                [{ text: "📊 Batafsil statistika", callback_data: "detailed_monthly_stats" }],
                [{ text: "📅 Yillik tahlil", callback_data: "yearly_income_analysis" }],
                [{ text: "🔙 Ortga", callback_data: "back_to_main" }]
            ]
        };
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: keyboard });
        return;
    }
    
    if (data === "yearly_income_analysis") {
        const years = getAvailableYears();
        if (years.length === 0) {
            await bot.sendMessage(chatId, "📭 *Hozircha daromad ma'lumotlari mavjud emas!*", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, userId);
            return;
        }
        let msg = "📅 *YILLIK DAROMAD TAHLILI*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
        for (const year of years) {
            const yearData = getYearlyIncome(year);
            if (yearData.totalDiagnostics > 0) {
                msg += `📌 *${year}-YIL*\n`;
                msg += `🔧 Diagnostika: ${yearData.diagnosticIncome.toLocaleString()} so'm\n`;
                msg += `🔨 Mehnat: ${yearData.laborIncome.toLocaleString()} so'm\n`;
                msg += `💰 Umumiy: ${yearData.totalIncome.toLocaleString()} so'm\n`;
                msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
            }
        }
        const keyboard = {
            inline_keyboard: [
                [{ text: "📊 Oy bo'yicha batafsil", callback_data: "monthly_income_analysis" }],
                [{ text: "🔙 Ortga", callback_data: "back_to_main" }]
            ]
        };
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: keyboard });
        return;
    }
    
    if (data === "detailed_monthly_stats") {
        const monthsData = getAllMonthsIncome();
        let msg = "📊 *BATAFSIL OYLIK STATISTIKA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
        for (const month of monthsData) {
            if (month.totalDiagnostics > 0) {
                const monthName = formatMonthName(month.year, month.month);
                const maxValue = Math.max(...monthsData.map(m => m.totalIncome), 1);
                const barLength = Math.min(30, Math.floor((month.totalIncome / maxValue) * 30));
                const bar = "█".repeat(barLength) + "░".repeat(30 - barLength);
                msg += `📅 *${monthName}*\n`;
                msg += `💰 Jami: ${month.totalIncome.toLocaleString()} so'm\n`;
                msg += `${bar}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            }
        }
        const keyboard = { inline_keyboard: [[{ text: "🔙 Ortga", callback_data: "monthly_income_analysis" }]] };
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: keyboard });
        return;
    }
    
    if (data === "users_page_prev") {
        if (usersListPage > 0) {
            usersListPage--;
            await showUsersList(chatId, usersListPage, messageId);
        }
        return;
    }
    
    if (data === "users_page_next") {
        const usersList = getAllUsersWithDetails();
        const totalPages = Math.ceil(usersList.length / USERS_PER_PAGE);
        if (usersListPage + 1 < totalPages) {
            usersListPage++;
            await showUsersList(chatId, usersListPage, messageId);
        }
        return;
    }
    
    if (data === "user_page_prev") {
        if (userManagePage > 0) {
            userManagePage--;
            const activeUsers = getActiveUsers();
            const blockedUsers = getBlockedUsers();
            const allUsers = [...activeUsers, ...blockedUsers].filter(u => u.cars && u.cars.length > 0);
            const totalPages = Math.ceil(allUsers.length / USERS_PER_PAGE);
            const start = userManagePage * USERS_PER_PAGE;
            const pageUsers = allUsers.slice(start, start + USERS_PER_PAGE);
            let msg = `👥 *FOYDALANUVCHILARNI BOSHQARISH*\n📄 Sahifa ${userManagePage + 1}/${totalPages}\n━━━━━━━━━━━━━━━━━━\n\n`;
            const keyboard = [];
            for (let i = 0; i < pageUsers.length; i++) {
                const u = pageUsers[i];
                const status = u.isBlocked ? "🔴" : "🟢";
                const carNumber = u.cars[0].carNumber;
                msg += `${status} ${start + i + 1}. ${carNumber}\n`;
                keyboard.push([{ text: `${status} ${start + i + 1}. ${carNumber}`, callback_data: `manage_user_${u.userId}` }]);
            }
            const nav = [];
            if (userManagePage > 0) nav.push({ text: "◀️ Oldingi", callback_data: "user_page_prev" });
            if (start + USERS_PER_PAGE < allUsers.length) nav.push({ text: "Keyingi ▶️", callback_data: "user_page_next" });
            if (nav.length) keyboard.push(nav);
            keyboard.push([{ text: "🔙 Ortga", callback_data: "admin_manage_users_back" }]);
            await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
        }
        return;
    }
    
    if (data === "user_page_next") {
        const activeUsers = getActiveUsers();
        const blockedUsers = getBlockedUsers();
        const allUsers = [...activeUsers, ...blockedUsers].filter(u => u.cars && u.cars.length > 0);
        const totalPages = Math.ceil(allUsers.length / USERS_PER_PAGE);
        if (userManagePage + 1 < totalPages) {
            userManagePage++;
            const start = userManagePage * USERS_PER_PAGE;
            const pageUsers = allUsers.slice(start, start + USERS_PER_PAGE);
            let msg = `👥 *FOYDALANUVCHILARNI BOSHQARISH*\n📄 Sahifa ${userManagePage + 1}/${totalPages}\n━━━━━━━━━━━━━━━━━━\n\n`;
            const keyboard = [];
            for (let i = 0; i < pageUsers.length; i++) {
                const u = pageUsers[i];
                const status = u.isBlocked ? "🔴" : "🟢";
                const carNumber = u.cars[0].carNumber;
                msg += `${status} ${start + i + 1}. ${carNumber}\n`;
                keyboard.push([{ text: `${status} ${start + i + 1}. ${carNumber}`, callback_data: `manage_user_${u.userId}` }]);
            }
            const nav = [];
            if (userManagePage > 0) nav.push({ text: "◀️ Oldingi", callback_data: "user_page_prev" });
            if (start + USERS_PER_PAGE < allUsers.length) nav.push({ text: "Keyingi ▶️", callback_data: "user_page_next" });
            if (nav.length) keyboard.push(nav);
            keyboard.push([{ text: "🔙 Ortga", callback_data: "admin_manage_users_back" }]);
            await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
        }
        return;
    }
    
    if (data === "admin_manage_users_back") {
        userManagePage = 0;
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    if (data === "security_allowed_admins") {
        let msg = "👥 *RUXSAT BERILGAN ADMINLAR*\n━━━━━━━━━━━━━━━━━━\n\n";
        if (adminSettings.allowedEditors.length === 0) {
            msg += "Hech qanday admin ruxsatga ega emas.";
        } else {
            adminSettings.allowedEditors.forEach((adminId, index) => {
                const adminUser = getUserByUserId(adminId);
                msg += (index + 1) + ". ID: " + adminId + "\n";
                if (adminUser) msg += "👤 " + (adminUser.fullName || adminUser.phone) + "\n";
                msg += "━━━━━━━━━━━━━━━━━━\n";
            });
        }
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
        return;
    }
    
    if (data === "security_add_admin") {
        if (!isSuperAdmin(userId)) {
            await bot.sendMessage(chatId, "❌ Faqat Super Admin!", { parse_mode: "Markdown" });
            return;
        }
        await bot.sendMessage(chatId, "➕ *ADMIN QO'SHISH*\n\nTelegram ID sini yuboring:\n❌ Bekor qilish: /cancel", { parse_mode: "Markdown" });
        const session = getUserSession(userId);
        session.step = "add_admin_permission";
        return;
    }
    
    if (data === "security_remove_admin") {
        if (!isSuperAdmin(userId)) {
            await bot.sendMessage(chatId, "❌ Faqat Super Admin!", { parse_mode: "Markdown" });
            return;
        }
        if (adminSettings.allowedEditors.length === 0) {
            await bot.sendMessage(chatId, "❌ *Hech qanday admin yo'q!*", { parse_mode: "Markdown" });
            return;
        }
        let msg = "➖ *ADMIN O'CHIRISH*\n\nTanlang:\n\n";
        const keyboard = [];
        adminSettings.allowedEditors.forEach(adminId => {
            const adminUser = getUserByUserId(adminId);
            const name = adminUser ? (adminUser.fullName || adminUser.phone) : ("ID: " + adminId);
            keyboard.push([{ text: "❌ " + name.substring(0, 30), callback_data: "remove_admin_" + adminId }]);
        });
        keyboard.push([{ text: "🔙 Orqaga", callback_data: "security_back" }]);
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
        return;
    }
    
    if (data === "security_log") {
        let msg = "📜 *XAVFSIZLIK JURNALI*\n━━━━━━━━━━━━━━━━━━\n\n";
        if (adminSettings.securityLog.length === 0) {
            msg += "Hech qanday hodisa yo'q.";
        } else {
            adminSettings.securityLog.slice(0, 15).forEach(log => {
                msg += "📅 " + formatTashkentDateTime(log.date) + "\n";
                msg += "🔹 " + log.action + "\n";
                msg += "📝 " + log.details + "\n";
                msg += "━━━━━━━━━━━━━━━━━━\n";
            });
        }
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
        return;
    }
    
    if (data === "security_back") {
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    if (data.startsWith("remove_admin_")) {
        if (!isSuperAdmin(userId)) {
            await bot.sendMessage(chatId, "❌ Faqat Super Admin!", { parse_mode: "Markdown" });
            return;
        }
        const targetAdminId = parseInt(data.split("_")[2]);
        const result = revokeEditPermission(userId, targetAdminId);
        await bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    if (data.startsWith("manage_user_")) {
        const targetUserId = parseInt(data.split("_")[2]);
        let targetUser = getUserByUserId(targetUserId);
        if (!targetUser) targetUser = users.find(u => u.userId == targetUserId);
        if (!targetUser) {
            await bot.sendMessage(chatId, "❌ *Foydalanuvchi topilmadi!*", { parse_mode: "Markdown" });
            return;
        }
        const carsList = targetUser.cars.map(c => c.carNumber).join(", ");
        const userInfo = `👤 *${targetUser.fullName || "Ismsiz"}*\n📞 ${targetUser.phone}\n🚗 ${carsList || "Yo'q"}\n📊 ${targetUser.totalDiagnosticsAll || 0} ta\n🚦 ${targetUser.isBlocked ? "🔴 BLOKLANGAN" : "🟢 FAOL"}\n🆔 ID: ${targetUser.userId}`;
        const keyboard = [];
        if (targetUser.isBlocked) {
            keyboard.push([{ text: "✅ Blokdan ochish", callback_data: `unblock_user_${targetUser.userId}` }]);
        } else {
            keyboard.push([{ text: "🚫 Bloklash", callback_data: `block_user_${targetUser.userId}` }]);
        }
        keyboard.push([{ text: "🗑️ O'chirish", callback_data: `delete_user_${targetUser.userId}` }]);
        keyboard.push([{ text: "🔙 Orqaga", callback_data: "admin_manage_users_back" }]);
        await bot.editMessageText(userInfo, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
        return;
    }
    
    if (data.startsWith("block_user_")) {
        const targetUserId = parseInt(data.split("_")[2]);
        const result = blockUser(targetUserId);
        await bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    if (data.startsWith("unblock_user_")) {
        const targetUserId = parseInt(data.split("_")[2]);
        const result = unblockUser(targetUserId);
        await bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    if (data.startsWith("delete_user_")) {
        const targetUserId = parseInt(data.split("_")[2]);
        const confirmKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Ha", callback_data: "confirm_delete_" + targetUserId }],
                    [{ text: "❌ Yo'q", callback_data: "admin_manage_users_back" }]
                ]
            }
        };
        await bot.sendMessage(chatId, "⚠️ *DIQQAT!*\n\nFoydalanuvchini o'chirmoqchisiz?\nBu amal ortga qaytmaydi!", {
            parse_mode: "Markdown",
            ...confirmKeyboard
        });
        return;
    }
    
    if (data.startsWith("confirm_delete_")) {
        const targetUserId = parseInt(data.split("_")[2]);
        const result = deleteUser(targetUserId);
        await bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
        userManagePage = 0;
        await sendMainMenu(chatId, true, userId);
        return;
    }
    
    if (data === "back_to_main") {
        userManagePage = 0;
        usersListPage = 0;
        clearUserSession(userId);
        await sendMainMenu(chatId, isAdmin(userId), userId);
        return;
    }
});

// -------------------- XATOLIKLARNI QAYTA ISHLASH --------------------
bot.on("polling_error", (error) => {
    console.error("Polling xatolik:", error.message);
    if (error.message.includes("409")) {
        console.log("⚠️ Boshqa instance ishlayapti, qayta ulanish...");
        setTimeout(() => process.exit(1), 1000);
    }
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    const errorLog = path.join(VOLUME_PATH, 'error.log');
    fs.appendFileSync(errorLog, new Date().toISOString() + " - " + error.stack + "\n");
});

// -------------------- BOTNI ISHGA TUSHIRISH --------------------
console.log("=".repeat(60));
console.log("🚗 ISUZU DOCTOR BOT ISHGA TUSHMOQDA");
console.log("=".repeat(60));

loadVersion();
loadData();
loadAdminSettings();
loadVideos();
loadConversations();
loadVersionHistory();

console.log("=".repeat(60));
console.log("🚗 ISUZU DOCTOR BOT ISHGA TUSHDI");
console.log("=".repeat(60));
console.log("📌 Versiya: V" + currentVersion);
console.log("⚠️ Versiya FAQAT kod o'zgarganda yangilanadi!");
console.log("👑 Adminlar: " + ADMIN_IDS.join(", "));
console.log("👥 Foydalanuvchilar: " + users.filter(u => !u.isAdmin).length);
console.log("🔧 Diagnostikalar: " + diagnostics.length);
console.log("📹 Videolar: " + videoList.length + " ta");
console.log("💬 Muloqotlar: " + conversations.length + " ta");
console.log("💳 Karta: " + CARD_NUMBER);
console.log("📊 Yangilanishlar soni: " + versionHistory.length);
console.log("💾 Volume manzili: " + VOLUME_PATH);
console.log("🔑 Litsenziya ID: " + uniqueInstallId);
console.log("💰 Diagnostika narxi: " + DIAGNOSTIC_PRICE.toLocaleString() + " so'm");
console.log("© Muallif: " + BOT_OWNER);
console.log("=".repeat(60));
console.log("✅ Bot ishlashga tayyor!");
