import _ from 'lodash';
import { SubscanApi } from '../models/SubscanTypes';
import PlasmConnect from './plasmApi';
import { postJsonRequest, wait } from './utils';
import * as polkadotUtils from '@polkadot/util';
import { Claim } from '../models/EventTypes';
import { Vec } from '@polkadot/types';
import { Hash, Moment } from '@polkadot/types/interfaces';
import { ClaimId } from '@plasm/types/interfaces';
import * as cliProgress from 'cli-progress';
import { ApiPromise } from '@polkadot/api';

const SUBSCAN_ENDPOINT = 'https://plasm.subscan.io/api/scan/events';

type ListUpdateState = 'up-to-date' | 'within-page' | 'behind-page';

interface ClaimReq {
    claimId: string;
    blockNumber: number;
}

function checkListUpdateState(
    newEvents: SubscanApi.Event[],
    cachedEvents: SubscanApi.ClaimReqEvent[],
): ListUpdateState {
    if (cachedEvents.length === 0) return 'behind-page';
    // checks the block number of the first (latest) item
    const hasNewEvents = newEvents[0].block_num > cachedEvents[0].blockNumber;

    if (!hasNewEvents) return 'up-to-date';

    // checks if the list head is not in the fetched items (i.e. the cache is behind more than a page)
    const outOfRange = newEvents[newEvents.length - 1].block_num > cachedEvents[0].blockNumber;

    if (!outOfRange) return 'within-page';
    else return 'behind-page';
}

export async function fetchPlasmEvents(
    module: string,
    call: string,
    displayRow: number,
    prevEvents?: SubscanApi.ClaimReqEvent[],
) {
    // the fetch function
    const fetchEventPage = async (module: string, call: string, displayRow: number, pageNo: number = 0) => {
        const apiParam = {
            row: displayRow,
            page: pageNo,
            module,
            call,
        };

        const res = await postJsonRequest(SUBSCAN_ENDPOINT, apiParam);
        const logs: SubscanApi.Response = JSON.parse(res);

        if (logs.code !== 0) {
            throw new Error(logs.message);
        }
        return logs.data;
    };

    // we have to fetch the page at least once
    const eventResponse = await fetchEventPage(module, call, displayRow);

    let events = eventResponse.events;

    // we can simply truncate the value because the page number is zero-indexed
    const totalPageCount = Math.trunc(eventResponse.count / displayRow);

    const cachedEventState = checkListUpdateState(events, prevEvents || []);

    if (cachedEventState === 'behind-page') {
        if (prevEvents.length === 0) {
            console.log('No existing data given, fetching from scratch');
        }
        console.log('Fetching new data (this may take a while)...');
        // we start from 1 because we already fetched once
        for (let i = 1; i <= totalPageCount; i++) {
            // delay for 2 seconds to prevent IP ban
            await wait(3000);
            const _eventData = await fetchEventPage(module, call, displayRow, i);

            const _currentPageState = checkListUpdateState(_eventData.events, prevEvents);
            events = events.concat(_eventData.events);
            if (_currentPageState === 'within-page') {
                break;
            }
        }
    } else if (cachedEventState === 'up-to-date') {
        console.log('No new events found');
        // return the existing list if it's update to date
        return prevEvents;
    }

    // format the fetched data into a different type
    let formattedList = events.map((i) => {
        const _params: SubscanApi.EventParam[] = JSON.parse(i.params);
        const claimId = _params[0].value;
        return {
            blockNumber: i.block_num,
            timestamp: i.block_timestamp,
            claimId,
            eventIndex: i.event_index,
        } as SubscanApi.ClaimReqEvent;
    });

    // concat the cache and the new events
    formattedList = formattedList.concat(prevEvents);

    console.log('Filtering out duplicate events...');

    // filter objects so that the list only contains unique events
    // this method will keep the first entry and discard any other upcoming ones
    const uniqueEvents = _.uniqBy(formattedList, (i) => {
        return i.claimId;
    });

    console.log(`Fetched ${uniqueEvents.length - prevEvents.length} new events`);

    return uniqueEvents;
}

