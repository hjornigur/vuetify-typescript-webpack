'use strict';

import { wait, toIsk } from './lib/index';

window.addEventListener('unhandledrejection', event => {
    let request = event.target; // IndexedDB native request object
    let error = event.reason; //  Unhandled error object, same as request.error
    // ...report about the error...
    console.error(request);
    console.error(error);
});

const axios = (window as any).axios;
const SwaggerClient = (window as any).SwaggerClient;
const idb = (window as any).idb;
const _ = (window as any)._;

const Vue = (window as any).Vue;
const Vuetify = (window as any).Vuetify;

Vue.use(Vuetify);
Vue.filter('toISK', toIsk);

const app = new Vue({
    el: '#app',
    vuetify: new Vuetify(),
    data: {
        SwaggerClient: null,
        db: null,
        auth: {
            auth_token: '',
            refresh_token: '',
            character_id: '',
        },
        redirectUrl: '',
        constants: {
            metaGroup: {
                attribute_id: 1692,
                values: {
                    storyLine: 3,
                    faction: 4,
                    officer: 5,
                    deadspace: 6,
                },
            },
            blueprints: 1955,

            sales_tax: 0.013,
            brokers_fee_sell: 0.01,
            brokers_fee_buy: 0.01,
        },
        ignore: {
            type_id: [
                3571, // CONCORD Quad 3500mm Siege Artillery
            ],
            group_id: [
                1301, // Services
                873, // Capital Construction Components
                781, // Rig Core
                779, // Rig Launcher
                257, // Spaceship Command
                958, // Core Subsystem
            ],
            market_group_id: [
                2412, // Standup Heavy Fighters
                2411, // Standup Light Fighters
                751, // Overseer's Personal Effects
            ],
        },
        regions: [], // TODO: Для каждого региона - свой набор пресетов (для начала одинаковых)

        loading: false,
        loadingProgress: undefined,
        loadingColor: 'blue',
        indeterminate: false,
        // loaders: [
        //     // {
        //     //     color: '',
        //     //     buffer: 0,
        //     //     progress: 0
        //     // },
        //     {
        //         color: 'purple',
        //         buffer: 100,
        //         progress: 0
        //     },
        //     {
        //         color: 'red lighten-2',
        //         buffer: 100,
        //         progress: 0
        //     },
        //     {
        //         color: 'black',
        //         buffer: 100,
        //         progress: 0
        //     },
        // ],
        error: false,
        errorMessage: '',
        info: false,
        infoMessage: '',

        table: {
            options: {
                sortBy: ['score_scale'],
                sortDesc: [true],
            },
            headers: [
                { text: 'Competition', value: 'competition', sortable: true },
                { text: 'Icon', value: 'image', sortable: false },
                { text: 'Name', value: 'name', sortable: false },
                { text: '', value: 'type_id', sortable: false },
                // { text: "Score", value: "score", sortable: true },
                // { text: "Score recent", value: "scoreRecent", sortable: true },
                { text: 'Volume', value: 'volume_average', sortable: true },
                // { text: "Capacity", value: "capacityAverage", sortable: true },
                { text: 'Margin', value: 'margin', sortable: true },
                { text: 'Sell price', value: 'sell_price', sortable: true },
                // { text: "Sell % diff", value: "sell_average_24h" },
                { text: 'Buy price', value: 'buy_price', sortable: true },
                // { text: "Buy % diff", value: "buy_average_24h" },
                {
                    text: 'Profit w relistings',
                    value: 'max_reasonable_with_relistings',
                    sortable: true,
                },
                { text: '👌', value: 'volume_recommended', sortable: false },
                // { text: "Estimated profit", value: "estimated_profit", sortable: true },
                { text: 'Rating', value: 'score_scale', sortable: true },
                // { text: "Location", value: "location", sortable: true },
                // { text: "Volume",  }
                { text: '.', value: 'actions', sortable: false },
            ],
            items: [],
            selected: [],
            gradientSell: ['#F0F', '#00c6ff', '#FF0'],
            gradientBuy: ['red', 'yellow', 'green'],
            fill: false,
            showLabels: true,
            rating: {
                halfIncrements: true,
            },
        },

        dialog: false,

        sessionCache: {
            itemsInfo: {},
        },
    },
    methods: {
        getClient: function () {
            console.log(this.SwaggerClient);
        },
        apiCall: async function (
            endpointCategory: string,
            endpoint: string,
            kwargs: any,
            responseKey: string,
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
                        'put',
                    );
                    result = response[responseKey || 'body'];
                } catch (error) {
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
                    if ((error = 'TypeError: Failed to fetch')) {
                        await wait(5000);
                    }
                    timesFailed++;
                }
            }
            return result;
        },
        dbSave: async function (store: any, record: any, method = 'add') {
            let transaction = this.db.transaction(store, 'readwrite'); // (1)
            // get an object store to operate on it
            let objectStore = transaction.objectStore(store); // (2)
            // if (store == 'APIcache') {
            //     const indexNames = store.indexNames;
            //     debugger ;
            // }
            try {
                await objectStore[method](record); // (3)
                await transaction.done;
            } catch (error) {
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
            if (!(await this.dbGet('itemsInfo', type_id))) {
                const itemInfo = await this.apiCall('Universe', 'get_universe_types_type_id', {
                    type_id,
                });
                if (!itemInfo) return;
                await this.dbSave('itemsInfo', itemInfo);
            }
            return await this.dbGet('itemsInfo', type_id);
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
                access_token: localStorage.getItem('access_token'),
                refresh_token: localStorage.getItem('refresh_token'),
                character_id: localStorage.getItem('character_id'),
            };
        },
        resetAuth: function () {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('character_id');
            this.auth = {};
            window.location.href = 'http://localhost:8080/';
        },
    },
    beforeCreate: async function () {
        this.$vuetify.theme.dark = true;
        this.SwaggerClient = await new SwaggerClient(
            'https://esi.evetech.net/_latest/swagger.json?datasource=tranquility',
        );

        this.db = await idb.openDB('db', 3, {
            upgrade(db: any, oldVersion: any, newVersion: any, transaction: any) {
                // perform the initialization
                // if (newVersion === 4) {
                if (!db.objectStoreNames.contains('APIcache')) {
                    // db.deleteObjectStore('APIcache');
                    db.createObjectStore('APIcache', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('itemsInfo')) {
                    db.createObjectStore('itemsInfo', { keyPath: 'type_id' });
                }

                // v2
                if (!db.objectStoreNames.contains('itemRoughVolumeAverage')) {
                    db.createObjectStore('itemRoughVolumeAverage', { keyPath: 'type_id' });
                }

                // v3
                if (!db.objectStoreNames.contains('itemCompetition24h')) {
                    db.createObjectStore('itemCompetition24h', { keyPath: 'type_id' });
                }

                // TODO: remove this?
                if (!db.objectStoreNames.contains('marketHistory')) {
                    db.createObjectStore('marketHistory', { keyPath: 'type_id' });
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
    },
    created: async function () {
        if (localStorage.tableItems) {
            this.table.items = JSON.parse(localStorage.tableItems);
        }
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
            if (!localStorage.regions_ids) {
                console.warn('Requesting regions IDs');
                const { get_universe_regions } = newVal.apis.Universe;
                localStorage.regions_ids = (await get_universe_regions()).text;
            }

            if (!localStorage.regions) {
                console.warn('Requesting regions info');
                const { get_universe_regions_region_id } = newVal.apis.Universe;
                let regions = [];
                for (let region_id of JSON.parse(localStorage.regions_ids)) {
                    regions.push(
                        _.pick(
                            (await get_universe_regions_region_id({ region_id })).body,
                            'region_id',
                            'name',
                        ),
                    );
                }
                localStorage.regions = JSON.stringify(regions);
            }
            this.regions = JSON.parse(localStorage.regions);
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
});
