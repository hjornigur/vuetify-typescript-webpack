<template>
<v-app>
<!-- <v-navigation-drawer app>
</v-navigation-drawer> -->
<v-app-bar app>
    <v-row>
        <!-- <v-spacer></v-spacer> -->
        <v-col v-if="redirectUrl">
            <a :href="redirectUrl">
                <img src="https://web.ccpgamescdn.com/eveonlineassets/developers/eve-sso-login-white-large.png" />
            </a>
        </v-col>
        <v-col v-if="auth.access_token">
            <v-btn @click="logout">Log out</v-btn>
        </v-col>
        <v-spacer></v-spacer>
    </v-row>
</v-app-bar>
<v-main>
    <v-container fluid>
        <!-- 🕹️ Фильтры -->
        <v-row>
            <v-col>
                <v-progress-circular
                    v-if="!this.SwaggerClient || loading"
                    color="orange"
                    indeterminate>
                </v-progress-circular>
            </v-col>
        </v-row>
        <!-- 📈 PROGRESS BAR -->
        <v-row v-if="loading">
            <v-progress-linear v-if="!indeterminate"
                v-model="loadingProgress"
                :color="loadingColor">
            </v-progress-linear>
            <v-progress-linear v-if="indeterminate"
                indeterminate
                :color="loadingColor">
            </v-progress-linear>
        </v-row>
        <!-- 🚧 NOTIFICATIONS -->
        <v-row>
            <v-spacer></v-spacer>
            <v-col>
                <v-alert v-if="error"
                    v-model="error"
                    close-text="Close Alert"
                    color="red"
                    dismissible>
                    {{ errorMessage }}
                </v-alert>
                <v-alert v-if="info"
                    v-model="info"
                    close-text="Close"
                    color="blue">
                    {{ infoMessage }}
                </v-alert>
            </v-col>
            <v-spacer></v-spacer>
        </v-row>
    </v-container>
</v-main>
<v-footer app>
    <!-- -->
</v-footer>
</v-app>
</template>

<script lang="ts">
import Vue from 'vue';
import { openDB } from 'idb';

const SwaggerClient = (window as any).SwaggerClient;
const axios = (window as any).axios;

import { wait } from './lib/index';
import { ApiCallError, InstanceData, MyDB } from './types';

