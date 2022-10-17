// import Vue from 'vue';
// import App from './App.vue';
// import Vuetify from 'vuetify/lib';
// import Vuetify from 'vuetify';
// import 'vuetify/dist/vuetify.min.css';

// const Vuetify = (window as any).Vuetify;

// new Vue({
//     render: h => h(App),
// }).$mount('#app');

// 'use strict';

// import {  } from './plugins/vuetify';

const axios = (window as any).axios;

//@ts-ignore
// import SwaggerClient from 'swagger-client';

import { wait, toIsk } from './lib/index';
import { ApiCallError, InstanceData, MyDB } from './types';

window.addEventListener('unhandledrejection', event => {
    let request = event.target; // IndexedDB native request object
    let error = event.reason; //  Unhandled error object, same as request.error
    // ...report about the error...
    console.error(request);
    console.error(error);
});

// import axios from 'axios';
const SwaggerClient = (window as any).SwaggerClient;
import { openDB } from 'idb';
import vuetify from './plugins/vuetify';
// import _ from 'lodash';

const Vue = (window as any).Vue;
const Vuetify = (window as any).Vuetify;

console.warn(Vuetify);

Vue.use(Vuetify);

Vue.config.productionTip = false;
Vue.filter('toISK', toIsk);

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
// window.onload = function () {
//     var main = new Vue({
//         el: '#main',
//         data: {
//             currentActivity: 'home',
//         },
//     });
// };
const app = new Vue({
    // el: '#app',
    // render: h => h(App),
    vuetify,
    // vuetify: new Vuetify(),

    data,

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

    beforeCreate: async function () {
        this.$vuetify.theme.dark = true;
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
        // const request = indexedDB.open('db');
        // request.onupgradeneeded = e => {
        //     alert('Upgrade needed');
        //     let db = request.result;
        //     if (!db.objectStoreNames.contains('itemsInfo')) {
        //         db.createObjectStore('itemsInfo', { keyPath: 'type_id' });
        //     }
        // };
        // request.onsuccess = e => {
        //     this.db = request.result;
        //     this.db.onversionchange = function() {
        //         db.close();
        //         alert("Database is outdated, please reload the page.")
        //     };
        //     this.db.onerror = function(event) {
        //         let request = event.target; // the request that caused the error
        //         console.warn("Error", request.error);
        //     };
        // };
        // request.onerror = e => alert('Error', e);
        if (!localStorage.quickbarCounter) {
            localStorage.quickbarCounter = 0;
        }
    },

    mounted: function () {
        let vm = this;

        // window.addEventListener(
        //     'notificationclick',
        //     async function (event) {
        //         event.notification.close();
        //         if (event.action.includes('market-details')) {
        //             const type_id = event.action.split('-')[2];
        //             await this.apiCall('User Interface', 'post_ui_openwindow_marketdetails', {
        //                 type_id,
        //             });
        //         } else {
        //             // Main body of notification was clicked
        //             // TODO: focus tab
        //         }
        //     },
        //     false,
        // );
    },

    watch: {
        SwaggerClient: async function (newVal: any) {
            console.log(this.SwaggerClient.apis);
            // if (!localStorage.regions_ids) {
            //     console.warn('Requesting regions IDs');
            //     const { get_universe_regions } = newVal.apis.Universe;
            //     localStorage.regions_ids = (await get_universe_regions()).text;
            // }

            // if (!localStorage.regions) {
            //     console.warn('Requesting regions info');
            //     const { get_universe_regions_region_id } = newVal.apis.Universe;
            //     let regions = [];
            //     for (let region_id of JSON.parse(localStorage.regions_ids)) {
            //         regions.push(
            //             _.pick(
            //                 (await get_universe_regions_region_id({ region_id })).body,
            //                 'region_id',
            //                 'name',
            //             ),
            //         );
            //     }
            //     localStorage.regions = JSON.stringify(regions);
            // }
            // this.regions = JSON.parse(localStorage.regions);
        },
        db: async function () {
            if (localStorage.itemsInfo) {
                let itemsInfo = JSON.parse(localStorage.itemsInfo);
                for (let type_id in itemsInfo) {
                    await this.dbSave('itemsInfo', itemsInfo[type_id]);
                }
            }
        },
        // savedSettingsPresets: {
        //     handler: function (newVal) {
        //         localStorage.setItem('savedSettingsPresets', JSON.stringify(newVal));
        //     },
        //     deep: true,
        // },
    },
}).$mount('#app');
