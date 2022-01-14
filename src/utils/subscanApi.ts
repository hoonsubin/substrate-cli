import axios, {AxiosInstance} from 'axios';

export class SubscanApi {
    private _endpoint: string;
    private _apiInst: AxiosInstance;

    constructor(endpoint: string, apiKey: string) {
        this._endpoint = endpoint;
        this._apiInst = axios.create({
            baseURL: endpoint,
            timeout: 1000,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            }
        })
    }

    public contribute() {

    }
}