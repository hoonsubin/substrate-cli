export interface Judgement {
    index: number;
    judgement: string;
}

export interface WhoDisplay {
    address: string;
    display: string;
    judgements: Judgement[];
    account_index: string;
    identity: boolean;
    parent?: any;
}

export interface Contribute {
    fund_id: string;
    para_id: number;
    who: string;
    contributed: string;
    contributing: string;
    block_num: number;
    block_timestamp: number;
    extrinsic_index: string;
    event_index: string;
    status: number;
    memo: string;
    who_display: WhoDisplay;
}

export interface ContributeData {
    contributes: Contribute[];
    count: number;
}

export interface Response {
    code: number;
    message: string;
    generated_at: number;
    data: ContributeData;
}

export interface ContributePayload {
    fund_id?: string;
    row: number;
    page: number;
    order: 'block_num desc' | 'block_num asc';
    who?: string;
    from_history: boolean;
}