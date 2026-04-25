// ========================================
// ISUZU DOCTOR BOT
// Muallif: Erkinjon Shukurov
// Telegram: @erkinjon_01_01
//  2024-2026 Erkinjon Shukurov
// ========================================

const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN || '8779251766:AAH12INusgBCawsk5awqIjcyHnNLiq5A33A';
const ADMIN_IDS = [1437230485];
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');

// -------------------- AVTORLIK --------------------
const AUTHOR = "Erkinjon Shukurov";
const AUTHOR_TG = "@erkinjon_01_01";

// -------------------- VOLUME --------------------
if (!fs.existsSync(VOLUME_PATH)) fs.mkdirSync(VOLUME_PATH, { recursive: true });
const USERS_FILE = path.join(VOLUME_PATH, 'users.json');
let users = [];

function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        else users = [];
        console.log(` ${users.length} foydalanuvchi yuklandi`);
    } catch(e) { users = []; }
}
function saveUsers() { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }

function getUser(userId) { return users.find(u => u.id === userId); }
function isAdmin(userId) { return ADMIN_IDS.includes(userId); }

// -------------------- ASOSIY MENYU --------------------
const mainMenu = {
    reply_markup: {
        inline_keyboard: [
            [{ text: " Profil", callback_data: "profile" }, { text: " Avtomobillar", callback_data: "cars" }],
            [{ text: " Bonus", callback_data: "bonus" }, { text: " Avto qo'shish", callback_data: "add_car" }],
            [{ text: " Tarix", callback_data: "history" }, { text: " To'lov", callback_data: "payment" }],
            [{ text: "? Ma'lumot", callback_data: "info" }]
        ]
    }
};

// -------------------- BOT --------------------
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.deleteWebHook().catch(() => {});

// -------------------- START --------------------
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const name = msg.from.first_name || "";

    loadUsers();
    let user = getUser(userId);
    
    if (!user) {
        user = { id: userId, name: name, cars: [], created: new Date().toISOString() };
        users.push(user);
        saveUsers();
        await bot.sendMessage(chatId, ` *ISUZU DOCTOR*\n\n Xush kelibsiz, ${name}!\n Versiya: 2.1.0\n\n ${AUTHOR}\n ${AUTHOR_TG}`, { parse_mode: "Markdown", ...mainMenu });
    } else {
        await bot.sendMessage(chatId, ` Xush kelibsiz, ${user.name || name}!\n\n ${AUTHOR}\n ${AUTHOR_TG}`, { parse_mode: "Markdown", ...mainMenu });
    }
});

// -------------------- INFO --------------------
bot.onText(/\/info/, async (msg) => {
    await bot.sendMessage(msg.chat.id, 
        `? *ISUZU DOCTOR BOT*\n\n Avtomobil diagnostikasi\n 5 diagnostika = 1 BEPUL\n Versiya: 2.1.0\n\n *Muallif:* ${AUTHOR}\n *Telegram:* ${AUTHOR_TG}\n  2024-2026 ${AUTHOR}`, 
        { parse_mode: "Markdown" }
    );
});

// -------------------- CALLBACK --------------------
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    await bot.answerCallbackQuery(query.id);

    if (data === "info") {
        await bot.sendMessage(chatId, `? *BOT MA'LUMOTI*\n\n ISUZU diagnostika boti\n 5 ta to'lovli diagnostika = 1 BEPUL\n Versiya: 2.1.0\n\n *Muallif:* ${AUTHOR}\n *Telegram:* ${AUTHOR_TG}`, { parse_mode: "Markdown" });
    }
    else if (data === "payment") {
        await bot.sendMessage(chatId, ` *TO'LOV MA'LUMOTLARI*\n\nKarta: 9860 0401 1522 0143\nEgasi: Erkinjon Shukurov\nBank: Xalq Bank`, { parse_mode: "Markdown" });
    }
    else if (data === "profile" || data === "cars" || data === "bonus" || data === "add_car" || data === "history") {
        await bot.sendMessage(chatId, ` *Bu funksiya ishlab chiqilmoqda*\n\n ${AUTHOR}\n ${AUTHOR_TG}`, { parse_mode: "Markdown" });
    }
});

// -------------------- ISHGA TUSHIRISH --------------------
loadUsers();
console.log("=".repeat(50));
console.log(" ISUZU DOCTOR BOT");
console.log(` ${AUTHOR}`);
console.log(` ${AUTHOR_TG}`);
console.log("=".repeat(50));
console.log(" Bot ishlayapti!");
