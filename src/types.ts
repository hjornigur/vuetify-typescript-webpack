import { DBSchema, IDBPDatabase } from 'idb';
import { ESI } from './lib/esi';

export interface ApiCallError {
    message: string;
    status: number;
}

export interface InstanceData {
    // SwaggerClient: ESI<unknown>;
    db?: IDBPDatabase<MyDB>;
    auth: {
        access_token: string;
        refresh_token: string;
        character_id: string;
    };
    redirectUrl: string;

    loading: boolean;
    loadingProgress: any;
    loadingColor: string;
    indeterminate: boolean;

    error: boolean;
    errorMessage: unknown;
    info: boolean;
    infoMessage: string;

    dialog: boolean;

    sessionCache: {
        itemsInfo: any;
    };
}

export interface MyDB extends DBSchema {
    APIcache: {
        key: string;
        value: {
            expires: number;
            data: {
                body?: any;
            };
        };
    };
    // 'products': {
    //     value: {
    //         name: string;
    //         price: number;
    //         productCode: string;
    //     };
    //     key: string;
    //     indexes: { 'by-price': number };
    // };
}
