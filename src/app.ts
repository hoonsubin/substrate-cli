import express from 'express';
import { loadCache } from './scripts/cacheLockEvents';
import { firstLockContract, secondLockContract } from './data/lockdropContracts';

(function main() {
    const app = express();
    const port = process.env.PORT;

    app.get('/', (_req, res) => {
        res.send('<h1>Lockdrop Event Cache</h1>');
    });

    [...firstLockContract, ...secondLockContract].map((contract) => {
        app.get('/lockdrop/eth/' + contract.address, (_req, res) => {
            const cacheFileDir = `cache/cache-${contract.address.slice(0, 6)}.json`;
            res.send(JSON.stringify(loadCache(cacheFileDir)));
        });
    });

    app.listen(port, () => {
        return console.log(`server is listening on ${port}`);
    }).on('error', (e) => {
        return console.error(e);
    });
})();
