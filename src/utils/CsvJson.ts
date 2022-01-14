import ObjectsToCsv from 'objects-to-csv';
import fsPromise from 'fs/promises';
import * as fs from 'fs';
import csv from 'csv-parser';

export const saveAsCsv = async (list: Array<object>, path: string = './list.csv') => {
    const csv = new ObjectsToCsv(list);

    await csv.toDisk(path);
};

export const saveAsJson = async (list: Array<object>, path: string = './list.json') => {
    const data = JSON.stringify(list);
    await fsPromise.writeFile(path, data);
};

export const readCsv = async <T>(filePath: string): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        const results: T[] = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('error', (err) => reject(err))
            .on('end', () => {
                resolve(results);
            });
    });
};
