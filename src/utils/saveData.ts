import ObjectsToCsv from 'objects-to-csv';

export const saveAsCsv = async (list: Array<object>) => {
    const csv = new ObjectsToCsv(list);

    await csv.toDisk('./list.csv');
};
