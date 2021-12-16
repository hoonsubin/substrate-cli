import ObjectsToCsv from 'objects-to-csv';
import fs from 'fs/promises';

export const saveAsCsv = async (list: Array<object>, path: string = './list.csv') => {
    const csv = new ObjectsToCsv(list);

    await csv.toDisk(path);
};

export const saveAsJson = async (list: Array<object>, path: string = './list.json') => {
    const data = JSON.stringify(list);
    await fs.writeFile(path, data);
}