import fetch from 'node-fetch';
import { LockEvent } from '../models/EventTypes';
import fs from 'fs';

/**
 * a wrapper for node-fetch. Returns the JSON body of the response as string.
 * The body must be a JSON in order for this to work
 * @param url url of the request in string
 */
export async function getJsonRequest(url: string) {
    const response = await fetch(url);
    const json = await response.json();
    return JSON.stringify(json);
}

export async function postJsonRequest(url: string, body: object) {
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
    const json = await response.json();
    return JSON.stringify(json);
}

/**
 * wait for the given time. A utility tool used to prevent API spamming
 * @param ms
 */
export function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function loadCache<T>(jsonDir: string) {
    try {
        const _cache = fs.readFileSync(jsonDir, { encoding: 'utf8' });
        const cache = JSON.parse(_cache);

        const _prevLocks: Array<T> = cache;
        return _prevLocks;
    } catch (e) {
        return new Array<T>();
    }
}
