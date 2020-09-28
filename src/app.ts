import express from 'express';
import { firstLockContract, secondLockContract } from './data/lockdropContracts';
import { Utils } from './helper';

const API_ROOT_DIR = '/v1/lockdrop/';

(function main() {
    const app = express();
    const port = process.env.PORT;

    app.use(express.static(__dirname + 'public'));

    // serve a static page
    app.get('/', (_req, res) => {
        res.sendFile('./public/index.html', { root: __dirname });
    });

    [...firstLockContract, ...secondLockContract].map((contract) => {
        app.get(API_ROOT_DIR + 'eth/' + contract.address, (_req, res) => {
            const cacheFileDir = `cache/cache-${contract.address.slice(0, 6)}.json`;
            res.send(JSON.stringify(Utils.loadCache(cacheFileDir)));
        });
    });

    app.get(API_ROOT_DIR + 'claim-requests', (_req, res) => {
        res.send(JSON.stringify(Utils.loadCache('cache/claim-request-event.json')));
    });

    app.listen(port, () => {
        return console.log(`server is listening on http://localhost:${port}`);
    }).on('error', (e) => {
        return console.error(e);
    });
})();
