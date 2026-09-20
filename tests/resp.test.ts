import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeInteger, encodeSimpleString, encodeSimpleError } from '../src/resp.js';

test('encodes a RESP simple string', () => {
    const result = encodeSimpleString('OK');
    const expected = Buffer.from('+OK\r\n');
    assert.deepStrictEqual(result, expected);
});

test('rejects a carriage return in a RESP simple string', () => {
    assert.throws(
        () => encodeSimpleString('hello\rworld'),
        /must not contain CR or LF/
    );
});

test('rejects a line feed in a RESP simple string', () => {
    assert.throws(
        () => encodeSimpleString('hello\nworld'),
        /must not contain CR or LF/
    );
});

test('encodes a RESP simple error', () => {
    const result = encodeSimpleError('ERR unknown command');

    const expected = Buffer.from('-ERR unknown command\r\n');

    assert.deepStrictEqual(result, expected);
});

test('rejects a carriage return in a RESP simple error', () => {
    assert.throws(
        () => encodeSimpleError('ERR bad\rmessage'),
        /must not contain CR or LF/
    );
});

test('rejects a line feed in a RESP simple error', () => {
    assert.throws(
        () => encodeSimpleError('ERR bad\nmessage'),
        /must not contain CR or LF/
    );
});

test('encodes a positive RESP integer', () => {
    const result = encodeInteger(42n);

    assert.deepStrictEqual(result, Buffer.from(':42\r\n'));
});

test('encodes a negative RESP integer', () => {
    const result = encodeInteger(-42n);

    assert.deepStrictEqual(result, Buffer.from(':-42\r\n'));
});

test('encodes zero as a RESP integer', () => {
    const result = encodeInteger(0n);

    assert.deepStrictEqual(result, Buffer.from(':0\r\n'));
});

test('rejects an integer above the signed 64-bit range', () => {
    assert.throws(
        () => encodeInteger(9_223_372_036_854_775_808n),
        /signed 64-bit range/
    );
});

test('rejects an integer below the signed 64-bit range', () => {
    assert.throws(
        () => encodeInteger(-9_223_372_036_854_775_809n),
        /signed 64-bit range/
    );
});