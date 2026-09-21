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

test('SET replaces an existing value', () => {
    executeCommand(
        createCommand('SET', 'name', 'Ziad')
    );

    executeCommand(
        createCommand('SET', 'name', 'Omar')
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

test('DEL removes the key and value from store', () => {
    executeCommand(
        createCommand('SET', 'name', 'Ziad')
    );

    const delResponse = executeCommand(
        createCommand('DEL', 'name')
    );

    assert.deepStrictEqual(
        delResponse,
        Buffer.from(':1\r\n')
    );

    const getResponse = executeCommand(
        createCommand('GET', 'name')
    );

    assert.deepStrictEqual(
        getResponse,
        Buffer.from('$-1\r\n')
    );
});

test('DEL returns 0 for a missing key', () => {
    const delResponse = executeCommand(
        createCommand('DEL', 'game')
    );

    assert.deepStrictEqual(
        delResponse,
        Buffer.from(':0\r\n')
    );
});

test('DEL rejects a missing argument', () => {
    const delResponse = executeCommand(
        createCommand('DEL')
    );

    assert.deepStrictEqual(
        delResponse,
        Buffer.from("-ERR wrong number of arguments for 'DEL' command\r\n")
    );
});

test('DEL removes multiple keys and returns their count', () => {
    executeCommand(
        createCommand('SET', 'name', 'Ziad')
    );
    executeCommand(createCommand('SET', 'day', 'monday'));
    executeCommand(createCommand('SET', 'gender', 'male'));

    const delResponse = executeCommand(
        createCommand('DEL', 'name', 'day', 'gender')
    );

    assert.deepStrictEqual(
        delResponse,
        Buffer.from(':3\r\n')
    );

    for (const key of ['name', 'day', 'gender']) {
        const getResponse = executeCommand(
            createCommand('GET', key)
        );

        assert.deepStrictEqual(
            getResponse,
            Buffer.from('$-1\r\n')
        );
    }
});

test('DEL counts a repeated key only once', () => {
    executeCommand(
        createCommand('SET', 'name', 'Ziad')
    );

    const delResponse = executeCommand(
        createCommand('DEL', 'name', 'name', 'notReal')
    );

    assert.deepStrictEqual(
        delResponse,
        Buffer.from(':1\r\n')
    );
});

test('EXISTS returns 1 for an existing key', () => {
    executeCommand(
        createCommand('SET', 'name', 'Ziad')
    );

    const existsResponse = executeCommand(
        createCommand('EXISTS', 'name')
    );

    assert.deepStrictEqual(
        existsResponse,
        Buffer.from(':1\r\n')
    );

    const getResponse = executeCommand(
        createCommand('GET', 'name')
    );

    assert.deepStrictEqual(
        getResponse,
        Buffer.from('$4\r\nZiad\r\n')
    );
});

test('EXISTS returns 0 for a key that was never saved', () => {
    const existsResponse = executeCommand(
        createCommand('EXISTS', 'exists-never-saved')
    );

    assert.deepStrictEqual(
        existsResponse,
        Buffer.from(':0\r\n')
    );
});

test('EXISTS rejects a missing key argument', () => {
    const existsResponse = executeCommand(
        createCommand('EXISTS')
    );

    assert.deepStrictEqual(
        existsResponse,
        Buffer.from("-ERR wrong number of arguments for 'EXISTS' command\r\n")
    );
});

test('EXISTS counts multiple existing keys', () => {
    executeCommand(
        createCommand('SET', 'name', 'Ziad')
    );
    executeCommand(createCommand('SET', 'day', 'monday'));
    executeCommand(createCommand('SET', 'gender', 'male'));

    const existsResponse = executeCommand(
        createCommand('EXISTS', 'name', 'day', 'gender')
    );

    assert.deepStrictEqual(
        existsResponse,
        Buffer.from(':3\r\n')
    );
});

test('EXISTS counts repeated existing keys', () => {
    executeCommand(
        createCommand('SET', 'color', 'red')
    );

    const existsResponse = executeCommand(
        createCommand('EXISTS', 'color', 'color')
    );

    assert.deepStrictEqual(
        existsResponse,
        Buffer.from(':2\r\n')
    );
});

test('EXPIRE with zero seconds deletes the key immediately', () => {
    executeCommand(
        createCommand('SET', 'color', 'red')
    );

    const expireResponse = executeCommand(
        createCommand('EXPIRE', 'color', '0')
    );

    assert.deepStrictEqual(
        expireResponse,
        Buffer.from(':1\r\n')
    );

    const getResponse = executeCommand(createCommand('GET', 'color'));

    assert.deepStrictEqual(
        getResponse,
        Buffer.from('$-1\r\n')
    );
});

test('EXPIRE rejects incorrect argument counts', () => {
    const noArgumentsResponse = executeCommand(
        createCommand('EXPIRE')
    );

    assert.deepStrictEqual(
        noArgumentsResponse,
        Buffer.from("-ERR wrong number of arguments for 'EXPIRE' command\r\n")
    );

    const missingDurationResponse = executeCommand(
        createCommand('EXPIRE', 'only-key')
    );

    assert.deepStrictEqual(
        missingDurationResponse,
        Buffer.from("-ERR wrong number of arguments for 'EXPIRE' command\r\n")
    );

    const extraArgumentResponse = executeCommand(
        createCommand('EXPIRE', 'key', '10', 'extra')
    );

    assert.deepStrictEqual(
        extraArgumentResponse,
        Buffer.from("-ERR wrong number of arguments for 'EXPIRE' command\r\n")
    );
});

test('EXPIRE returns 0 for a key that was never saved', () => {
    const expireResponse = executeCommand(
        createCommand('EXPIRE', 'expire-never-saved', '10')
    );

    assert.deepStrictEqual(
        expireResponse,
        Buffer.from(':0\r\n')
    );
});

test('EXPIRE rejects invalid durations', () => {
    executeCommand(
        createCommand('SET', 'sky', 'blue')
    );

    const expireResponse = executeCommand(
        createCommand('EXPIRE', 'sky', 'invalid')
    );

    assert.deepStrictEqual(
        expireResponse,
        Buffer.from('-ERR value is not an integer or out of range\r\n')
    );

    const getResponse = executeCommand(createCommand('GET', 'sky'));

    assert.deepStrictEqual(
        getResponse,
        Buffer.from('$4\r\nblue\r\n')
    );
});

test('EXPIRE rejects malformed durations without changing values', () => {
    const invalidDurations = ['1.5', '', '10abc'];

    for (const [index, duration] of invalidDurations.entries()) {
        const key = `malformed-expire-${index}`;

        executeCommand(
            createCommand('SET', key, 'value')
        );

        const expireResponse = executeCommand(
            createCommand('EXPIRE', key, duration)
        );

        assert.deepStrictEqual(
            expireResponse,
            Buffer.from('-ERR value is not an integer or out of range\r\n')
        );

        assert.deepStrictEqual(
            executeCommand(createCommand('GET', key)),
            Buffer.from('$5\r\nvalue\r\n')
        );
    }
});

test('EXPIRE rejects unsafe integer durations', () => {
    executeCommand(
        createCommand('SET', 'name', 'loola')
    );

    const expireResponse = executeCommand(
        createCommand('EXPIRE', 'name', '9007199254740992')
    );

    assert.deepStrictEqual(
        expireResponse,
        Buffer.from('-ERR value is not an integer or out of range\r\n')
    );
});

test('EXPIRE rejects deadlines outside the safe integer range', () => {
    executeCommand(
        createCommand('SET', 'name', 'loola')
    );

    const expireResponse = executeCommand(
        createCommand('EXPIRE', 'name', '9007199254740991')
    );

    assert.deepStrictEqual(
        expireResponse,
        Buffer.from('-ERR expire time is out of range\r\n')
    );
});

test('EXPIRE with negative seconds deletes immediately', () => {
    executeCommand(
        createCommand('SET', 'name', 'loola')
    );

    const expireResponse = executeCommand(
        createCommand('EXPIRE', 'name', '-1')
    );

    assert.deepStrictEqual(
        expireResponse,
        Buffer.from(':1\r\n')
    );

    const getResponse = executeCommand(createCommand('GET', 'name'));

    assert.deepStrictEqual(
        getResponse,
        Buffer.from('$-1\r\n')
    );
});

test('EXPIRE keeps a value available before its deadline', (t) => {
    let now = 1_000_000;
    t.mock.method(Date, 'now', () => now);

    executeCommand(
        createCommand('SET', 'expire-before-deadline', 'alive')
    );

    const expireResponse = executeCommand(
        createCommand('EXPIRE', 'expire-before-deadline', '10')
    );

    assert.deepStrictEqual(
        expireResponse,
        Buffer.from(':1\r\n')
    );

    now += 9_000;

    const getResponse = executeCommand(
        createCommand('GET', 'expire-before-deadline')
    );

    assert.deepStrictEqual(
        getResponse,
        Buffer.from('$5\r\nalive\r\n')
    );
});

test('GET treats a key as missing at its expiration deadline', (t) => {
    let now = 2_000_000;
    t.mock.method(Date, 'now', () => now);

    executeCommand(
        createCommand('SET', 'expire-at-deadline', 'value')
    );
    executeCommand(
        createCommand('EXPIRE', 'expire-at-deadline', '10')
    );

    now += 10_000;

    const getResponse = executeCommand(
        createCommand('GET', 'expire-at-deadline')
    );

    assert.deepStrictEqual(
        getResponse,
        Buffer.from('$-1\r\n')
    );
});

test('EXISTS does not count expired keys', (t) => {
    let now = 3_000_000;
    t.mock.method(Date, 'now', () => now);

    executeCommand(
        createCommand('SET', 'expired-exists', 'value')
    );
    executeCommand(
        createCommand('EXPIRE', 'expired-exists', '10')
    );

    now += 10_000;

    const existsResponse = executeCommand(
        createCommand('EXISTS', 'expired-exists')
    );

    assert.deepStrictEqual(
        existsResponse,
        Buffer.from(':0\r\n')
    );
});

test('DEL does not count expired keys', (t) => {
    let now = 4_000_000;
    t.mock.method(Date, 'now', () => now);

    executeCommand(
        createCommand('SET', 'expired-del', 'value')
    );
    executeCommand(
        createCommand('EXPIRE', 'expired-del', '10')
    );

    now += 10_000;

    const delResponse = executeCommand(
        createCommand('DEL', 'expired-del')
    );

    assert.deepStrictEqual(
        delResponse,
        Buffer.from(':0\r\n')
    );
});

test('EXPIRE returns 0 for an already expired key', (t) => {
    let now = 5_000_000;
    t.mock.method(Date, 'now', () => now);

    executeCommand(
        createCommand('SET', 'expired-again', 'value')
    );
    executeCommand(
        createCommand('EXPIRE', 'expired-again', '10')
    );

    now += 10_000;

    const expireResponse = executeCommand(
        createCommand('EXPIRE', 'expired-again', '20')
    );

    assert.deepStrictEqual(
        expireResponse,
        Buffer.from(':0\r\n')
    );

    assert.deepStrictEqual(
        executeCommand(createCommand('GET', 'expired-again')),
        Buffer.from('$-1\r\n')
    );
});

test('SET clears an existing expiration', (t) => {
    let now = 6_000_000;
    t.mock.method(Date, 'now', () => now);

    executeCommand(
        createCommand('SET', 'set-clears-expiration', 'old')
    );
    executeCommand(
        createCommand('EXPIRE', 'set-clears-expiration', '10')
    );

    now += 9_000;

    executeCommand(
        createCommand('SET', 'set-clears-expiration', 'new')
    );

    now += 2_000;

    assert.deepStrictEqual(
        executeCommand(createCommand('GET', 'set-clears-expiration')),
        Buffer.from('$3\r\nnew\r\n')
    );
});

test('EXPIRE replaces an existing deadline', (t) => {
    let now = 7_000_000;
    t.mock.method(Date, 'now', () => now);

    executeCommand(
        createCommand('SET', 'replace-expiration', 'alive')
    );
    executeCommand(
        createCommand('EXPIRE', 'replace-expiration', '10')
    );
    executeCommand(
        createCommand('EXPIRE', 'replace-expiration', '20')
    );

    now += 10_000;

    assert.deepStrictEqual(
        executeCommand(createCommand('GET', 'replace-expiration')),
        Buffer.from('$5\r\nalive\r\n')
    );

    now += 10_000;

    assert.deepStrictEqual(
        executeCommand(createCommand('GET', 'replace-expiration')),
        Buffer.from('$-1\r\n')
    );
});

test('keys without expiration remain available after time advances', (t) => {
    let now = 8_000_000;
    t.mock.method(Date, 'now', () => now);

    executeCommand(
        createCommand('SET', 'no-expiration', 'kept')
    );

    now += 1_000_000;

    assert.deepStrictEqual(
        executeCommand(createCommand('GET', 'no-expiration')),
        Buffer.from('$4\r\nkept\r\n')
    );
});

test('invalid EXPIRE leaves an existing deadline unchanged', (t) => {
    let now = 9_000_000;
    t.mock.method(Date, 'now', () => now);

    executeCommand(
        createCommand('SET', 'invalid-keeps-deadline', 'safe')
    );
    executeCommand(
        createCommand('EXPIRE', 'invalid-keeps-deadline', '10')
    );

    const invalidResponse = executeCommand(
        createCommand('EXPIRE', 'invalid-keeps-deadline', 'invalid')
    );

    assert.deepStrictEqual(
        invalidResponse,
        Buffer.from('-ERR value is not an integer or out of range\r\n')
    );

    now += 9_000;

    assert.deepStrictEqual(
        executeCommand(createCommand('GET', 'invalid-keeps-deadline')),
        Buffer.from('$4\r\nsafe\r\n')
    );

    now += 1_000;

    assert.deepStrictEqual(
        executeCommand(createCommand('GET', 'invalid-keeps-deadline')),
        Buffer.from('$-1\r\n')
    );
});
