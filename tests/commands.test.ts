import test from 'node:test';
import assert from 'node:assert/strict';
import { executeCommand } from '../src/commands.js';
import type { RespValue } from '../src/resp.js';

function createCommand(...parts: string[]): RespValue {
    return {
        type: 'array',
        value: parts.map((part) => ({
            type: 'bulkString',
            value: Buffer.from(part)
        }))
    };
}

test('executes PING', () => {
    const result = executeCommand(createCommand('PING'));

    assert.deepStrictEqual(
        result,
        Buffer.from('+PONG\r\n')
    );
});

test('accepts command names case-insensitively', () => {
    const result = executeCommand(createCommand('ping'));

    assert.deepStrictEqual(
        result,
        Buffer.from('+PONG\r\n')
    );
});

test('executes ECHO', () => {
    const result = executeCommand(
        createCommand('ECHO', 'hello')
    );

    assert.deepStrictEqual(
        result,
        Buffer.from('$5\r\nhello\r\n')
    );
});

test('rejects ECHO without an argument', () => {
    const result = executeCommand(createCommand('ECHO'));

    assert.deepStrictEqual(
        result,
        Buffer.from(
            "-ERR wrong number of arguments for 'echo' command\r\n"
        )
    );
});

test('rejects an unknown command', () => {
    const result = executeCommand(
        createCommand('UNKNOWN')
    );

    assert.deepStrictEqual(
        result,
        Buffer.from("-ERR unknown command 'unknown'\r\n")
    );
});

test('rejects PING with arguments', () => {
    const result = executeCommand(
        createCommand('PING', 'unexpected')
    );

    assert.deepStrictEqual(
        result,
        Buffer.from(
            "-ERR wrong number of arguments for 'ping' command\r\n"
        )
    );
});