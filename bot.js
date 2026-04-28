const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

// ======================== AVTORLIK HUQUQI VA LITSENZIYA ========================
const LICENSE_KEY = "ISUZU_DOCTOR_BOT_V2";
const BOT_OWNER = "Erkinjon Shukurov";
const BOT_OWNER_TELEGRAM = "@Erkinjon_Shukurov";

// ======================== ODDIY VERSIYA TIZIMI ========================
let currentVersion = "2.1";

function incrementVersion() {
    const parts = currentVersion.split('.');
    const major = parts[0];
    let minor = parseInt(parts[1]);
    minor++;
    currentVersion = `${major}.${minor}`;
    saveVersion();
    console.log(`📌 Versiya yangilandi: V${currentVersion}`);
    return currentVersion;
}

function getVersionInfo() {
    return {
        currentVersion: currentVersion,
        newBotLink: NEW_BOT_LINK
    };
}

const NEW_BOT_LINK = "https://t.me/Isuzu_doctor_bot";
const INSTAGRAM_LINK = "https://www.instagram.com/isuzu.samarkand";
const TELEGRAM_GROUP_LINK = "https://t.me/+piY0W4XrGqFkN2Iy";

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

function getMonthlyIncome(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const monthlyDiagnostics = diagnostics.filter(d => {
        const diagDate = new Date(d.date);
        return diagDate >= startDate && diagDate <= endDate && !d.isFree;
    });
    const totalIncome = monthlyDiagnostics.reduce((sum, d) => sum + d.price, 0);
    const diagnosticCount = monthlyDiagnostics.length;
    const averageCheck = diagnosticCount > 0 ? totalIncome / diagnosticCount : 0;
    return {
        year: year,
        month: month,
        totalIncome: totalIncome,
        diagnosticCount: diagnosticCount,
        averageCheck: averageCheck,
        diagnostics: monthlyDiagnostics
    };
}

function getAllMonthsIncome() {
    const monthsData = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    for (let i = 0; i < 12; i++) {
        let year = currentYear;
        let month = currentMonth - i;
        if (month <= 0) {
            month += 12;
            year--;
        }
        if (year >= 2024) {
            const monthData = getMonthlyIncome(year, month);
            monthsData.push(monthData);
        }
    }
    return monthsData;
}

function formatMonthName(year, month) {
    const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    return `${monthNames[month - 1]} ${year}`;
}

function getYearlyIncome(year) {
    let totalYearlyIncome = 0;
    let totalDiagnostics = 0;
    for (let month = 1; month <= 12; month++) {
        const monthData = getMonthlyIncome(year, month);
        totalYearlyIncome += monthData.totalIncome;
        totalDiagnostics += monthData.diagnosticCount;
    }
    return {
        year: year,
        totalIncome: totalYearlyIncome,
        totalDiagnostics: totalDiagnostics,
        averageMonthlyIncome: totalYearlyIncome / 12
    };
}

function getAvailableYears() {
    const years = new Set();
    diagnostics.forEach(d => {
        if (!d.isFree) {
            const year = new Date(d.date).getFullYear();
            years.add(year);
        }
    });
    return Array.from(years).sort((a, b) => b - a);
}

let versionHistory = [];

function loadVersionHistory() {
    try {
        const historyFile = path.join(VOLUME_PATH, 'version_history.json');
        if (fs.existsSync(historyFile)) {
            versionHistory = JSON.parse(fs.readFileSync(historyFile, "utf8"));
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
    const historyFile = path.join(VOLUME_PATH, 'version_history.json');
    fs.writeFileSync(historyFile, JSON.stringify(versionHistory, null, 2));
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
    addSecurityLog("VERSION_UPDATE", adminId, `Yangi versiya: ${version}`);
    return record;
}

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

function getUserPaymentKeyboard() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🏦 Karta raqamini ko'rish", callback_data: "show_card_number" }],
                [{ text: "🔙 Ortga", callback_data: "back_to_main" }]
            ]
        }
    };
}

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

let videoList = [];

function ensureVolumeDir() {
    if (!fs.existsSync(VOLUME_PATH)) {
        fs.mkdirSync(VOLUME_PATH, { recursive: true });
        console.log("✅ Volume yaratildi: " + VOLUME_PATH);
    }
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log("✅ Backup papkasi yaratildi: " + BACKUP_DIR);
    }
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
        console.log("✅ Hisobot papkasi yaratildi: " + REPORTS_DIR);
    }
    if (!fs.existsSync(VIDEOS_DIR)) {
        fs.mkdirSync(VIDEOS_DIR, { recursive: true });
        console.log("✅ Video papkasi yaratildi: " + VIDEOS_DIR);
    }
}

ensureVolumeDir();

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

checkLicenseIntegrity();
checkBotIntegrity();

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.deleteWebHook().catch(e => console.log("Webhook xatolik:", e.message));

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
        title: title,
        description: description || "",
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
    incrementVersion();
    addVersionRecord(currentVersion, "Video yuklandi: " + title, adminId);
    return newVideo;
}

