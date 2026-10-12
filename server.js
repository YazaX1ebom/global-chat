const WebSocket = require('ws');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 8080;
// Берем строку подключения из переменных окружения Render (или используем локальную для теста)
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = "chatApp";
const COLLECTION_NAME = "messages";

const wss = new WebSocket.Server({ port: PORT });

async function startServer() {
    let db, messagesCollection;

    try {
        // Подключаемся к MongoDB Atlas
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        messagesCollection = db.collection(COLLECTION_NAME);
        console.log("Успешное подключение к MongoDB Atlas!");
    } catch (err) {
        console.error("Ошибка подключения к MongoDB:", err);
        process.exit(1);
    }

    // Загружаем последние 1000 сообщений из базы при старте сервера
    let messages = [];
    try {
        messages = await messagesCollection.find().sort({ _id: 1 }).limit(10000).toArray();
        // Превращаем документы из базы в простой массив строк сообщений
        messages = messages.map(doc => doc.text);
    } catch (err) {
        console.error("Ошибка загрузки истории из базы:", err);
    }

    console.log(`Сервер чата запущен на порту ${PORT}. Загружено сообщений из БД: ${messages.length}`);

    wss.on('connection', (ws) => {
        console.log('Новый пользователь подключился!');

        // 1. Отправляем всю историю новому пользователю
        ws.send(JSON.stringify({
            type: 'history',
            data: messages
        }));

        ws.on('message', async (message) => {
            let messageText;
            try {
                messageText = message.toString();
            } catch (e) {
                messageText = message;
            }

            // Добавляем текущее время с секундами (например, [14:25:09])
            const now = new Date();
            const timeString = now.toTimeString().split(' ')[0];
            const fullMessageWithTime = `[${timeString}] ${messageText}`;

            console.log(`Получено сообщение: ${fullMessageWithTime}`);

            // Добавляем в локальный массив
            messages.push(fullMessageWithTime);
            if (messages.length > 10000) {
                messages.shift();
            }

            // Сохраняем сообщение в MongoDB Atlas навсегда
            try {
                await messagesCollection.insertOne({ text: fullMessageWithTime, createdAt: new Date() });
            } catch (err) {
                console.error("Ошибка сохранения сообщения в базу:", err);
            }

            // Рассылаем всем онлайн-пользователям
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'message',
                        data: fullMessageWithTime
                    }));
                }
            });
        });

        ws.on('close', () => {
            console.log('Пользователь отключился');
        });
    });
}

startServer();