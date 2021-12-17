import { ContributePayload, DotContribution } from './types';
import { setTimeout as sleep } from 'timers/promises';
import { getContributesFromSubscan } from './middleware';
import {
    getBonusStatus,
    DOT_CROWDLOAN_DB,
    KSM_CROWDLOAN_DB,
    saveAsCsv,
    saveAsJson,
    getLockdropParticipants,
    getKsmParticipants,
    PLM_LOCKDROP_DB,
    SDN_KSM_REWARD_DB
} from './utils';
import _ from 'lodash';
import BN from 'bn.js';

export default async function app() {

    const sdnDenomination = new BN(10).pow(new BN(18));
    // convert SDN string to femto string
    const res = _.map(SDN_KSM_REWARD_DB, (i) => {
        return {
            account_id: i.account_id,
            amount: new BN(i.amount).mul(sdnDenomination).toString(),
        }
    });

    console.log(res);
    //const res = getBonusStatus(DOT_CROWDLOAN_DB);

    //await saveAsCsv(res);
}

const saveLockdropAddrList = async () => {
    const participants = getLockdropParticipants(PLM_LOCKDROP_DB);
    await saveAsJson(
        participants.map((i) => {
            return { address: i };
        }),
        './src/data/lockdrop-participants.json',
    );
};

const saveKsmCrowdloanAddrList = async () => {
    const participants = getKsmParticipants(KSM_CROWDLOAN_DB);
    await saveAsJson(
        participants.map((i) => {
            return { address: i };
        }),
        './src/data/ksm-crowdloan-participants.json',
    );
};

const getContributionSubscan = async () => {
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

    const contributionList: DotContribution[] = [];
    let pageIndex = 0;

    while (true) {
        await sleep(3000); // 3s sleep
        const param: ContributePayload = {
            fund_id: ASTAR_FUND_ID,
            page: pageIndex,
            row: 100,
            order: 'block_num asc',
            from_history: true,
        };

        try {
            const resList = await getContributesFromSubscan(
                'https://polkadot.api.subscan.io/api/scan/parachain/contributes',
                param,
                process.env.SUBSCAN_API_KEY,
            );

            if (!resList) {
                break;
            } else {
                contributionList.push(...resList);
            }
            pageIndex += 1;
        } catch (e) {
            console.error(e);
            break;
        }
    }
    console.log(contributionList);
};
