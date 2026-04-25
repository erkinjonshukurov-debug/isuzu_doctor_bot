// ========================================
// ISUZU DOCTOR BOT - Avtomobil diagnostikasi uchun Telegram bot
// ========================================
// Muallif: Erkinjon Shukurov
// Telegram: @erkinjon_01_01
// GitHub: github.com/erkinjonshukurov-debug
// © 2024-2026 Erkinjon Shukurov. Barcha huquqlar himoyalangan.
// ========================================

const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

// -------------------- AVTORLIK MA'LUMOTLARI --------------------
const AUTHOR_NAME = "Erkinjon Shukurov";
const AUTHOR_TELEGRAM = "@erkinjon_01_01";
const AUTHOR_GITHUB = "github.com/erkinjonshukurov-debug";
const COPYRIGHT_TEXT = "© 2024-2026 Erkinjon Shukurov. Barcha huquqlar himoyalangan.";

function getAuthorInfo() {
    return `\n👨‍💻 *Muallif:* ${AUTHOR_NAME}\n📱 *Telegram:* ${AUTHOR_TELEGRAM}\n📜 ${COPYRIGHT_TEXT}`;
}

// -------------------- VERSIYA MA'LUMOTLARI --------------------
const BOT_VERSION = "2.1.0";
const NEW_BOT_LINK = "https://t.me/Isuzu_doctor_bot";
const INSTAGRAM_LINK = "https://www.instagram.com/isuzu.samarkand";
const TELEGRAM_GROUP_LINK = "https://t.me/+piY0W4XrGqFkN2Iy";

// -------------------- VAQT ZONASI --------------------
function getTashkentTime(date) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const tashkentOffset = 5 * 60 * 60 * 1000;
    return new Date(dateObj.getTime() + tashkentOffset);
}

