import fetch from 'node-fetch';
import neatCsv from 'neat-csv';
import fs from 'fs';
import stringify from 'csv-stringify/lib/sync';
import path from 'path';
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

export function writeCache<T>(data: T, name?: string, saveFolder?: string) {
    const dirName = path.join(saveFolder || process.cwd(), `${name || 'data'}.json`);
    fs.writeFileSync(dirName, JSON.stringify(data));
}

/**
 * Reads a local CSV file and returns a list of key-value pairs
 * @param csvDir location of the csv file to parse
 */
export async function loadCsv(csvDir: string) {
    const data = fs.readFileSync(csvDir);

    const content: { [key: string]: string }[] = await neatCsv(data);

    return content;
}

export function writeCsv<T>(data: T[], name?: string, saveFolder?: string) {
    const dirName = path.join(saveFolder || process.cwd(), `${name || 'data'}.csv`);

    const csvOutput = stringify(data, {
        header: true,
    });

    fs.writeFileSync(dirName, csvOutput);
}
