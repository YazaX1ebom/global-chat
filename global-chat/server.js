const WebSocket = require('ws');

// Render автоматически передает порт, либо используем 8080 для локального теста
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

console.log(`Сервер чата запущен на порту ${port}`);

wss.on('connection', (ws) => {
    console.log('Новый пользователь подключился!');

    ws.on('message', (message) => {
        console.log(`Получено сообщение: ${message}`);

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        });
    });

    ws.on('close', () => {
        console.log('Пользователь отключился');
    });
});