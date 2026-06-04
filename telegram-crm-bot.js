// Telegram-бот для уведомлений о новых сделках из Bitrix24

import { Bot } from 'grammy';
import cron from 'node-cron';

// Конфигурация из переменных окружения
const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.BASE_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// Проверка наличия всех необходимых переменных
if (!API_KEY || !BASE_URL || !BOT_TOKEN || !CHAT_ID) {
    console.error('❌ Ошибка: отсутствуют необходимые переменные окружения!');
    console.error('Проверьте: API_KEY, BASE_URL, BOT_TOKEN, CHAT_ID');
    process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

const HEADERS = {
    'X-Api-Key': API_KEY,
    'Content-Type': 'application/json',
};

// Храним ID последней обработанной сделки
let lastSeenDealId = 0;

// Остальной код без изменений...
async function fetchNewDeals() {
    try {
        const response = await fetch(
            `${BASE_URL}/v1/deals/search`,
            {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    filter: {
                        id: { $gt: lastSeenDealId },
                        stageId: 'NEW',
                    },
                    sort: 'id',
                    select: ['id', 'title', 'amount', 'currency', 'contactId', 'createdAt'],
                }),
            }
        );
        const { data } = await response.json();
        return data || [];
    } catch (error) {
        console.error('Ошибка при получении сделок:', error.message);
        return [];
    }
}

async function fetchContactName(contactId) {
    if (!contactId) return 'Не указан';
    try {
        const response = await fetch(`${BASE_URL}/v1/contacts/${contactId}`, {
            headers: { 'X-Api-Key': API_KEY },
        });
        const { data } = await response.json();
        return `${data.name || ''} ${data.lastName || ''}`.trim();
    } catch {
        return 'Не удалось загрузить';
    }
}

function formatDealMessage(deal, contactName) {
    return [
        `🆕 <b>Новая сделка</b>`,
        ``,
        `📋 <b>Название:</b> ${deal.title}`,
        `💰 <b>Сумма:</b> ${deal.amount || '0'} ${deal.currency || 'RUB'}`,
        `👤 <b>Контакт:</b> ${contactName}`,
        `📅 <b>Создана:</b> ${new Date(deal.createdAt).toLocaleString('ru-RU')}`,
        `🔗 <b>ID:</b> ${deal.id}`,
    ].join('\n');
}

async function checkAndNotify() {
    console.log(`[${new Date().toISOString()}] Проверяем новые сделки...`);
    const deals = await fetchNewDeals();
    for (const deal of deals) {
        const contactName = await fetchContactName(deal.contactId);
        const message = formatDealMessage(deal, contactName);
        await bot.api.sendMessage(CHAT_ID, message, { parse_mode: 'HTML' });
        console.log(`Уведомление отправлено: сделка #${deal.id}`);
        lastSeenDealId = Math.max(lastSeenDealId, deal.id);
    }
    if (deals.length === 0) {
        console.log('Новых сделок нет');
    }
}

bot.command('start', (ctx) => {
    ctx.reply('👋 Бот CRM-уведомлений запущен! Вы будете получать сообщения о новых сделках.');
});

bot.command('status', (ctx) => {
    ctx.reply(`📊 Последний обработанный ID сделки: ${lastSeenDealId}`);
});

cron.schedule('*/2 * * * *', checkAndNotify);
bot.start();
console.log('🤖 Telegram CRM-бот запущен');