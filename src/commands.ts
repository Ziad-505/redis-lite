import {
    encodeBulkString,
    encodeSimpleError,
    encodeSimpleString,
    type RespValue
} from './resp.js';

const store = new Map<string, Buffer>();

export function executeCommand(request: RespValue): Buffer {
    if (
        request.type !== 'array' ||
        request.value === null ||
        request.value.length === 0
    ) {
        return encodeSimpleError('ERR invalid command format');
    }
    const commandElement =  request.value[0];
    if(commandElement.type !== 'bulkString' || commandElement.value === null) {
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
            return encodeSimpleError("ERR wrong number of arguments for 'ping' command");
        }
    
        return encodeSimpleString('PONG');
    }
    
    if (commandName === 'ECHO') {
        if (commandArguments.length !== 1) {
            return encodeSimpleError("ERR wrong number of arguments for 'echo' command");
        }
    
        return encodeBulkString(commandArguments[0]);
    }
    if (commandName === 'SET') {
        if (commandArguments.length !== 2) {
            return encodeSimpleError("ERR wrong number of arguments for 'SET' command");
        }
        const key = commandArguments[0].toString('utf8');
        const value = commandArguments[1];
        store.set(key, value);
            
        return encodeSimpleString('OK');
    }
    if (commandName === 'GET') {
        if (commandArguments.length !== 1) {
            return encodeSimpleError("ERR wrong number of arguments for 'GET' command");
        }
        const key = commandArguments[0].toString('utf8');
        const value = store.get(key);
            
        return encodeBulkString(value ?? null);
    }
    return encodeSimpleError(`ERR unknown command '${commandName.toLowerCase()}'`);

}