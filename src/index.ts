#!/usr/bin/env ts-node

import * as scripts from './cli';

(async () => {
    await scripts.SendBatchTx();

    process.exit(0);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