function updateVideoViews(videoId) {
    const video = videoList.find(v => v.id === videoId);
    if (video) {
        video.views = (video.views || 0) + 1;
        saveVideos();
    }
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

async function sendNotificationToAllUsers(message, keyboard = null) {
    const activeUsers = users.filter(u => !u.isAdmin && !u.isBlocked);
    let successCount = 0;
    let failCount = 0;
    for (const user of activeUsers) {
        try {
            await bot.sendMessage(user.userId, message, {
                parse_mode: "Markdown",
                reply_markup: keyboard
            });
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
            failCount++;
            console.error(`Xabar yuborilmadi (${user.userId}):`, error.message);
        }
    }
    return { success: successCount, fail: failCount };
}

const REMINDER_MESSAGE = `
🚗 **Hurmatli mijoz!**

Agar avtomobilingiz doimo soz, ishonchli va yo'llarda sizni yarim yo'lda qoldirmasligini istasangiz — unda unga faqat professional va malakali mutaxassislar xizmat ko'rsatishi muhim.

🛠️ **Sifatli xizmat** — bu nafaqat qulaylik, balki sizning xavfsizligingiz kafolatidir.

✅ Shuning uchun avtomobilingizni haqiqiy professionallarga ishonib topshiring!
`;

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

async function generateDiagnosticsReport(diagnosticsList) {
    return new Promise((resolve, reject) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
        const filename = "diagnostics_report_" + timestamp + ".txt";
        const filepath = path.join(REPORTS_DIR, filename);
        let content = "";
        content += "=".repeat(80) + "\n";
        content += "                    DIAGNOSTIKA HISOBOTI\n";
        content += "=".repeat(80) + "\n\n";
        content += "Yaratilgan sana: " + formatTashkentDateTime(new Date()) + "\n";
        content += "Jami diagnostikalar: " + diagnosticsList.length + " ta\n\n";
        const paidCount = diagnosticsList.filter(d => !d.isFree).length;
        const freeCount = diagnosticsList.filter(d => d.isFree).length;
        const totalIncome = diagnosticsList.filter(d => !d.isFree).reduce((sum, d) => sum + d.price, 0);
        content += "-------------------------- STATISTIKA --------------------------\n";
        content += "To'lovli diagnostikalar: " + paidCount + " ta\n";
        content += "Bepul diagnostikalar: " + freeCount + " ta\n";
        content += "Umumiy daromad: " + totalIncome.toLocaleString() + " som\n\n";
        content += "----------------------- DIAGNOSTIKALAR RO'YXATI -----------------------\n";
        content += "=".repeat(80) + "\n\n";
        let i = 1;
        for (const diag of diagnosticsList.slice(0, 200)) {
            content += "📅 " + i + "-DIAGNOSTIKA\n";
            content += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
            content += "📆 Sana: " + formatTashkentDateTime(diag.date) + "\n";
            content += "🚗 Avtomobil raqami: " + diag.carNumber + "\n";
            content += "📝 Bajarilgan ishlar:\n" + diag.workDescription + "\n";
            if (diag.additionalNotes && diag.additionalNotes !== "") {
                content += "\n➕ Qo'shimcha eslatmalar:\n" + diag.additionalNotes + "\n";
            }
            content += "\n💰 Narx: " + (diag.isFree ? "BEPUL" : diag.price.toLocaleString() + " so'm") + "\n";
            content += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
            i++;
        }
        content += "\nJami: " + diagnosticsList.length + " ta diagnostika\n";
        content += "Hisobot yaratildi: " + formatTashkentDateTime(new Date()) + "\n";
        content += "=".repeat(80) + "\n";
        content += "\n© " + new Date().getFullYear() + " " + BOT_OWNER + ". Barcha huquqlar himoyalangan.\n";
        try {
            fs.writeFileSync(filepath, content, "utf8");
            resolve(filepath);
        } catch (err) {
            reject(err);
        }
    });
}

