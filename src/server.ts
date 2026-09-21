import { createServer, type Server } from 'node:net';
import { executeCommand } from './commands.js';
import {
    encodeSimpleError,
    parseResp
} from './resp.js';

export function createRedisServer(): Server {
    return createServer((socket) => {
        let pendingInput = Buffer.alloc(0);

        socket.on('data', (chunk) => {
            pendingInput = Buffer.concat([
                pendingInput,
                chunk
            ]);

            try {
                while (pendingInput.length > 0) {
                    const result = parseResp(pendingInput);

                    if (result === null) {
                        break;
                    }

                    const response = executeCommand(result.value);
                    socket.write(response);

                    pendingInput = Buffer.from(
                        pendingInput.subarray(result.bytesRead)
                    );
                }
            } catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : 'Unknown protocol error';

                socket.end(
                    encodeSimpleError(`ERR Protocol error: ${message}`)
                );
            }
        });
    });
}
