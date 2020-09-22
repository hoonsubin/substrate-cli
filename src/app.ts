import express from 'express';
import { firstLockContract, secondLockContract } from './data/lockdropContracts';
import { Utils } from './helper';

(function main() {
    const app = express();
    const port = process.env.PORT;

    app.get('/', (_req, res) => {
        res.send('<h1>Lockdrop Event Cache</h1>');
    });

    [...firstLockContract, ...secondLockContract].map((contract) => {
        app.get('/v1/lockdrop/eth/' + contract.address, (_req, res) => {
            const cacheFileDir = `cache/cache-${contract.address.slice(0, 6)}.json`;
            res.send(JSON.stringify(Utils.loadCache(cacheFileDir)));
        });
    });

    app.get('/v1/lockdrop/claim-requests', (_req, res) => {});

    app.listen(port, () => {
        return console.log(`server is listening on http://localhost:${port}`);
    }).on('error', (e) => {
        return console.error(e);
    });
})();
