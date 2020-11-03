// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace SubscanApi {
    interface Event {
        event_index: string;
        block_num: number;
        extrinsic_idx: number;
        module_id: string;
        event_id: string;
        params: EventParam[]; // JSON string
        event_idx: number;
        extrinsic_hash: string;
        block_timestamp: number;
    }

    interface EventParam {
        type: string;
        value: string;
        value_raw: string;
    }

    export interface Data {
        count: number;
        events: Event[];
    }

    export interface Response {
        code: number;
        message: string;
        ttl: number;
        data: Data;
    }

    export interface ClaimReqEvent {
        blockNumber: number;
        timestamp: number;
        claimId: string;
        eventIndex: string;
    }

    export interface ClaimCompleteEvent {
        claimId: string;
        accountId: string;
        balance: string;
    }
}