function formatTashkentDate(date) {
    const tashkentDate = getTashkentTime(date);
    return tashkentDate.toLocaleDateString('uz-UZ', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

function formatTashkentTime(date) {
    const tashkentDate = getTashkentTime(date);
    return tashkentDate.toLocaleTimeString('uz-UZ', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
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
const DIAGNOSTIC_PRICE = 250000;
const MAX_CARS_PER_USER = 20;

// -------------------- VOLUME --------------------
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const BACKUP_DIR = path.join(VOLUME_PATH, 'backups');
const USERS_FILE = path.join(VOLUME_PATH, 'users.json');
const DIAGNOSTICS_FILE = path.join(VOLUME_PATH, 'diagnostics.json');
const ERRORS_FILE = path.join(VOLUME_PATH, 'errors.json');

function ensureVolumeDir() {
    if (!fs.existsSync(VOLUME_PATH)) fs.mkdirSync(VOLUME_PATH, { recursive: true });
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
ensureVolumeDir();

// -------------------- DATABASE --------------------
let users = [];
let diagnostics = [];
let errors = [];

function loadData() {
    try {
        if (fs.existsSync(USERS_FILE)) users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
        else users = [];
        if (fs.existsSync(DIAGNOSTICS_FILE)) diagnostics = JSON.parse(fs.readFileSync(DIAGNOSTICS_FILE, "utf8"));
        else diagnostics = [];
        if (fs.existsSync(ERRORS_FILE)) errors = JSON.parse(fs.readFileSync(ERRORS_FILE, "utf8"));
        else errors = [];
        console.log("✅ Ma'lumotlar yuklandi: " + users.length + " foydalanuvchi");
    } catch (err) { console.error("Yuklash xatolik:", err); }
}
function saveUsers() { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }
function saveDiagnostics() { fs.writeFileSync(DIAGNOSTICS_FILE, JSON.stringify(diagnostics, null, 2)); }

function getUserByUserId(userId) { return users.find(u => u.userId === userId); }
function isAdmin(userId) { return ADMIN_IDS.includes(userId); }

// -------------------- ASOSIY MENYU --------------------
function getCompactInlineKeyboard() {
    return { reply_markup: { inline_keyboard: [
        [{ text: "📊 Profil", callback_data: "user_profile" }, { text: "🚗 Avtomobillar", callback_data: "user_my_cars" }],
        [{ text: "🎁 Bonuslar", callback_data: "user_my_bonus" }, { text: "➕ Avto qo'shish", callback_data: "user_add_car" }],
        [{ text: "📋 Tarix", callback_data: "user_history" }, { text: "💳 To'lov", callback_data: "user_payment" }],
        [{ text: "📸 Instagram", callback_data: "user_instagram" }, { text: "👥 Guruh", callback_data: "user_telegram_group" }],
        [{ text: "ℹ️ Ma'lumot", callback_data: "user_info" }, { text: "📌 Versiya", callback_data: "user_version_info" }]
    ], resize_keyboard: true } };
}

function getPhoneKeyboard() {
    return { reply_markup: { keyboard: [[{ text: "📱 Telefon raqamini yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } };
}
function removeKeyboard() { return { reply_markup: { remove_keyboard: true } }; }

async function sendMainMenu(chatId, isAdminUser = false) {
    try {
        if (isAdminUser) {
            await bot.sendMessage(chatId, "👑 *Admin paneli*\n" + getAuthorInfo(), { parse_mode: "Markdown" });
        } else {
            await bot.sendMessage(chatId, "🏠 *Asosiy menyu*\n\n📌 Versiyangiz: `" + BOT_VERSION + "`\n" + getAuthorInfo(), { parse_mode: "Markdown", ...getCompactInlineKeyboard() });
        }
    } catch (error) { console.error("Menu xatolik:", error); }
}

// -------------------- BOT --------------------
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.deleteWebHook().catch(e => console.log("Webhook xatolik:", e.message));

const REMINDER_MESSAGE = `🚗 *Hurmatli mijoz!* Avtomobilingizni professionallarga ishonib topshiring! 🛠️`;
async function sendReminder(chatId) { try { await bot.sendMessage(chatId, REMINDER_MESSAGE, { parse_mode: "Markdown" }); } catch (error) {} }

// -------------------- /start --------------------
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || "";
    
    const existingUser = getUserByUserId(userId);
    
    if (existingUser?.isBlocked) {
        await bot.sendMessage(chatId, "🚫 Bloklangansiz! 📞 " + ADMIN_PHONE, { parse_mode: "Markdown", ...removeKeyboard() });
        return;
    }
    
    try {
        await sendReminder(chatId);
        if (existingUser) {
            await bot.sendMessage(chatId, "👋 Xush kelibsiz, " + (existingUser.fullName || firstName) + "!\n📌 Versiya: `" + BOT_VERSION + "`", { parse_mode: "Markdown" });
            await sendMainMenu(chatId, isAdmin(userId));
        } else {
            await bot.sendMessage(chatId, "🚗 *ISUZU DOCTOR* ga xush kelibsiz!\n\n📱 Telefon raqamingizni yuboring:", { parse_mode: "Markdown", ...getPhoneKeyboard() });
        }
    } catch (error) { console.error("/start xatolik:", error); }
});

// -------------------- /info --------------------
bot.onText(/\/info/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, "ℹ️ *ISUZU DOCTOR BOT*\n\n🚗 Avtomobil diagnostikasi\n🎁 Har 5 diagnostikada 1 BEPUL\n📞 Aloqa: " + ADMIN_PHONE + "\n📌 Versiya: `" + BOT_VERSION + "`\n🔗 " + NEW_BOT_LINK + "\n📸 " + INSTAGRAM_LINK + "\n👥 " + TELEGRAM_GROUP_LINK + getAuthorInfo(), { parse_mode: "Markdown" });
});

// -------------------- BOSHQARUVCHI --------------------
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = query.from.id;
    
    await bot.answerCallbackQuery(query.id);
    
    if (data === "user_info") {
        await bot.sendMessage(chatId, "ℹ️ *ISUZU DOCTOR BOT*\n\n🚗 Avtomobil diagnostikasi\n🎁 Har 5 diagnostikada 1 BEPUL\n📌 Versiya: `" + BOT_VERSION + "`" + getAuthorInfo(), { parse_mode: "Markdown" });
    }
    else if (data === "user_payment") {
        await bot.sendMessage(chatId, getCardInfoMessage(), { parse_mode: "Markdown" });
    }
    else if (data === "user_instagram") {
        await bot.sendMessage(chatId, "📸 *INSTAGRAM*\n\n🔗 " + INSTAGRAM_LINK, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📸 Ochish", url: INSTAGRAM_LINK }]] } });
    }
    else if (data === "user_telegram_group") {
        await bot.sendMessage(chatId, "👥 *TELEGRAM GURUH*\n\n🔗 " + TELEGRAM_GROUP_LINK, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "👥 Ochish", url: TELEGRAM_GROUP_LINK }]] } });
    }
    else if (data === "user_version_info") {
        await bot.sendMessage(chatId, "📌 *VERSIYA*\n\n🔹 Bot versiyasi: `" + BOT_VERSION + "`\n🔹 Yangi bot: " + NEW_BOT_LINK + getAuthorInfo(), { parse_mode: "Markdown" });
    }
    else if (data === "back_to_main") {
        await sendMainMenu(chatId, isAdmin(userId));
    }
});

// -------------------- ISHGA TUSHIRISH --------------------
console.log("=".repeat(60));
console.log("🚗 ISUZU DOCTOR BOT");
console.log(`👨‍💻 Muallif: ${AUTHOR_NAME}`);
console.log(`📱 Telegram: ${AUTHOR_TELEGRAM}`);
console.log(`📜 ${COPYRIGHT_TEXT}`);
console.log("=".repeat(60));

loadData();
console.log(`✅ Bot ishlashga tayyor! Versiya: ${BOT_VERSION}`);
console.log(`👥 Foydalanuvchilar: ${users.filter(u => !u.isAdmin).length}`);

bot.on("polling_error", (error) => console.error("Polling xatolik:", error));
process.on("uncaughtException", (error) => console.error("Uncaught exception:", error));
