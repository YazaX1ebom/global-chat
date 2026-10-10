const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Путь к файлу для сохранения истории сообщений
const HISTORY_FILE = path.join(__dirname, 'messages.json');

// Функция для чтения истории из файла
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Ошибка чтения истории:', err);
    }
    return [];
}

// Функция для сохранения истории в файл
function saveHistory(messages) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(messages, null, 2));
    } catch (err) {
        console.error('Ошибка сохранения истории:', err);
    }
}

// Загружаем существующую историю при старте сервера
let messages = loadHistory();

console.log(`Сервер чата запущен на порту ${PORT}. Загружено сообщений: ${messages.length}`);

wss.on('connection', (ws) => {
    console.log('Новый пользователь подключился!');

    // 1. При подключении сразу отправляем новому пользователю всю историю сообщений
    ws.send(JSON.stringify({
        type: 'history',
        data: messages
    }));

    ws.on('message', (message) => {
        let messageText;
        try {
            messageText = message.toString();
        } catch (e) {
            messageText = message;
        }

        console.log(`Получено сообщение: ${messageText}`);

        // Добавляем новое сообщение в массив истории
        messages.push(messageText);

        // Ограничим историю последними 100 сообщениями, чтобы файл не раздувался
        if (messages.length > 100) {
            messages.shift();
        }

        // Сохраняем обновленную историю на диск
        saveHistory(messages);

        // Рассылаем сообщение всем подключенным клиентам в реальном времени
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'message',
                    data: messageText
                }));
            }
        });
    });

    ws.on('close', () => {
        console.log('Пользователь отключился');
    });
});