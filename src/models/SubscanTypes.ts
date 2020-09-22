// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace SubscanApi {
    export interface Event {
        event_index: string;
        block_num: number;
        extrinsic_idx: number;
        module_id: string;
        event_id: string;
        params: string; // JSON string
        event_idx: number;
        extrinsic_hash: string;
        block_timestamp: number;
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

    export interface EventParam {
        type: string;
        value: string;
        value_raw: string;
    }
}
