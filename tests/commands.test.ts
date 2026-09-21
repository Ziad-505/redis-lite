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

test('SET saves a value that GET retrieves', () => {
    const setResponse = executeCommand(
        createCommand('SET', 'name', 'Ziad')
    );

    assert.deepStrictEqual(
        setResponse,
        Buffer.from('+OK\r\n')
    );

    const getResponse = executeCommand(
        createCommand('GET', 'name')
    );

    assert.deepStrictEqual(
        getResponse,
        Buffer.from('$4\r\nZiad\r\n')
    );
});

test('SET replaces an existing variable', () => {
    const setResponse = executeCommand(
        createCommand('SET', 'name', 'Ziad')
    );

    executeCommand(
        createCommand('SET', 'name', 'Omar')
    );

    assert.deepStrictEqual(
        setResponse,
        Buffer.from('+OK\r\n')
    );

    const getResponse = executeCommand(
        createCommand('GET', 'name')
    );

    assert.deepStrictEqual(
        getResponse,
        Buffer.from('$4\r\nOmar\r\n')
    );
});

test('GET returns null for a missing key', () => {

    const getResponse = executeCommand(
        createCommand('GET', 'day')
    );

    assert.deepStrictEqual(
        getResponse,
        Buffer.from('$-1\r\n')
    );
});

test('SET rejects a missing value', () => {

    const setResponse = executeCommand(
        createCommand('SET', 'name')
    );

    assert.deepStrictEqual(
        setResponse,
        Buffer.from("-ERR wrong number of arguments for 'SET' command\r\n")
    );
});

test('GET rejects a missing key', () => {

    const getResponse = executeCommand(
        createCommand('GET')
    );

    assert.deepStrictEqual(
        getResponse,
        Buffer.from("-ERR wrong number of arguments for 'GET' command\r\n")
    );
});