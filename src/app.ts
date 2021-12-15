import { ApiPromise, WsProvider } from '@polkadot/api';
import * as polkadotUtils from '@polkadot/util-crypto';
import { saveAsCsv } from './utils';
import claimData from './data/claim-complete.json';
import _ from 'lodash';
import BN from 'bn.js';
import { Vec } from '@polkadot/types';
import { FrameSystemEventRecord } from '@polkadot/types/lookup';

const endpoints = {
    polkadot: 'wss://rpc.polkadot.io',
    shiden: 'wss://rpc.shiden.astar.network',
    local: 'ws://localhost:9944',
};

export default async function app() {
    const provider = new WsProvider(endpoints.polkadot);
    // Create our API with a default connection to the local node
    const api = await (
        await ApiPromise.create({
            provider,
        })
    ).isReady;

    await getCrowdloanContribution(api);
}

interface ClaimEvent {
    event_index: string;
    block_num: number;
    extrinsic_idx: number;
    module_id: string;
    event_id: string;
    params: EventParam[];
    event_idx: number;
    extrinsic_hash: string;
    block_timestamp: number;
}

interface EventParam {
    type: string;
    value: string;
    value_raw: string;
}

const getLockdropParticipantBalance = async (api: ApiPromise) => {
    const claimList = claimData as ClaimEvent[];

    // get all lockdrop participants
    const participantAddrList = _.map(claimList, (claimEv) => {
        const pubkey = claimEv.params[1].value;
        // encode public key to ss58 address
        return polkadotUtils.encodeAddress('0x' + pubkey, 5);
    });

    // obtain all account balances in header
    const currentAccountList = await api.query.system.account.multi(participantAddrList);

    const currentBalances = _.map(currentAccountList, (value, index) => {
        const { data } = value;

        const address = participantAddrList[index];
        return { address, freeBalance: data.free.toHuman(), reservedBalance: data.reserved.toHuman() };
    });

    // obtain all account balances in genesis
    const genesisHash = await api.rpc.chain.getBlockHash(1);
    console.log(`Genesis hash: ${genesisHash}`);

    const genesisApi = await api.at(genesisHash);

    const genesisQueryList = _.map(participantAddrList, (addr) => {
        return [genesisApi.query.system.account, addr];
    });

    // we can only use this method due to storage metadata changes in old blocks
    const genesisAccountList = await genesisApi.queryMulti(genesisQueryList as any);

    const genesisBalances = _.map(genesisAccountList, (value, index) => {
        const { data } = value as any;

        const address = participantAddrList[index];
        return {
            address,
            freeBalance: data.free.toHuman() as string,
            reservedBalance: data.reserved.toHuman() as string,
        };
    });

    // combine the genesis list and the header list
    const combinedList = _.map(participantAddrList, (value, index) => {
        const genesisBalance = genesisBalances[index];
        const currentBalance = currentBalances[index];

        return {
            address: value,
            genesisFree: genesisBalance.freeBalance,
            genesisReserved: genesisBalance.reservedBalance,
            currentFree: currentBalance.freeBalance,
            currentReserved: currentBalance.reservedBalance,
        };
    });

    await saveAsCsv(combinedList);

    //console.log(genesisAccountList[0].toHuman());

    console.log('Finished saving');
};

interface Contribution {
    block: number;
    account: string; // ss58 address
    paraId: number;
    amount: BN;
}

interface ContributeMemo {
    block: number;
    account: string;
    paraId: number;
    referral: string;
}

const ASTAR_PARA_ID = 2006;
const POLKADOT_PREFIX = 0;

const getCrowdloanContribution = async (api: ApiPromise) => {
    // crowdloan start and finish block number source: https://polkadot.subscan.io/crowdloan/2006-3
    const CAMPAIGN_START_BLOCK = 7572600; // 2021-11-05 15:55
    //const CAMPAIGN_END_BLOCK = 8179200; // 2021-12-17 22:17

    const AUCTION_END_BLOCK = 7959430; // 2021-12-02 15:36

    const contributionList: Contribution[] = [];
    const referralList: ContributeMemo[] = [];

    for (let i = CAMPAIGN_START_BLOCK; i++; i <= AUCTION_END_BLOCK) {
        const blockHash = await api.rpc.chain.getBlockHash(i);
        const currentApi = await api.at(blockHash);
        const events = await currentApi.query.system.events();

        const contributors = await getCrowdloanContributionAt(i, events);
        const referrals = await getCrowdloanReferralAt(i, events);

        console.log(`Found ${contributors.length} contributions in block ${i}`);

        contributionList.push(...contributors);
        referralList.push(...referrals);
    }
    
    console.log(contributionList);
    console.log(referralList);
};

const getCrowdloanContributionAt = async (at: number, events: Vec<FrameSystemEventRecord>) => {
    let contributions: Contribution[] = [];

    events.forEach(async (record) => {
        const { event } = record;
        const { data } = event;

        if (event.method === 'Contributed') {
            const paraId = Number.parseInt(data[1].toString());
            if (paraId === ASTAR_PARA_ID) {
                // check for contribution event
                const contribution = {
                    block: at,
                    account: data[0].toString(),
                    paraId: Number.parseInt(data[1].toString()),
                    amount: new BN(data[2].toString()),
                };
                contributions.push(contribution);
            }
        }
    });

    return contributions;
};

const getCrowdloanReferralAt = async (at: number, events: Vec<FrameSystemEventRecord>) => {
    const referrals: ContributeMemo[] = [];

    events.forEach(async (record) => {
        const { event } = record;
        const { data } = event;

        if (event.method === 'MemoUpdated') {
            const paraId = Number.parseInt(data[1].toString());

            if (paraId === ASTAR_PARA_ID) {
                // note: we assume that the memo data is a hex public key and not something else
                const refAddress = polkadotUtils.encodeAddress(data[2].toString(), POLKADOT_PREFIX);
                const referral = {
                    block: at,
                    account: data[0].toString(),
                    paraId: Number.parseInt(data[1].toString()),
                    referral: refAddress,
                };

                referrals.push(referral);
            }
        }
    });

    return referrals;
};
