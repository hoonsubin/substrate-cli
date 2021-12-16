import { ApiPromise } from '@polkadot/api';
import * as polkadotUtils from '@polkadot/util-crypto';
import _ from 'lodash';
import BN from 'bn.js';
import { Vec } from '@polkadot/types';
import { FrameSystemEventRecord } from '@polkadot/types/lookup';

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
