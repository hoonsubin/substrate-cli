import * as polkadotUtils from '@polkadot/util-crypto';
import axios from 'axios';
import { Response, ContributePayload } from './types';
import _ from 'lodash';

const endpoints = {
    polkadot: 'wss://rpc.polkadot.io',
    shiden: 'wss://rpc.shiden.astar.network',
    local: 'ws://localhost:9944',
};

export default async function app() {
    /*
    const provider = new WsProvider(endpoints.polkadot);
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
    */

    const ASTAR_FUND_ID = '2006-3';

    const param: ContributePayload = {
        fund_id: ASTAR_FUND_ID,
        page: 0,
        row: 100,
        order: 'block_num asc',
        from_history: true,
    };

    const resList = await subscanFetchContributes(
        'https://polkadot.api.subscan.io/api/scan/parachain/contributes',
        param,
        process.env.SUBSCAN_API_KEY,
    );

    console.log(resList);
}

interface Contribution {
    who: string;
    amount: string;
    eventId: string;
    blockNumber: number;
    memo: string;
}

const subscanFetchContributes = async (endpoint: string, param: ContributePayload, apiKey?: string) => {
    if (!apiKey) {
        throw new Error('No Subscan API key was found');
    }

    const res = await axios({
        method: 'POST',
        url: endpoint,
        data: param,
        timeout: 1000,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
        },
    });

    const responseData = (res.data as Response).data;

    const contributionList = _.map(responseData.contributes, (i) => {
        const referral = i.memo !== '' ? convertToPolkadotAddress('0x' + i.memo) : i.memo;
        const contribution: Contribution = {
            who: i.who,
            amount: i.contributing,
            eventId: i.event_index,
            blockNumber: i.block_num,
            memo: referral,
        };
        return contribution;
    });

    return contributionList;
};

const convertToPolkadotAddress = (publicKeyHex: string) => {
    const POLKADOT_PREFIX = 0;
    return polkadotUtils.encodeAddress(publicKeyHex, POLKADOT_PREFIX);
}
