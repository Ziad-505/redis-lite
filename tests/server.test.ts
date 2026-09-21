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
        const handleError = (error: Error) => {
            reject(error);
        };

        server.once('error', handleError);

        server.listen(0, '127.0.0.1', () => {
            server.off('error', handleError);

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

function waitForConnection(client: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            client.destroy();
            reject(new Error('TCP test connection timed out'));
        }, 2_000);

        const handleConnect = () => {
            cleanup();
            resolve();
        };

        const handleError = (error: Error) => {
            cleanup();
            reject(error);
        };

        const cleanup = () => {
            clearTimeout(timeout);
            client.off('connect', handleConnect);
            client.off('error', handleError);
        };

        client.once('connect', handleConnect);
        client.once('error', handleError);
    });
}

function collectResponse(client: Socket): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            client.destroy();
            reject(new Error('TCP test response timed out'));
        }, 2_000);

        const responseChunks: Buffer[] = [];

        const handleData = (chunk: Buffer) => {
            responseChunks.push(chunk);
        };

        const handleEnd = () => {
            cleanup();
            resolve(Buffer.concat(responseChunks));
        };

        const handleError = (error: Error) => {
            cleanup();
            client.destroy();
            reject(error);
        };

        const cleanup = () => {
            clearTimeout(timeout);
            client.off('data', handleData);
            client.off('end', handleEnd);
            client.off('error', handleError);
        };

        client.on('data', handleData);
        client.once('end', handleEnd);
        client.once('error', handleError);
    });
}

function encodeCommand(...parts: string[]): Buffer {
    return encodeArray(
        parts.map((part) => encodeBulkString(Buffer.from(part)))
    );
}

async function sendRequest(request: Buffer): Promise<Buffer> {
    const client = createConnection({
        host: '127.0.0.1',
        port
    });

    await waitForConnection(client);

    const responsePromise = collectResponse(client);
    client.end(request);

    return responsePromise;
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
    let cancelFragmentObservation = () => {};

    const serverReceivedFirstFragment = new Promise<void>((resolve, reject) => {
        let serverSocket: Socket | undefined;
        let settled = false;

        const timeout = setTimeout(() => {
            cleanup();
            settled = true;
            reject(new Error('Server did not receive the first fragment'));
        }, 2_000);

        const handleData = () => {
            cleanup();
            settled = true;
            resolve();
        };

        const handleConnection = (socket: Socket) => {
            serverSocket = socket;
            serverSocket.once('data', handleData);
        };

        const cleanup = () => {
            clearTimeout(timeout);
            server.off('connection', handleConnection);
            serverSocket?.off('data', handleData);
        };

        cancelFragmentObservation = () => {
            if (settled) {
                return;
            }

            cleanup();
            settled = true;
            resolve();
        };

        server.once('connection', handleConnection);
    });

    const client = createConnection({
        host: '127.0.0.1',
        port
    });

    try {
        await waitForConnection(client);

        const responsePromise = collectResponse(client);
        client.write(Buffer.from('*1\r\n$4\r\nPI'));

        // Confirm the incomplete fragment reached the server before writing
        // the remainder. TCP does not guarantee one event per client write.
        await serverReceivedFirstFragment;

        client.end(Buffer.from('NG\r\n'));

        assert.deepStrictEqual(
            await responsePromise,
            Buffer.from('+PONG\r\n')
        );
    } finally {
        cancelFragmentObservation();

        if (!client.destroyed) {
            client.destroy();
        }
    }
});