function loadAdminSettings() {
    try {
        if (fs.existsSync(ADMIN_SETTINGS_FILE)) {
            adminSettings = JSON.parse(fs.readFileSync(ADMIN_SETTINGS_FILE, "utf8"));
        } else {
            saveAdminSettings();
        }
    } catch (err) {
        console.error("Admin sozlamalarini yuklashda xatolik:", err);
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
    const log = {
        id: Date.now(),
        action: action,
        userId: userId,
        details: details + " | InstallID: " + uniqueInstallId,
        date: new Date().toISOString()
    };
    adminSettings.securityLog.unshift(log);
    if (adminSettings.securityLog.length > 100) {
        adminSettings.securityLog = adminSettings.securityLog.slice(0, 100);
    }
    saveAdminSettings();
}

function grantEditPermission(adminId, targetUserId) {
    if (!isSuperAdmin(adminId)) {
        return { success: false, message: "Faqat Super Admin ruxsat bera oladi!" };
    }
    if (adminSettings.allowedEditors.includes(targetUserId)) {
        return { success: false, message: "Bu admin allaqachon ruxsatga ega!" };
    }
    adminSettings.allowedEditors.push(targetUserId);
    saveAdminSettings();
    addSecurityLog("GRANT_EDIT_PERMISSION", adminId, "Admin " + targetUserId + " ga ruxsat berildi");
    incrementVersion();
    addVersionRecord(currentVersion, "Admin qo'shildi: " + targetUserId, adminId);
    return { success: true, message: "Ruxsat muvaffaqiyatli berildi!" };
}

function revokeEditPermission(adminId, targetUserId) {
    if (!isSuperAdmin(adminId)) {
        return { success: false, message: "Faqat Super Admin ruxsatni olib qo'yishi mumkin!" };
    }
    const index = adminSettings.allowedEditors.indexOf(targetUserId);
    if (index === -1) {
        return { success: false, message: "Bu admin ruxsatga ega emas!" };
    }
    adminSettings.allowedEditors.splice(index, 1);
    saveAdminSettings();
    addSecurityLog("REVOKE_EDIT_PERMISSION", adminId, "Admin " + targetUserId + " dan ruxsat olindi");
    incrementVersion();
    addVersionRecord(currentVersion, "Admin o'chirildi: " + targetUserId, adminId);
    return { success: true, message: "Ruxsat muvaffaqiyatli olib qo'yildi!" };
}

function loadVersion() {
    try {
        if (fs.existsSync(VERSION_FILE)) {
            const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, "utf8"));
            currentVersion = versionData.version;
            console.log("📌 Joriy versiya: V" + currentVersion);
        } else {
            currentVersion = "2.1";
            saveVersion();
        }
    } catch (err) {
        console.error("Versiya yuklashda xatolik:", err);
        currentVersion = "2.1";
        saveVersion();
    }
}

function saveVersion() {
    const versionData = {
        version: currentVersion,
        lastUpdate: new Date().toISOString(),
        newBotLink: NEW_BOT_LINK,
        installId: uniqueInstallId,
        owner: BOT_OWNER
    };
    fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2));
}

function updateBotVersion(newVersion, changes, adminId) {
    currentVersion = newVersion;
    saveVersion();
    addVersionRecord(newVersion, changes, adminId);
    console.log(`✅ Bot versiyasi yangilandi: V${newVersion}`);
    return true;
}

async function sendReminder(chatId) {
    try {
        await bot.sendMessage(chatId, REMINDER_MESSAGE, { parse_mode: "Markdown" });
    } catch (error) {
        console.error("Eslatma yuborishda xatolik:", error);
    }
}

function createBackup() {
    ensureVolumeDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    if (fs.existsSync(USERS_FILE)) {
        fs.copyFileSync(USERS_FILE, path.join(BACKUP_DIR, "users_backup_" + timestamp + ".json"));
    }
    if (fs.existsSync(DIAGNOSTICS_FILE)) {
        fs.copyFileSync(DIAGNOSTICS_FILE, path.join(BACKUP_DIR, "diagnostics_backup_" + timestamp + ".json"));
    }
    if (fs.existsSync(ERRORS_FILE)) {
        fs.copyFileSync(ERRORS_FILE, path.join(BACKUP_DIR, "errors_backup_" + timestamp + ".json"));
    }
    if (fs.existsSync(VIDEOS_FILE)) {
        fs.copyFileSync(VIDEOS_FILE, path.join(BACKUP_DIR, "videos_backup_" + timestamp + ".json"));
    }
    const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith(".json"));
    while (backups.length > 30) {
        const oldest = backups.sort()[0];
        fs.unlinkSync(path.join(BACKUP_DIR, oldest));
        backups.shift();
    }
    console.log("✅ Backup yaratildi: " + timestamp);
    incrementVersion();
    addVersionRecord(currentVersion, "Backup yaratildi", SUPER_ADMIN_ID);
    return true;
}

function listBackups() {
    ensureVolumeDir();
    const backups = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith("users_backup_") && f.endsWith(".json"))
        .map(f => ({
            name: f,
            date: fs.statSync(path.join(BACKUP_DIR, f)).mtime
        }))
        .sort((a, b) => b.date - a.date);
    return backups;
}

function restoreBackup(backupName) {
    const backupPath = path.join(BACKUP_DIR, backupName);
    if (!fs.existsSync(backupPath)) return false;
    const backupData = JSON.parse(fs.readFileSync(backupPath, "utf8"));
    fs.writeFileSync(USERS_FILE, JSON.stringify(backupData, null, 2));
    const diagBackupName = backupName.replace("users_backup_", "diagnostics_backup_");
    const diagBackupPath = path.join(BACKUP_DIR, diagBackupName);
    if (fs.existsSync(diagBackupPath)) {
        const diagData = JSON.parse(fs.readFileSync(diagBackupPath, "utf8"));
        fs.writeFileSync(DIAGNOSTICS_FILE, JSON.stringify(diagData, null, 2));
    }
    const videoBackupName = backupName.replace("users_backup_", "videos_backup_");
    const videoBackupPath = path.join(BACKUP_DIR, videoBackupName);
    if (fs.existsSync(videoBackupPath)) {
        const videoData = JSON.parse(fs.readFileSync(videoBackupPath, "utf8"));
        fs.writeFileSync(VIDEOS_FILE, JSON.stringify(videoData, null, 2));
        videoList = videoData;
    }
    console.log("✅ Database tiklandi: " + backupName);
    incrementVersion();
    addVersionRecord(currentVersion, "Database tiklandi: " + backupName, SUPER_ADMIN_ID);
    return true;
}

