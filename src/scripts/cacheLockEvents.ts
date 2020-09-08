import fs from 'fs';
import EthLockdrop from '../helper';
import { LockEvent } from '../models/LockEvent';
import { firstLockContract, secondLockContract } from '../data/lockdropContracts';

export const loadCache = (jsonDir: string) => {
    try {
        const _cache = fs.readFileSync(jsonDir, { encoding: 'utf8' });
        const cache = JSON.parse(_cache);

        const _prevLocks: LockEvent[] = cache;
        return _prevLocks;
    } catch (e) {
        return [] as LockEvent[];
    }
};

async function updateLockdropCache(contractAddress: string) {
    const cacheFileDir = `cache/cache-${contractAddress.slice(0, 6)}.json`;

    const _prevLocks = loadCache(cacheFileDir);

    console.log('Starting fetch');
    const newEv = await EthLockdrop.getAllLockEvents(contractAddress, _prevLocks);

    const jsonBlob = JSON.stringify(newEv);

    fs.writeFile(cacheFileDir, jsonBlob, function (err) {
        if (err) return console.error(err);
        const _evDiff = newEv.length - _prevLocks.length;
        if (_evDiff > 0) console.info(`Fetched ${_evDiff} new events from etherscan`);
    });
}

async function updateAllContracts() {
    const allMainContracts = [...firstLockContract, ...secondLockContract].map((i) => {
        return i.address;
    });

    for (let i = 0; i < allMainContracts.length; i++) {
        try {
            await updateLockdropCache(allMainContracts[i]);
        } catch (e) {
            console.error(e.message);
            console.log('Encountered error, skipping ' + allMainContracts[i]);
            continue;
        }
    }
}

// script entry point
(async () => {
    //todo: change function depending on the script parameter
    await updateAllContracts();
})().catch((err) => {
    console.log(err);
});
