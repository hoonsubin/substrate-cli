import _ from 'lodash';
import { SubscanApi } from '../models/SubscanTypes';
import PlasmConnect from './plasmApi';
import { postJsonRequest, wait } from './utils';
import * as polkadotUtils from '@polkadot/util';
import { Claim } from '../models/EventTypes';
import { Vec } from '@polkadot/types';
import { ClaimId } from '@plasm/types/interfaces';

const SUBSCAN_ENDPOINT = 'https://plasm.subscan.io/api/scan/events';

type ListUpdateState = 'up-to-date' | 'within-page' | 'behind-page';

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

export async function fetchClaimRequestCall(plasmApi: PlasmConnect) {
    const api = await plasmApi.api;

    const lockdropStart = (await plasmApi.getLockdropDuration())[0].toNumber();
    const lastHdr = (await api.rpc.chain.getHeader()).number.unwrap();

    // expected block time in seconds
    const blockTime = api.consts.babe.expectedBlockTime.toNumber() / 1000;

    // should check claims that are more than 30 minutes old
    const claimMinAge = 30 * 60;

    const blockHdrOffset = Math.trunc(claimMinAge / blockTime);

    const lockdropBlockRange = lastHdr.subn(lockdropStart).toNumber();

    // maximum number of block range the API can cover
    const maxRequests = 2500;

    // number of calls needed to cover all the blocks
    const pages = Math.trunc(lockdropBlockRange / maxRequests);

    //todo: add recursive fetch for each pages

    const startHdr = await api.rpc.chain.getBlockHash(lastHdr.subn(blockHdrOffset).subn(maxRequests));
    const endHdr = await api.rpc.chain.getBlockHash(lastHdr.subn(blockHdrOffset));

    const lockdropEvents = await api.query.plasmLockdrop.requests.range([startHdr, endHdr]);

    console.log('found ' + lockdropEvents.length + ' requests');
    lockdropEvents.forEach(([hash, request]) => {
        if (!request.isEmpty) {
            const claimIds = request as Vec<ClaimId>;

            console.log(`block hash: ${hash.toHuman()}\ndata: ${claimIds}\n`);
        }
    });
}

export async function fetchClaimEventsFromApi(plasmApi: PlasmConnect, prevEvents?: Claim[]) {
    // the fetch function
    const fetchAllClaimRequests = async (plasmApi: PlasmConnect) => {
        const lockdropStart = 1032630;
        const api = await plasmApi.api;
        //const lockdropBonds = await plasmApi.getLockdropDuration();

        //const latestBlockHash = await api.rpc.chain.getHeader();
        const lockdropStartHash = await plasmApi.blockNoToHash(lockdropStart);

        // returns [Hash, Vec<ClaimId>]
        const claimRequests = await api.query.plasmLockdrop.requests.range([lockdropStartHash]);

        const claimReqList = claimRequests.map(([hash, idList]) => {
            const claims = idList as Vec<ClaimId>;

            const claimIds = claims.map((i) => {
                return i.toHex();
            });

            return claimIds;
        });
    };
}

export async function filterClaimed(plasmApi: PlasmConnect, eventData: SubscanApi.ClaimReqEvent[]) {
    // add claimed state by looking into the chain data
    const claimEvents = await Promise.all(
        eventData.map(async (i) => {
            const claimData = await plasmApi.getClaimData(polkadotUtils.hexToU8a(i.claimId));

            return {
                ...i,
                claimed: claimData.complete,
            };
        }),
    );

    const unclaimed = claimEvents.filter((i) => {
        return i.claimed === false;
    });

    // we remove the claim status
    return unclaimed.map((i) => {
        return {
            blockNumber: i.blockNumber,
            timestamp: i.timestamp,
            claimId: i.claimId,
            eventIndex: i.eventIndex,
        } as SubscanApi.ClaimReqEvent;
    });
}
