import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import {
    createConnection,
    type Server,
    type Socket
} from 'node:net';
import { createRedisServer } from '../src/server.js';
import {
    encodeArray,
    encodeBulkString
} from '../src/resp.js';

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

        client.setTimeout(2_000, () => {
            client.destroy(new Error('TCP test request timed out'));
        });

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

function encodeCommand(...parts: string[]): Buffer {
    return encodeArray(
        parts.map((part) => encodeBulkString(Buffer.from(part)))
    );
}

function collectResponse(client: Socket): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const responseChunks: Buffer[] = [];

        client.setTimeout(2_000, () => {
            client.destroy(new Error('TCP test request timed out'));
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

test('EXPIRE zero removes a key over TCP', async () => {
    const response = await sendRequest(
        Buffer.concat([
            encodeCommand('SET', 'tcp-expire-zero', 'value'),
            encodeCommand('EXPIRE', 'tcp-expire-zero', '0'),
            encodeCommand('GET', 'tcp-expire-zero')
        ])
    );

    assert.deepStrictEqual(
        response,
        Buffer.from('+OK\r\n:1\r\n$-1\r\n')
    );
});

test('EXISTS and DEL update key presence over TCP', async () => {
    const response = await sendRequest(
        Buffer.concat([
            encodeCommand('SET', 'tcp-exists-del', 'value'),
            encodeCommand('EXISTS', 'tcp-exists-del'),
            encodeCommand('DEL', 'tcp-exists-del'),
            encodeCommand('EXISTS', 'tcp-exists-del')
        ])
    );

    assert.deepStrictEqual(
        response,
        Buffer.from('+OK\r\n:1\r\n:1\r\n:0\r\n')
    );
});

test('buffers a RESP request split across TCP writes', async () => {
    let firstDataTimeout: ReturnType<typeof setTimeout>;

    const serverReceivedFirstFragment = new Promise<void>((resolve, reject) => {
        firstDataTimeout = setTimeout(() => {
            reject(new Error('Server did not receive the first fragment'));
        }, 2_000);

        server.once('connection', (serverSocket) => {
            serverSocket.once('data', () => {
                clearTimeout(firstDataTimeout);
                resolve();
            });
        });
    });

    const client = createConnection({
        host: '127.0.0.1',
        port
    });
    const responsePromise = collectResponse(client);

    await new Promise<void>((resolve, reject) => {
        client.once('connect', resolve);
        client.once('error', reject);
    });

    client.write(Buffer.from('*1\r\n$4\r\nPI'));

    // This confirms the incomplete fragment reached the server before the
    // remainder is written, without assuming TCP always preserves writes.
    await serverReceivedFirstFragment;

    client.end(Buffer.from('NG\r\n'));

    assert.deepStrictEqual(
        await responsePromise,
        Buffer.from('+PONG\r\n')
    );
});
