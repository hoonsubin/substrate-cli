import { LockdropContract } from '../model/EventTypes';

export const firstLockContract: LockdropContract[] = [
    {
        type: 'main',
        address: '0x458DaBf1Eff8fCdfbF0896A6Bd1F457c01E2FfD6',
        blockHeight: 9662816,
    },
    { type: 'ropsten', address: '0xEEd84A89675342fB04faFE06F7BB176fE35Cb168', blockHeight: 7941301 },
];

export const secondLockContract: LockdropContract[] = [
    {
        type: 'main',
        address: '0xa4803f17607B7cDC3dC579083d9a14089E87502b',
        blockHeight: 10714638,
    },
    {
        type: 'ropsten',
        address: '0x69e7eb3ab94a10e4f408d842b287c70aa0d11649',
        blockHeight: 8257718,
    },
    {
        type: 'ropsten',
        address: '0xa91E04a6ECF202A7628e0c9191676407015F5AF9',
        blockHeight: 8474518,
    },
];