const data: InstanceData = {
    // db: undefined,
    SwaggerClient: null,
    auth: {
        access_token: '',
        refresh_token: '',
        character_id: '',
    },
    redirectUrl: '',

    loading: false,
    loadingProgress: undefined,
    loadingColor: 'blue',
    indeterminate: false,

    error: false,
    errorMessage: '',
    info: false,
    infoMessage: '',

    dialog: false,

    sessionCache: {
        itemsInfo: {},
    },
};
export default Vue.extend({
    name: 'App',
    data() {
        return data;
    },

    methods: {
        getClient: function () {
            console.log(this.SwaggerClient);
        },
        apiCall: async function (
            endpointCategory: string,
            endpoint: string,
            kwargs: any,
            responseKey?: string,
        ) {
            let result;
            let timesFailed = 0;
            while (!result && timesFailed < 3) {
                // TODO: Check whether auth is needed
                if (kwargs) {
                    // TODO: add structure_id check
                    if (endpoint.includes('character_id')) kwargs.token = this.auth.access_token;
                }

                try {
                    const kwargsEncoded = kwargs
                        ? Object.entries(kwargs)
                              .map(entry => entry.map(String).join(''))
                              .join('')
                        : '';
                    const cacheKey = endpointCategory + endpoint + kwargsEncoded;
                    const cached = await this.dbGet('APIcache', cacheKey);

                    if (cached && cached.expires > new Date()) {
                        return cached.data[responseKey || 'body'];
                    }

                    const request = this.SwaggerClient.apis[endpointCategory][endpoint](kwargs);
                    const response = await request;

                    await this.dbSave(
                        'APIcache',
                        {
                            id: cacheKey,
                            expires: new Date(response.headers.expires),
                            data: response,
                        },
                        true,
                    );
                    result = response[responseKey || 'body'];
                } catch (e) {
                    const error: ApiCallError = e as unknown as ApiCallError;
                    this.error = true;
                    this.errorMessage = error;
                    if (error.status == 404) {
                        if (kwargs.type_id) {
                            this.errorMessage = `${endpoint} info for "${
                                (await this.dbGet('itemsInfo', kwargs.type_id)).name
                            }" not found`;
                        }
                        break;
                    }
                    if (error.status == 403) {
                        await this.refreshToken();
                    }
                    // 'TypeError: '
                    if (error.message === 'Failed to fetch') {
                        await wait(5000);
                    }
                    timesFailed++;
                }
            }
            return result;
        },
        dbSave: async function (store: any, record: any, update?: boolean) {
            //@ts-ignore
            let transaction = this.db.transaction(store, 'readwrite'); // (1)
            // get an object store to operate on it
            let objectStore = transaction.objectStore(store); // (2)
            // if (store == 'APIcache') {
            //     const indexNames = store.indexNames;
            //     debugger ;
            // }
            try {
                if (update) {
                    objectStore.put(record);
                } else {
                    objectStore.add(record);
                }
                // await objectStore[method](record); // (3)
                await transaction.done;
            } catch (e) {
                const error: Error = e as unknown as Error;
                // ConstraintError occurs when an object with the same id already exists
                if (error.name == 'ConstraintError') {
                    console.log('Record with such id already exists:', store, record.type_id); // handle the error
                    // error.preventDefault(); // don't abort the transaction
                    // use another key for the book?
                    // error.stopPropagation(); // don't bubble error up, "chew" it
                } else {
                    console.warn('Error', error);
                    // unexpected error, can't handle it
                    // the transaction will abort
                }
            }
        },
        dbGet: async function (store: any, key: string) {
            // TODO: try it without async, maybe it'll still work
            //@ts-ignore
            let transaction = this.db.transaction(store); // (1)
            let objectStore = transaction.objectStore(store); // (2)
            try {
                return await objectStore.get(key); // (3)
            } catch (error) {
                console.warn('Error', error);
                // unexpected error, can't handle it
            }
        },
        getItemInfo: async function (type_id: number) {
            if (!(await this.dbGet('itemsInfo', type_id.toString()))) {
                const itemInfo = await this.apiCall('Universe', 'get_universe_types_type_id', {
                    type_id,
                });
                if (!itemInfo) return;
                await this.dbSave('itemsInfo', itemInfo);
            }
            return await this.dbGet('itemsInfo', type_id.toString());
        },
        resetLoaders: function () {
            this.loadingProgress = 0;
            this.loadingColor = 'blue';
            this.indeterminate = false;
        },

        debugItemInfo: async function (item: any) {
            const groupInfo = await this.apiCall('Universe', 'get_universe_groups_group_id', {
                group_id: item.group_id,
            });
            const marketGroupInfo = await this.apiCall(
                'Market',
                'get_markets_groups_market_group_id',
                { market_group_id: item.market_group_id },
            );
            prompt(
                '',
                `${item.type_id}, // ${item.name}\n${groupInfo.group_id}, // ${groupInfo.name}\n${marketGroupInfo.market_group_id}, // ${marketGroupInfo.name}`,
            );
        },

        refreshToken: async function () {
            console.log('Refreshing token...');
            const result = await axios.get(`sso?code=${this.auth.refresh_token}&refresh=true`);
            console.warn(result);
            // this.updateAuth(
            //     (await axios.get(`sso?code=${this.auth.refresh_token}&refresh=true`)).data
            // );
            console.log('Token refreshed.');
        },
        updateAuth: function (authData: any) {
            localStorage.setItem('access_token', authData.access_token);
            localStorage.setItem('refresh_token', authData.refresh_token);
            localStorage.setItem('character_id', authData.decoded_access_token.sub.split(':')[2]);
            this.getAuthFromCache();
        },
        getAuthFromCache: function () {
            this.auth = {
                access_token: localStorage.getItem('access_token') || '',
                refresh_token: localStorage.getItem('refresh_token') || '',
                character_id: localStorage.getItem('character_id') || '',
            };
        },
        logout: function (): string {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('character_id');
            this.auth = {
                access_token: '',
                refresh_token: '',
                character_id: '',
            };
            window.location.href = 'http://localhost:8080/';
            return '';
        },
    },

    created: async function () {
        // if (localStorage.tableItems) {
        //     this.table.items = JSON.parse(localStorage.tableItems);
        // }
        this.SwaggerClient = await new SwaggerClient(
            'https://esi.evetech.net/_latest/swagger.json?datasource=tranquility',
        );

        this.db = await openDB<MyDB>('db', 3, {
            upgrade(db: any, oldVersion: any, newVersion: any, transaction: any) {
                // perform the initialization
                // if (newVersion === 4) {
                console.log('wow');
                if (!db.objectStoreNames.contains('APIcache')) {
                    // db.deleteObjectStore('APIcache');
                    db.createObjectStore('APIcache', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('itemsInfo')) {
                    db.createObjectStore('itemsInfo', { keyPath: 'type_id' });
                }
            },
        });

        if (Notification.permission !== 'granted') {
            await Notification.requestPermission();
        }

        if (window.location.search) {
            // TODO: loader while fetching and redirecting
            this.updateAuth((await axios.get(`/sso${window.location.search}`)).data);
            window.location.href = 'http://localhost:8080/';
        } else if (localStorage.getItem('access_token')) {
            this.getAuthFromCache();
        } else {
            this.redirectUrl = (await axios.get('/login-url')).data;
        }
        if (!localStorage.quickbarCounter) {
            localStorage.quickbarCounter = 0;
        }
    },

    mounted: function () {
        let vm = this;
    },

    watch: {
        SwaggerClient: async function (newVal: any) {
            console.log(this.SwaggerClient.apis);
        },
        db: async function () {
            if (localStorage.itemsInfo) {
                let itemsInfo = JSON.parse(localStorage.itemsInfo);
                for (let type_id in itemsInfo) {
                    await this.dbSave('itemsInfo', itemsInfo[type_id]);
                }
            }
        },
    },
});
</script>

<style>

.stackSheet {
    position: relative;
}
.stackSpark {
    position: absolute;
    top: 0;
    left: 0;
}
</style>