let users = [];
let diagnostics = [];
let errors = [];

function loadData() {
    try {
        ensureVolumeDir();
        if (fs.existsSync(USERS_FILE)) {
            users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
            users.forEach(u => {
                if (u.isBlocked === undefined) u.isBlocked = false;
                if (!u.cars) u.cars = [];
                if (u.totalDiagnosticsAll === undefined) u.totalDiagnosticsAll = 0;
                if (u.totalBonusCount === undefined) u.totalBonusCount = 0;
                if (u.totalFreeDiagnostics === undefined) u.totalFreeDiagnostics = 0;
            });
            saveUsers();
        } else {
            users = [];
            saveUsers();
        }
        if (fs.existsSync(DIAGNOSTICS_FILE)) {
            diagnostics = JSON.parse(fs.readFileSync(DIAGNOSTICS_FILE, "utf8"));
        } else {
            diagnostics = [];
            saveDiagnostics();
        }
        if (fs.existsSync(ERRORS_FILE)) {
            errors = JSON.parse(fs.readFileSync(ERRORS_FILE, "utf8"));
        } else {
            errors = [];
            saveErrors();
        }
        console.log("✅ Yuklandi: " + users.length + " foydalanuvchi, " + diagnostics.length + " diagnostika");
        console.log("✅ Volume manzili: " + VOLUME_PATH);
        console.log("✅ Joriy versiya: V" + currentVersion);
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

function getUserByPhone(phone) {
    return users.find(u => u.phone === phone);
}

function getUserByUserId(userId) {
    return users.find(u => u.userId === userId);
}

function isAdmin(userId) {
    if (ADMIN_IDS.includes(userId)) return true;
    const user = getUserByUserId(userId);
    return user ? user.isAdmin === true : false;
}
function deleteUser(userId) {
    let userIndex = users.findIndex(u => u.userId === userId);
    if (userIndex === -1) userIndex = users.findIndex(u => u.userId == userId);
    if (userIndex === -1) userIndex = users.findIndex(u => String(u.userId) === String(userId));
    if (userIndex === -1) return { success: false, message: "❌ Foydalanuvchi topilmadi!" };
    const user = users[userIndex];
    if (user.isAdmin) return { success: false, message: "❌ Adminni o'chirib bo'lmaydi!" };
    const userDiagnostics = diagnostics.filter(d => d.userId === userId || d.userId == userId);
    diagnostics = diagnostics.filter(d => d.userId !== userId && d.userId != userId);
    saveDiagnostics();
    users.splice(userIndex, 1);
    saveUsers();
    incrementVersion();
    addVersionRecord(currentVersion, "Foydalanuvchi o'chirildi: " + (user.fullName || user.phone), SUPER_ADMIN_ID);
    return { 
        success: true, 
        message: "🗑️ Foydalanuvchi o'chirildi: " + (user.fullName || user.phone),
        deletedDiagnostics: userDiagnostics.length
    };
}

function blockUser(userId) {
    const user = getUserByUserId(userId);
    if (!user) return { success: false, message: "Foydalanuvchi topilmadi" };
    if (user.isAdmin) return { success: false, message: "Adminni bloklab bo'lmaydi!" };
    user.isBlocked = true;
    saveUsers();
    incrementVersion();
    addVersionRecord(currentVersion, "Foydalanuvchi bloklandi: " + (user.fullName || user.phone), SUPER_ADMIN_ID);
    return { success: true, message: "✅ Foydalanuvchi bloklandi: " + (user.fullName || user.phone) };
}

function unblockUser(userId) {
    const user = getUserByUserId(userId);
    if (!user) return { success: false, message: "Foydalanuvchi topilmadi" };
    user.isBlocked = false;
    saveUsers();
    incrementVersion();
    addVersionRecord(currentVersion, "Foydalanuvchi blokdan ochildi: " + (user.fullName || user.phone), SUPER_ADMIN_ID);
    return { success: true, message: "✅ Foydalanuvchi blokdan ochildi: " + (user.fullName || user.phone) };
}

function getBlockedUsers() {
    return users.filter(u => !u.isAdmin && u.isBlocked === true);
}

function getActiveUsers() {
    return users.filter(u => !u.isAdmin && u.isBlocked !== true);
}

function addNewUser(userId, phoneNumber, carNumber, firstName, lastName, username) {
    const newUser = {
        userId: userId,
        phone: phoneNumber,
        firstName: firstName || "",
        lastName: lastName || "",
        username: username || "",
        fullName: (firstName || "") + " " + (lastName || ""),
        isAdmin: false,
        isActive: true,
        isBlocked: false,
        registeredDate: new Date().toISOString(),
        cars: [{
            carId: Date.now(),
            carNumber: carNumber,
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
    incrementVersion();
    addVersionRecord(currentVersion, "Yangi foydalanuvchi qo'shildi: " + phoneNumber, userId);
    return newUser;
}

function addCarToUser(phoneNumber, carNumber, userInfo = {}) {
    const user = getUserByPhone(phoneNumber);
    if (!user) return { success: false, message: "Foydalanuvchi topilmadi" };
    if (user.cars.length >= MAX_CARS_PER_USER) {
        return { success: false, message: "Siz maksimum " + MAX_CARS_PER_USER + " ta avtomobil qo'sha olasiz!" };
    }
    const existingCar = user.cars.find(c => c.carNumber === carNumber);
    if (existingCar) {
        return { success: false, message: "Bu avtomobil raqami allaqachon qo'shilgan!" };
    }
    if (userInfo.firstName && !user.firstName) {
        user.firstName = userInfo.firstName;
        user.lastName = userInfo.lastName || "";
        user.username = userInfo.username || "";
        user.fullName = (userInfo.firstName || "") + " " + (userInfo.lastName || "");
        saveUsers();
    }
    user.cars.push({
        carId: Date.now(),
        carNumber: carNumber,
        bonusCount: 0,
        freeDiagnostics: 0,
        totalDiagnostics: 0,
        addedDate: new Date().toISOString(),
        isActive: true
    });
    saveUsers();
    incrementVersion();
    addVersionRecord(currentVersion, "Yangi avtomobil qo'shildi: " + carNumber, user.userId);
    return { success: true, message: "Yangi avtomobil qo'shildi!", carsCount: user.cars.length };
}

function addDiagnosticToCar(phoneNumber, carNumber, workDescription, additionalNotes) {
    const user = getUserByPhone(phoneNumber);
    if (!user) return { success: false, message: "Foydalanuvchi topilmadi" };
    const car = user.cars.find(c => c.carNumber === carNumber);
    if (!car) return { success: false, message: "Avtomobil topilmadi" };
    let isFree = false;
    let bonusMessage = "";
    let newBonusCount = car.bonusCount;
    let newFreeDiagnostics = car.freeDiagnostics;
    if (car.freeDiagnostics > 0) {
        isFree = true;
        newFreeDiagnostics--;
        bonusMessage = "🎉 BEPUL diagnostikadan foydalandingiz!";
    } else {
        newBonusCount++;
        if (newBonusCount >= 5) {
            const bonusCount = Math.floor(newBonusCount / 5);
            newFreeDiagnostics += bonusCount;
            newBonusCount = newBonusCount % 5;
            bonusMessage = "🎉🎉🎉 TABRIKLAYMIZ! 5-diagnostikani tugatdingiz va 1 ta BEPUL diagnostika qozondingiz!";
        }
    }
    const diagnostic = {
        id: Date.now(),
        userId: user.userId,
        phoneNumber: phoneNumber,
        carNumber: carNumber,
        date: new Date().toISOString(),
        workDescription: workDescription,
        additionalNotes: additionalNotes || "",
        price: isFree ? 0 : DIAGNOSTIC_PRICE,
        isFree: isFree
    };
    diagnostics.push(diagnostic);
    saveDiagnostics();
    car.bonusCount = newBonusCount;
    car.freeDiagnostics = newFreeDiagnostics;
    car.totalDiagnostics++;
    user.totalDiagnosticsAll++;
    if (isFree) {
        user.totalFreeDiagnostics = (user.totalFreeDiagnostics || 0) + 1;
    } else {
        user.totalBonusCount = (user.totalBonusCount || 0) + 1;
    }
    saveUsers();
    incrementVersion();
    addVersionRecord(currentVersion, "Diagnostika qo'shildi: " + carNumber, user.userId);
    return {
        success: true,
        isFree: isFree,
        price: isFree ? 0 : DIAGNOSTIC_PRICE,
        newBonusCount: newBonusCount,
        newFreeDiagnostics: newFreeDiagnostics,
        bonusMessage: bonusMessage,
        carNumber: carNumber
    };
}

function getUserDiagnostics(phoneNumber, limit = 10) {
    return diagnostics.filter(d => d.phoneNumber === phoneNumber).slice(-limit).reverse();
}

function getNearBonusCars() {
    const nearBonus = [];
    for (const user of users) {
        if (user.isAdmin) continue;
        for (const car of user.cars) {
            if (car.bonusCount >= 3 && car.bonusCount < 5) {
                nearBonus.push({
                    phone: user.phone,
                    carNumber: car.carNumber,
                    bonusCount: car.bonusCount,
                    remaining: 5 - car.bonusCount,
                    fullName: user.fullName || "Ism kiritilmagan"
                });
            }
        }
    }
    return nearBonus;
}

function getTodayDiagnostics() {
    const today = new Date().toISOString().split("T")[0];
    return diagnostics.filter(d => d.date.split("T")[0] === today);
}

function getAllDiagnostics(limit = 500) {
    return diagnostics.slice(-limit).reverse();
}

function getStatistics() {
    const regularUsers = users.filter(u => !u.isAdmin);
    const blockedUsers = users.filter(u => !u.isAdmin && u.isBlocked === true);
    const activeUsers = regularUsers.filter(u => u.isBlocked !== true);
    let totalCars = 0;
    for (const user of activeUsers) {
        totalCars += user.cars.length;
    }
    const paidDiagnostics = diagnostics.filter(d => !d.isFree);
    const totalIncome = paidDiagnostics.reduce((sum, d) => sum + d.price, 0);
    return {
        totalUsers: activeUsers.length,
        blockedUsers: blockedUsers.length,
        totalCars: totalCars,
        totalDiagnostics: diagnostics.length,
        paidDiagnostics: paidDiagnostics.length,
        freeDiagnostics: diagnostics.filter(d => d.isFree).length,
        totalIncome: totalIncome,
        totalErrors: errors.length,
        currentVersion: currentVersion,
        totalVideos: videoList.length,
        totalVideoViews: videoList.reduce((sum, v) => sum + (v.views || 0), 0),
        versionHistoryCount: versionHistory.length
    };
}

function getErrors() {
    return errors.slice(-50).reverse();
}

function getAllUsersWithDetails() {
    return users.filter(u => !u.isAdmin).map(u => ({
        userId: u.userId,
        fullName: u.fullName || "Ism kiritilmagan",
        firstName: u.firstName || "",
        lastName: u.lastName || "",
        username: u.username || "",
        phone: u.phone,
        cars: u.cars,
        totalDiagnostics: u.totalDiagnosticsAll || 0,
        registeredDate: u.registeredDate,
        isBlocked: u.isBlocked || false
    }));
}

async function showVideoGallery(chatId, page = 0) {
    const activeVideos = getActiveVideos();
    const itemsPerPage = 5;
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageVideos = activeVideos.slice(start, end);
    if (activeVideos.length === 0) {
        await bot.sendMessage(chatId, "📹 *VIDEO GALEREYA*\n\nHozircha videolar mavjud emas.\nTez orada yangi videolar qo'shiladi!", { parse_mode: "Markdown" });
        return;
    }
    let msg = "📹 *VIDEO GALEREYA*\n━━━━━━━━━━━━━━━━━━\n\n";
    msg += "📊 Jami videolar: " + activeVideos.length + " ta\n";
    msg += "👁️ Umumiy ko'rishlar: " + activeVideos.reduce((sum, v) => sum + (v.views || 0), 0) + " ta\n";
    msg += "━━━━━━━━━━━━━━━━━━\n\n";
    const keyboard = [];
    for (let i = 0; i < pageVideos.length; i++) {
        const video = pageVideos[i];
        const num = start + i + 1;
        msg += num + ". *" + video.title + "*\n";
        msg += "   👁️ " + (video.views || 0) + " | 👍 " + (video.likes || 0) + "\n";
        if (video.description) {
            msg += "   📝 " + video.description.substring(0, 50) + (video.description.length > 50 ? "..." : "") + "\n";
        }
        msg += "   📅 " + formatTashkentDate(video.uploadDate) + "\n";
        msg += "━━━━━━━━━━━━━━━━━━\n";
        keyboard.push([{ text: "▶️ " + num + ". " + video.title.substring(0, 25), callback_data: "watch_video_" + video.id }]);
    }
    const navButtons = [];
    if (page > 0) navButtons.push({ text: "◀️", callback_data: "video_page_" + (page - 1) });
    if (end < activeVideos.length) navButtons.push({ text: "▶️", callback_data: "video_page_" + (page + 1) });
    if (navButtons.length > 0) keyboard.push(navButtons);
    await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
}

let usersListPage = 0;
const USERS_PER_PAGE = 10;

async function showUsersList(chatId, page, messageId = null) {
    const usersList = getAllUsersWithDetails();
    if (usersList.length === 0) {
        const msg = "📭 Hech qanday foydalanuvchi yo'q";
        if (messageId) {
            await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
        } else {
            await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
        }
        return;
    }
    const totalPages = Math.ceil(usersList.length / USERS_PER_PAGE);
    const start = page * USERS_PER_PAGE;
    const end = start + USERS_PER_PAGE;
    const pageUsers = usersList.slice(start, end);
    let msg = "👥 *FOYDALANUVCHILAR*\n";
    msg += `📄 Sahifa ${page + 1}/${totalPages}\n`;
    msg += `👤 Jami: ${usersList.length} ta foydalanuvchi\n`;
    msg += "━━━━━━━━━━━━━━━━━━\n\n";
    for (let i = 0; i < pageUsers.length; i++) {
        const u = pageUsers[i];
        const num = start + i + 1;
        const status = u.isBlocked ? "🔴" : "🟢";
        const carNumber = u.cars.length > 0 ? u.cars[0].carNumber : "❌ Avto yo'q";
        msg += `${status} *${num}. ${(u.fullName || "Ismsiz").substring(0, 20)}*\n`;
        msg += `📞 ${u.phone}\n`;
        msg += `🚗 ${carNumber}\n`;
        msg += `🆔 ID: ${u.userId}\n`;
        msg += `📊 ${u.totalDiagnostics} ta diagnostika\n`;
        msg += "━━━━━━━━━━━━━━━━━━\n";
    }
    const navButtons = [];
    if (page > 0) navButtons.push({ text: "◀️ Oldingi", callback_data: "users_page_prev" });
    if (end < usersList.length) navButtons.push({ text: "Keyingi ▶️", callback_data: "users_page_next" });
    const keyboard = [];
    if (navButtons.length > 0) keyboard.push(navButtons);
    keyboard.push([{ text: "🔙 Ortga", callback_data: "back_to_main" }]);
    const replyMarkup = { inline_keyboard: keyboard };
    if (messageId) {
        await bot.editMessageText(msg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: replyMarkup });
    } else {
        await bot.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: replyMarkup });
    }
}

function getCompactInlineKeyboard() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Profil", callback_data: "user_profile" }, { text: "🚗 Avtomobillar", callback_data: "user_my_cars" }],
                [{ text: "🎁 Bonuslar", callback_data: "user_my_bonus" }, { text: "➕ Avto qo'shish", callback_data: "user_add_car" }],
                [{ text: "📋 Tarix", callback_data: "user_history" }, { text: "📹 Video", callback_data: "user_video_gallery" }],
                [{ text: "💳 To'lov", callback_data: "user_payment" }, { text: "📸 Instagram", callback_data: "user_instagram" }],
                [{ text: "👥 Guruh", callback_data: "user_telegram_group" }, { text: "ℹ️ Ma'lumot", callback_data: "user_info" }],
                [{ text: "ℹ️ Versiya", callback_data: "user_version_info" }]
            ],
            resize_keyboard: true
        }
    };
}

