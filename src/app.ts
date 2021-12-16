import { ApiPromise, WsProvider } from '@polkadot/api';
import { getCrowdloanContributions } from './middleware';

const endpoints = {
    polkadot: 'wss://rpc.polkadot.io',
    shiden: 'wss://rpc.shiden.astar.network',
    local: 'ws://localhost:9944',
};

export default async function app() {
    const provider = new WsProvider(endpoints.local);
    // Create our API with a default connection to the local node
    const api = await (
        await ApiPromise.create({
            provider,
        })
    ).isReady;

    const ASTAR_PARA_ID = 2006;
    // crowdloan start and finish block number source: https://polkadot.subscan.io/crowdloan/2006-3
    const CAMPAIGN_START_BLOCK = 7572600; // 2021-11-05 15:55
    //const CAMPAIGN_END_BLOCK = 8179200; // 2021-12-17 22:17

    const AUCTION_END_BLOCK = 7959430; // 2021-12-02 15:36

    const res = await getCrowdloanContributions(api, ASTAR_PARA_ID, CAMPAIGN_START_BLOCK, AUCTION_END_BLOCK);

    // todo: save to csv
    console.log(res.contributionList);
    console.log(res.referralList);
}

