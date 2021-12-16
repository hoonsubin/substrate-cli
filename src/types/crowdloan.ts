export interface KsmCrowdloan {
    account_id: string;
    amount: string;
    timestamp: string;
    blocknumber: number;
    how: string;
}

export interface DotContribution {
    who: string;
    amount: string;
    extrinsic_index: string;
    block_num: number;
    memo: string;
}
