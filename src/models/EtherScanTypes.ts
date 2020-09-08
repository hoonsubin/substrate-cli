// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace EtherScanApi {
    export interface Log {
        address: string;
        topics: string[];
        data: string;
        blockNumber: string;
        timeStamp: string;
        gasPrice: string;
        gasUsed: string;
        logIndex: string;
        transactionHash: string;
        transactionIndex: string;
    }

    export interface Transaction {
        blockNumber: string;
        timeStamp: string;
        from: string;
        to: string;
        value: string;
        contractAddress: string;
        input: string;
        type: string;
        gas: string;
        gasUsed: string;
        isError: string;
        errCode: string;
    }

    export interface LogResponse {
        status: string;
        message: string;
        result: Log[];
    }

    export interface TransactionResponse {
        status: string;
        message: string;
        result: Transaction[];
    }
}