function getAdminReplyKeyboard() {
    const keyboard = [
        ["📊 Statistika", "👥 Foydalanuvchilar"],
        ["🔧 Diagnostika", "🎁 Bonusga yaqinlar"],
        ["⚠️ Xatoliklar", "📋 Diagnostika tarixi"],
        ["📅 Bugungi", "📄 Hisobot"],
        ["📹 Video galereya", "📤 Video yuklash"],
        ["💾 Backup", "🔄 Tiklash"],
        ["🚫 Foyd. boshqarish", "🔐 Xavfsizlik"],
        ["📌 Versiya", "📢 Xabar yuborish"],
        ["❌ Asosiy menyu"]
    ];
    return {
        reply_markup: { keyboard: keyboard, resize_keyboard: true, one_time_keyboard: false }
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

function removeKeyboard() {
    return { reply_markup: { remove_keyboard: true } };
}

async function sendMainMenu(chatId, isAdminUser = false, deviceType = "web") {
    try {
        if (isAdminUser) {
            await bot.sendMessage(chatId, "👑 *Admin paneli*\n\n📌 Bot versiyasi: `V" + currentVersion + "`\n🔑 Litsenziya ID: `" + uniqueInstallId + "`\n\n© " + BOT_OWNER, {
                parse_mode: "Markdown",
                ...getAdminReplyKeyboard()
            });
        } else {
            await bot.sendMessage(chatId, "🏠 *Asosiy menyu*\n\n🚗 Isuzu Doctor bot", {
                parse_mode: "Markdown",
                ...getCompactInlineKeyboard()
            });
        }
    } catch (error) {
        console.error("Menu yuborishda xatolik:", error);
    }
}

const userSessions = new Map();

function getUserSession(userId) {
    if (!userSessions.has(userId)) {
        userSessions.set(userId, { step: null, data: {} });
    }
    return userSessions.get(userId);
}

function clearUserSession(userId) {
    userSessions.delete(userId);
}

let userManagePage = 0;

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

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || "";
    const lastName = msg.from.last_name || "";
    const username = msg.from.username || "";
    const userAgent = msg.from?.userAgent || "";
    const deviceType = getDeviceType(userAgent);
    setUserDevice(userId, deviceType);
    clearUserSession(userId);
    const existingUser = getUserByUserId(userId);
    if (existingUser && existingUser.isBlocked) {
        await bot.sendMessage(chatId, "🚫 *Siz botdan bloklangansiz!*\n\nIltimos, administrator bilan bog'laning.\n📞 Aloqa: " + ADMIN_PHONE, { parse_mode: "Markdown", ...removeKeyboard() });
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
            const welcomeText = "👋 *Xush kelibsiz, " + (existingUser.fullName || firstName || "hurmatli mijoz") + "!*\n\n📞 Telefon: " + existingUser.phone + "\n🚗 Avtomobillar: " + carsCount + " ta\n🎁 Bonus: " + (existingUser.totalBonusCount || 0) + "\n🎉 Bepul: " + (existingUser.totalFreeDiagnostics || 0) + " ta\n📊 Diagnostika: " + (existingUser.totalDiagnosticsAll || 0) + " ta";
            await bot.sendMessage(chatId, welcomeText, { parse_mode: "Markdown" });
            await sendMainMenu(chatId, existingUser.isAdmin, deviceType);
        } else {
            const session = getUserSession(userId);
            session.data.firstName = firstName;
            session.data.lastName = lastName;
            session.data.username = username;
            await bot.sendMessage(chatId, "🚗 *ISUZU DOCTOR* tizimiga xush kelibsiz!\n\n© " + BOT_OWNER + "\n\n📱 Iltimos, telefon raqamingizni yuboring:", {
                parse_mode: "Markdown",
                ...getPhoneKeyboard()
            });
        }
    } catch (error) {
        console.error("/start xatolik:", error);
        await bot.sendMessage(chatId, "❌ *Xatolik yuz berdi!* Iltimos, qaytadan /start bosing.", { parse_mode: "Markdown" });
    }
});

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
    if (!session.data.firstName) {
        session.data.firstName = firstName;
        session.data.lastName = lastName;
        session.data.username = username;
    }
    if (phoneNumber === ADMIN_PHONE) {
        const newUser = {
            userId: userId, phone: phoneNumber, firstName: firstName, lastName: lastName, username: username,
            fullName: firstName + " " + lastName, isAdmin: true, isActive: true, isBlocked: false,
            registeredDate: new Date().toISOString(),
            cars: [{ carId: Date.now(), carNumber: "ADMIN", bonusCount: 0, freeDiagnostics: 0, totalDiagnostics: 0, addedDate: new Date().toISOString(), isActive: true }],
            totalBonusCount: 0, totalFreeDiagnostics: 0, totalDiagnosticsAll: 0
        };
        users.push(newUser);
        saveUsers();
        try {
            await sendReminder(chatId);
            await bot.sendMessage(chatId, "👑 *Siz ADMIN sifatida tizimga kirdingiz!*\n\n📞 Telefon: " + phoneNumber, { parse_mode: "Markdown" });
            await sendMainMenu(chatId, true, getUserDevice(userId));
        } catch (error) { console.error("Admin xabar xatolik:", error); }
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
            parse_mode: "Markdown", ...removeKeyboard()
        });
    } else {
        session.step = "first_car_number";
        session.data.isExistingUser = false;
        await bot.sendMessage(chatId, "✅ Telefon raqam qabul qilindi: " + phoneNumber + "\n\n🚗 *Birinchi avtomobil raqamini kiriting:*\n\nMasalan: 01A777AA", {
            parse_mode: "Markdown", ...removeKeyboard()
        });
    }
});

