import {
    encodeBulkString,
    encodeInteger,
    encodeSimpleError,
    encodeSimpleString,
    type RespValue
} from './resp.js';

type StoredEntry = {
    value: Buffer;
    expiresAt: number | null;
};

const store = new Map<string, StoredEntry>();

function getLiveEntry(key: string): StoredEntry | undefined {
    const entry = store.get(key);

    if (entry === undefined) {
        return undefined;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
    }

    return entry;
}

export function executeCommand(request: RespValue): Buffer {
    if (
        request.type !== 'array' ||
        request.value === null ||
        request.value.length === 0
    ) {
        return encodeSimpleError('ERR invalid command format');
    }

    const commandElement = request.value[0];

    if (
        commandElement.type !== 'bulkString' ||
        commandElement.value === null
    ) {
        return encodeSimpleError('ERR invalid command format');
    }

    const commandName = commandElement.value.toString('ascii').toUpperCase();
    const commandArguments: Buffer[] = [];

    for (const element of request.value.slice(1)) {
        if (
            element.type !== 'bulkString' ||
            element.value === null
        ) {
            return encodeSimpleError('ERR invalid command format');
        }

        commandArguments.push(element.value);
    }

    if (commandName === 'PING') {
        if (commandArguments.length !== 0) {
            return encodeSimpleError(
                "ERR wrong number of arguments for 'ping' command"
            );
        }

        return encodeSimpleString('PONG');
    }

    if (commandName === 'ECHO') {
        if (commandArguments.length !== 1) {
            return encodeSimpleError(
                "ERR wrong number of arguments for 'echo' command"
            );
        }

        return encodeBulkString(commandArguments[0]);
    }

    if (commandName === 'SET') {
        if (commandArguments.length !== 2) {
            return encodeSimpleError(
                "ERR wrong number of arguments for 'SET' command"
            );
        }

        const key = commandArguments[0].toString('utf8');
        const value = commandArguments[1];

        store.set(key, {
            value,
            expiresAt: null
        });

        return encodeSimpleString('OK');
    }

    if (commandName === 'GET') {
        if (commandArguments.length !== 1) {
            return encodeSimpleError(
                "ERR wrong number of arguments for 'GET' command"
            );
        }

        const key = commandArguments[0].toString('utf8');
        const entry = getLiveEntry(key);

        return encodeBulkString(entry?.value ?? null);
    }

    if (commandName === 'DEL') {
        if (commandArguments.length === 0) {
            return encodeSimpleError(
                "ERR wrong number of arguments for 'DEL' command"
            );
        }

        let removedCount = 0n;

        for (const argument of commandArguments) {
            const key = argument.toString('utf8');

            if (getLiveEntry(key) === undefined) {
                continue;
            }

            if (store.delete(key)) {
                removedCount++;
            }
        }

        return encodeInteger(removedCount);
    }

    if (commandName === 'EXISTS') {
        if (commandArguments.length === 0) {
            return encodeSimpleError(
                "ERR wrong number of arguments for 'EXISTS' command"
            );
        }

        let existingCount = 0n;

        for (const argument of commandArguments) {
            const key = argument.toString('utf8');

            if (getLiveEntry(key) !== undefined) {
                existingCount++;
            }
        }

        return encodeInteger(existingCount);
    }

    if (commandName === 'EXPIRE') {
        if (commandArguments.length !== 2) {
            return encodeSimpleError(
                "ERR wrong number of arguments for 'EXPIRE' command"
            );
        }

        const key = commandArguments[0].toString('utf8');
        const secondsText = commandArguments[1].toString('utf8');
        const seconds = Number(secondsText);

        if (!/^-?\d+$/.test(secondsText) || !Number.isSafeInteger(seconds)) {
            return encodeSimpleError(
                'ERR value is not an integer or out of range'
            );
        }

        const entry = getLiveEntry(key);

        if (entry === undefined) {
            return encodeInteger(0n);
        }

        if (seconds <= 0) {
            store.delete(key);
            return encodeInteger(1n);
        }

        const expiresAt = Date.now() + seconds * 1000;

        if (!Number.isSafeInteger(expiresAt)) {
            return encodeSimpleError('ERR expire time is out of range');
        }

        entry.expiresAt = expiresAt;
        return encodeInteger(1n);
    }

    return encodeSimpleError(`ERR unknown command '${commandName.toLowerCase()}'`);
}
