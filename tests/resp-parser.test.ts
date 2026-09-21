import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResp } from '../src/resp.js';

test('parses a RESP simple string', () => {
    const input = Buffer.from('+OK\r\n');

    assert.deepStrictEqual(parseResp(input), {
        value: {
            type: 'simpleString',
            value: 'OK'
        },
        bytesRead: input.length
    });
});

test('parses a RESP simple error', () => {
    const input = Buffer.from('-ERR failure\r\n');

    assert.deepStrictEqual(parseResp(input), {
        value: {
            type: 'simpleError',
            value: 'ERR failure'
        },
        bytesRead: input.length
    });
});

test('parses a RESP integer', () => {
    const input = Buffer.from(':-42\r\n');

    assert.deepStrictEqual(parseResp(input), {
        value: {
            type: 'integer',
            value: -42n
        },
        bytesRead: input.length
    });
});

test('returns null for incomplete RESP input', () => {
    const input = Buffer.from('+OK\r');

    assert.strictEqual(parseResp(input), null);
});

test('reports only the bytes consumed by the first value', () => {
    const input = Buffer.from('+OK\r\n:1\r\n');

    assert.deepStrictEqual(parseResp(input), {
        value: {
            type: 'simpleString',
            value: 'OK'
        },
        bytesRead: Buffer.byteLength('+OK\r\n')
    });
});

test('rejects an invalid RESP integer', () => {
    assert.throws(
        () => parseResp(Buffer.from(':12.5\r\n')),
        /Invalid RESP integer/
    );
});

test('parses a RESP bulk string', () => {
    const input = Buffer.from('$5\r\nhello\r\n');

    assert.deepStrictEqual(parseResp(input), {
        value: {
            type: 'bulkString',
            value: Buffer.from('hello')
        },
        bytesRead: input.length
    });
});

test('parses an empty RESP bulk string', () => {
    const input = Buffer.from('$0\r\n\r\n');

    assert.deepStrictEqual(parseResp(input), {
        value: {
            type: 'bulkString',
            value: Buffer.alloc(0)
        },
        bytesRead: input.length
    });
});

test('parses a null RESP bulk string', () => {
    const input = Buffer.from('$-1\r\n');

    assert.deepStrictEqual(parseResp(input), {
        value: {
            type: 'bulkString',
            value: null
        },
        bytesRead: input.length
    });
});

test('uses the declared byte length for a RESP bulk string', () => {
    const input = Buffer.from('$4\r\n😀\r\n');

    assert.deepStrictEqual(parseResp(input), {
        value: {
            type: 'bulkString',
            value: Buffer.from('😀')
        },
        bytesRead: input.length
    });
});

test('returns null for an incomplete RESP bulk string', () => {
    assert.strictEqual(
        parseResp(Buffer.from('$5\r\nhel')),
        null
    );
});

test('rejects an invalid RESP bulk string terminator', () => {
    assert.throws(
        () => parseResp(Buffer.from('$5\r\nhelloXX')),
        /Invalid RESP bulk string terminator/
    );
});