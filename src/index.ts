import { createRedisServer } from './server.js';

const port = 6379;
const host = '127.0.0.1';

const server = createRedisServer();

server.listen(port, host, () => {
    console.log(
        `Redis Lite listening on ${host}:${port}`
    );
});

server.on('error', (error) => {
    console.error('Server error:', error);
});