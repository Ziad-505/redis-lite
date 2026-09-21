import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import {
    createConnection,
    type Server
} from 'node:net';
import { createRedisServer } from '../src/server.js';

let server: Server;
let port: number;

before(async () => {
    server = createRedisServer();

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);

        server.listen(0, '127.0.0.1', () => {
            const address = server.address();

            if (address === null || typeof address === 'string') {
                reject(new Error('Server did not receive a TCP port'));
                return;
            }

            port = address.port;
            resolve();
        });
    });
});

after(async () => {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
});

function sendRequest(request: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const client = createConnection({
            host: '127.0.0.1',
            port
        });

        const responseChunks: Buffer[] = [];

        client.on('connect', () => {
            client.end(request);
        });

        client.on('data', (chunk) => {
            responseChunks.push(chunk);
        });

        client.on('end', () => {
            resolve(Buffer.concat(responseChunks));
        });

        client.on('error', reject);
    });
}

test('responds to PING over TCP', async () => {
    const response = await sendRequest(
        Buffer.from('*1\r\n$4\r\nPING\r\n')
    );

    assert.deepStrictEqual(
        response,
        Buffer.from('+PONG\r\n')
    );
});

test('responds to ECHO over TCP', async () => {
    const response = await sendRequest(
        Buffer.from(
            '*2\r\n' +
            '$4\r\nECHO\r\n' +
            '$5\r\nhello\r\n'
        )
    );

    assert.deepStrictEqual(
        response,
        Buffer.from('$5\r\nhello\r\n')
    );
});

test('processes pipelined commands over TCP', async () => {
    const response = await sendRequest(
        Buffer.from(
            '*1\r\n$4\r\nPING\r\n' +
            '*2\r\n$4\r\nECHO\r\n$2\r\nhi\r\n'
        )
    );

    assert.deepStrictEqual(
        response,
        Buffer.from(
            '+PONG\r\n' +
            '$2\r\nhi\r\n'
        )
    );
});

test('SET and GET work over TCP', async () => {
    const setResponse = await sendRequest(
        Buffer.from(
            '*3\r\n' +
            '$3\r\nSET\r\n' +
            '$8\r\ntcp-name\r\n' +
            '$4\r\nZiad\r\n'
        )
    );

    assert.deepStrictEqual(
        setResponse,
        Buffer.from('+OK\r\n')
    );

    const getResponse = await sendRequest(
        Buffer.from(
            '*2\r\n' +
            '$3\r\nGET\r\n' +
            '$8\r\ntcp-name\r\n'
        )
    );

    assert.deepStrictEqual(
        getResponse,
        Buffer.from('$4\r\nZiad\r\n')
    );
});