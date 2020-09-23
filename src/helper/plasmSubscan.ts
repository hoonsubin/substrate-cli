import _ from 'lodash';
import { SubscanApi } from '../models/SubscanTypes';
import { postJsonRequest, wait } from './utils';

const SUBSCAN_ENDPOINT = 'https://plasm.subscan.io/api/scan/events';

export async function fetchPlasmEvents(
    module: string,
    call: string,
    displayRow: number,
    fetchType: 'all' | 'single-page',
) {
    async function fetchEventPage(module: string, call: string, displayRow: number, pageNo: number = 0) {
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
    }

    const eventResponse = await fetchEventPage(module, call, displayRow);

    let events = eventResponse.events;

    if (fetchType === 'all') {
        // we can simply truncate the value because the page number is zero-indexed
        const _totalPageCount = Math.trunc(eventResponse.count / displayRow);
        console.log(`Found ${eventResponse.count} events`);

        // we start from 1 because we already fetched once
        for (let i = 1; i <= _totalPageCount; i++) {
            // delay for 1 second to prevent IP ban
            await wait(1000);
            const _eventData = await fetchEventPage(module, call, displayRow, i);
            events = events.concat(_eventData.events);
        }
    }

    console.log('Filtering out duplicate events...');

    // filter objects so that the list only contains unique events
    // this method will keep the first entry and discard any other upcoming ones
    const uniqueEvents = _.uniqBy(events, (i) => {
        const _params: SubscanApi.EventParam[] = JSON.parse(i.params);
        console.log(_params);
        return _params[0].value;
    });

    return uniqueEvents;
}