bot.onText(/\/profile/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = getUserByUserId(userId);
    if (!user) { await bot.sendMessage(chatId, "❌ Ro'yxatdan o'tmagan! /start bosing."); return; }
    const carsList = user.cars.map(c => "🚗 " + c.carNumber + " (" + c.totalDiagnostics + " ta diagnostika)").join("\n");
    await sendReminder(chatId);
    await bot.sendMessage(chatId, "📊 *MENGING SAHIFAM*\n\n👤 *Ism:* " + (user.fullName || "Kiritilmagan") + "\n📞 *Telefon:* " + user.phone + "\n🚗 *Avtomobillar:* " + user.cars.length + "/" + MAX_CARS_PER_USER + "\n\n" + carsList + "\n\n🎁 *Umumiy bonuslar:* " + (user.totalBonusCount || 0) + "\n🎉 *Bepul diagnostika:* " + (user.totalFreeDiagnostics || 0) + " ta\n📊 *Jami diagnostika:* " + (user.totalDiagnosticsAll || 0) + " ta", { parse_mode: "Markdown" });
});

bot.onText(/\/info/, async (msg) => {
    const chatId = msg.chat.id;
    await sendReminder(chatId);
    await bot.sendMessage(chatId, "ℹ️ *ISUZU DOCTOR BOT*\n\n🚗 Avtomobil diagnostikasi\n🎁 Har 5 diagnostikada 1 ta BEPUL\n📱 Bitta telefon bilan " + MAX_CARS_PER_USER + " tagacha avtomobil\n📞 Aloqa: " + ADMIN_PHONE + "\n🔗 Bot linki: " + NEW_BOT_LINK + "\n📸 Instagram: " + INSTAGRAM_LINK + "\n👥 Telegram guruhimiz: " + TELEGRAM_GROUP_LINK + "\n\n© " + BOT_OWNER, { parse_mode: "Markdown" });
});

// -------------------- BOTNI ISHGA TUSHIRISH --------------------
console.log("=".repeat(60));
console.log("🚗 ISUZU DOCTOR BOT ISHGA TUSHMOQDA");
console.log("=".repeat(60));

loadVersion();
loadData();
loadAdminSettings();
loadVideos();
loadVersionHistory();

console.log("=".repeat(60));
console.log("🚗 ISUZU DOCTOR BOT ISHGA TUSHDI");
console.log("=".repeat(60));
console.log("📌 Versiya: V" + currentVersion);
console.log("👑 Adminlar: " + ADMIN_IDS.join(", "));
console.log("👥 Foydalanuvchilar: " + users.filter(u => !u.isAdmin).length);
console.log("🔧 Diagnostikalar: " + diagnostics.length);
console.log("📹 Videolar: " + videoList.length + " ta");
console.log("💳 Karta: " + CARD_NUMBER);
console.log("📊 Yangilanishlar soni: " + versionHistory.length);
console.log("💾 Volume manzili: " + VOLUME_PATH);
console.log("🔑 Litsenziya ID: " + uniqueInstallId);
console.log("© Muallif: " + BOT_OWNER);
console.log("=".repeat(60));
console.log("✅ Bot ishlashga tayyor!");
