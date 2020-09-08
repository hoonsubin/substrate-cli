import fs from 'fs';
import EthLockdrop from '../helper';
import { LockEvent } from '../models/LockEvent';
import { secondLockContract } from '../data/lockdropContracts';

const loadCache = (jsonDir: string) => {
    try {
        const _cache = fs.readFileSync(jsonDir, { encoding: 'utf8' });
        const cache = JSON.parse(_cache);

        const _prevLocks: LockEvent[] = cache;
        return _prevLocks;
    } catch (e) {
        return [] as LockEvent[];
    }
};

async function cacheEthLockEvents() {
    const contractAddress = secondLockContract.find((i) => i.type === 'main').address;
    const cacheFileDir = `src/cache/cache-${contractAddress.slice(0, 6)}.json`;

    const _prevLocks = loadCache(cacheFileDir);

    console.log('Starting fetch');
    const newEv = await EthLockdrop.getAllLockEvents(contractAddress, _prevLocks);

    const jsonBlob = JSON.stringify(newEv);

    fs.writeFile(cacheFileDir, jsonBlob, function (err) {
        if (err) return console.error(err);
        const _evDiff = newEv.length - _prevLocks.length;
        console.info(`Fetched ${_evDiff} new events from etherscan`);
    });
}

(async () => {
    //todo: change function depending on the script parameter
    await cacheEthLockEvents();
})().catch((err) => {
    console.log(err);
});
