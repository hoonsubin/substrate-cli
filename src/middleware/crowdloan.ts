import { ApiPromise } from '@polkadot/api';
import * as polkadotUtils from '@polkadot/util-crypto';
import _ from 'lodash';
import BN from 'bn.js';
import { Vec } from '@polkadot/types';
import { FrameSystemEventRecord } from '@polkadot/types/lookup';
import axios from 'axios';
import { Response, ContributePayload } from '../types';

export interface Contribution {
    block: number;
    account: string; // ss58 address
    paraId: number;
    amount: BN;
}

export interface ContributeMemo {
    block: number;
    account: string; // ss58 address
    paraId: number;
    referral: string; // ss58 address
}

const POLKADOT_PREFIX = 0;

export const getCrowdloanContributions = async (api: ApiPromise, paraId: number, startBlock: number, endBlock: number) => {
    const contributionList: Contribution[] = [];
    const referralList: ContributeMemo[] = [];

    // loop through each blocks
    for (let i = startBlock; i++; i <= endBlock) {
        const blockHash = await api.rpc.chain.getBlockHash(i);
        const currentApi = await api.at(blockHash);
        const events = await currentApi.query.system.events();

        const contributors = await getCrowdloanContributionAt(i, events, paraId);
        const referrals = await getCrowdloanReferralAt(i, events, paraId);

        console.log(`Found ${contributors.length} contributions in block ${i}`);

        contributionList.push(...contributors);
        referralList.push(...referrals);
    }

    return {
        contributionList,
        referralList,
    };
};

const getCrowdloanContributionAt = async (at: number, events: Vec<FrameSystemEventRecord>, paraId: number) => {
    let contributions: Contribution[] = [];

    events.forEach(async (record) => {
        const { event } = record;
        const { data } = event;

        if (event.method === 'Contributed') {
            const _paraId = Number.parseInt(data[1].toString());
            if (_paraId === paraId) {
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

const getCrowdloanReferralAt = async (at: number, events: Vec<FrameSystemEventRecord>, paraId: number) => {
    const referrals: ContributeMemo[] = [];

    events.forEach(async (record) => {
        const { event } = record;
        const { data } = event;

        if (event.method === 'MemoUpdated') {
            const _paraId = Number.parseInt(data[1].toString());

            if (_paraId === paraId) {
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

export interface ContributionSubscan {
    who: string;
    amount: string;
    eventId: string;
    blockNumber: number;
    memo: string;
}

export const subscanFetchContributes = async (endpoint: string, param: ContributePayload, apiKey?: string) => {
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

    if (responseData === null) {
        return null;
    }

    const contributionList = _.map(responseData.contributes, (i) => {
        const referral = i.memo !== '' ? convertToPolkadotAddress('0x' + i.memo) : i.memo;
        const contribution: ContributionSubscan = {
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
};