export async function fetchClaimRequestCall(api: ApiPromise, startFrom?: number) {
    // maximum number of block range the API can cover
    const maxRequests = 2500;

    // start from the given block number, or at the beginning of the lockdrop
    const startBlock = startFrom || (await api.query.plasmLockdrop.lockdropBounds())[0].toNumber();

    console.log('Querying the blockchain from block ' + startBlock);

    const lastHdr = (await api.rpc.chain.getHeader()).number.unwrap();

    // expected block time in seconds
    const blockTime = api.consts.babe.expectedBlockTime.toNumber() / 1000;
    // should check claims that are more than 30 minutes old
    const claimMinAge = 30 * 60;

    const _queryRange = lastHdr.subn(startBlock).toNumber();

    // ensure no negative value is passed
    const lockdropBlockRange = _queryRange > 0 ? _queryRange : maxRequests;

    // number of calls needed to cover all the blocks
    const pages = Math.trunc(lockdropBlockRange / maxRequests);

    let blockEventList: {
        blockHash: Hash;
        claimIds: Vec<ClaimId>;
    }[] = [];

    console.log('Fetching ' + pages + ' pages from plasm node...\n');

    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(pages, 0);
    const blockHdrOffset = Math.trunc(claimMinAge / blockTime);

    for (let i = 1; i <= pages; i++) {
        // start block number = latest block - offset - current page * blocks per request
        const startBlockNo = lastHdr.toNumber() - blockHdrOffset - i * maxRequests;
        // the block offset ensures that we don't go above the latest block
        const endBlockNo = startBlockNo + maxRequests;

        const startHdr = await api.rpc.chain.getBlockHash(startBlockNo);
        const endHdr = await api.rpc.chain.getBlockHash(endBlockNo);

        const lockdropEvents = await api.query.plasmLockdrop.requests.range([startHdr, endHdr]);

        const _events = lockdropEvents.filter(([_hash, request]) => {
            return !request.isEmpty;
        });

        const reqs = _events.map(([hash, extr]) => {
            const claimIds = extr as Vec<ClaimId>;
            return {
                blockHash: hash,
                claimIds,
            };
        });

        blockEventList = blockEventList.concat(reqs);
        progressBar.update(i);
    }
    progressBar.stop();

    console.log('Fetching claim information...');
    const claimList = blockEventList.map(async ({ blockHash, claimIds }) => {
        const blockData = (await api.rpc.chain.getBlock(blockHash)).block;
        const blockNumber = blockData.header.number.unwrap().toNumber();
        const timestamp = blockData.extrinsics.find((i) => {
            return i.method.section === 'timestamp';
        }).method.args[0] as Moment;

        const ids = claimIds.map((i) => {
            return {
                claimId: i.toHex(),
                blockNumber,
                timestamp: timestamp.toNumber() / 1000,
            };
        });

        return ids;
    });

    const _claims = await Promise.all(claimList);

    const claimEvents = _claims.reduce((accumulator, currentValue) => {
        return accumulator.concat(currentValue);
    });
    const sortedByBNumber = claimEvents.sort((a, b) => {
        return b.blockNumber - a.blockNumber;
    });
    const uniqueList = _.uniqBy(sortedByBNumber, (i) => {
        return i.claimId;
    });

    console.log(`Fetched ${uniqueList.length} new items`);
    return uniqueList;
}

export async function fetchAllClaimData(plasmApi: PlasmConnect, prevEvents: Claim[] = []) {
    if (prevEvents.length === 0) {
        console.log('No cache found, starting from scratch...');
    }
    // fetch from the highest blocknumber in cache
    let reqEvents = await plasmApi.fetchClaimRequestCall(prevEvents.length > 0 && prevEvents[0].blockNumber);

    reqEvents = reqEvents.concat(prevEvents);

    // ensure no duplicates are there
    const cleanList = _.uniqBy(reqEvents, (i) => {
        return i.claimId;
    });
    return cleanList;
}

export async function findHangingClaims(
    plasmApi: PlasmConnect,
    claimData: Claim[],
    validatorWaitTime: number = 30 * 60,
) {
    const { voteThreshold, positiveVotes } = await plasmApi.getLockdropVoteRequirements();

    return claimData.filter((i) => {
        const isClaimHanging = i.approve.size - i.decline.size < voteThreshold || i.approve.size < positiveVotes;
        const isValidClaim = i.approve.size > 0 && i.decline.size === 0;
        const isVoteLate = i.timestamp + validatorWaitTime < Date.now().valueOf() / 1000;

        return isClaimHanging && isVoteLate && isValidClaim;
    });
}
