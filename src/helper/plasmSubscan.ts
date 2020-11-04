import { SubscanApi } from '../models/SubscanTypes';
import { postJsonRequest } from './utils';

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

        // we start from 1 because we already fetched once
        for (let i = 1; i <= _totalPageCount; i++) {
            const _eventData = await fetchEventPage(module, call, displayRow, i);
            //console.log(i);
            events = events.concat(_eventData.events);
        }
    }

    const allEvents = events.map((ev: any) => {
        // params is returned as a json string, so we explicitly convert that to an object
        const params = JSON.parse(ev.params) as SubscanApi.EventParam[];
        return {
            ...ev,
            params,
        } as SubscanApi.Event;
    });

    return allEvents;
}
