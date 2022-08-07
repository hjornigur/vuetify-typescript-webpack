'use strict';

import { sortBy, percentage, today, hoursAgo, wait, notify } from './lib/index';


window.addEventListener('unhandledrejection', event => {
    let request = event.target; // IndexedDB native request object
    let error = event.reason; //  Unhandled error object, same as request.error
    // ...report about the error...
    console.error(request)
    console.error(error)
});

Vue.use(Vuetify);
Vue.filter('toISK', function (value) {
    if (typeof value !== "number") {
        return value;
    }
    var formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'ISK',
        minimumFractionDigits: 0
    });
    return formatter.format(value);
})


function settingsTemplate () {
    return {
        presetName: Math.random().toString(),  // EZ way to get unique name placeholder
        selected_region: 10000002,  // The Forge
        minPrice: null,
        maxPrice: null,
        minMargin: 10,
        minVolumeAverage: 30,
        maxCompetition: 0.3,  // Which is '(average daily volume) == (volume in sell+buy orders that were updated within 24h)'
        competitionFactor: 3,
        presenceFactor: 5,
        volumeHeuristics: true,
        competitionHeuristics: false,
        includeFolderName: true
    }
}

function getCompetition(item, orders) {
    let volumeRemain = 0;
    let volumeRemainSell = 0;
    let volumeRemainBuy = 0;
    // let volumeRemainRecent = 0;
    item.sparklineSell = [0, 1];
    item.sparklineBuy = [0, 1];
    // for (let i = 0; i < 24; i++) {
    //     item.sparklineSell.push(0);
    //     item.sparklineBuy.push(0);
    // }
    for (let order of orders) {
        let orderHoursAgo = hoursAgo(order.issued);

        if (orderHoursAgo <= 23) {
            volumeRemain += order.volume_remain;
            let sparkKey;
            if (order.is_buy_order) {
                sparkKey = 'sparklineBuy';
                volumeRemainBuy += order.volume_remain;
            }
            else {
                sparkKey = 'sparklineSell';
                volumeRemainSell += order.volume_remain;
            }
            // item[sparkKey][Math.floor(orderHoursAgo)] += order.volume_remain;
            item[sparkKey].push(order.volume_remain);
        }
        // if (orderHoursAgo <= 4) {
        //     volumeRemainRecent += order.volume_remain;
        // }
    }
    // let highestVolume = _.max(item.sparklineBuy) > _.max(item.sparklineSell) ? _.max(item.sparklineBuy) : _.max(item.sparklineSell);
    // item.sparklineSell.push(highestVolume)
    // item.sparklineBuy.push(highestVolume)
    item.competitionSpreadSell = item.sparklineSell.slice(1).filter(v => v < 2).length || 1;
    item.competitionSpreadBuy = item.sparklineBuy.slice(1).filter(v => v < 2).length || 1;

    if (item.sparklineBuy.length == 1) {
        item.sparklineBuy.push(1);
    }
    if (item.sparklineSell.length == 1) {
        item.sparklineSell.push(1);
    }
    item.sparklineBuy.sort(function(a, b){return b-a})
    item.sparklineSell.sort(function(a, b){return b-a})
    while (item.sparklineBuy.length <= 20) {
        item.sparklineBuy.push(0)
    }
    while (item.sparklineSell.length <= 20) {
        item.sparklineSell.push(0)
    }

    item.competition = (volumeRemain / item.volume_average).toFixed(1);
    item.competitionSell = (volumeRemainSell / item.volume_average).toFixed(2);
    item.competitionBuy = (volumeRemainBuy / item.volume_average).toFixed(2);

}

/*
Margin mode / Hodl mode
*/

/*
Fitting buyer helper!
Fraction-Deadspace adviser
    Get advices on all similar meta-modules market deals
    - Sell prices (including Perimeter - SSO required)
    - Buy prices
        - Competition
        - Get advice to set your order on TTT (optional mini-guide provided!)
Get market quickbar folder with all items
*/

/*
1
Competitors orders volume
*/ 


/*
2
---
Don't fetch certain data if settings did not change

- What data should be cached?
    - Items info
    - Market average data
- What set of changed settings parameters should trigger cache reload?
    - Region (rare case but better should be accounted as well)
    - Min price
    - Max price
    - Volume average
- In what form should we save cached data?
    - First look at current data structure

- Implementation
1. data attr - whether settings changed since last scan
2. change to false after 

*/

/*
3
Periodical auto fetching
*/

/*
Narrow down to factional charges C:<
*/

/*
Absolute rating reference
*/

/*
Improve filtering
- Exclude titan books

Improve formula
- Favor absence of total orders, buy or sell (like for Virtue Omega and Gistii Remote SB)
- Favor average volume per order
- Dislike rigs

- Calculate relistings cost from competition
*/

const app = new Vue({
    /*
        Git commit
        
        Scan: Не показывать айтемы, которые уже есть в ордерах

        Auto-scan:
            Global enable/disable option (radio button)
            Per-preset enable/disable option (radio button, bound to preset)
            Per-preset interval option (select, in munutes)
            Table:
                Отдельный компонент таблицы не нужен, т.к. будет итерация по v-tabs и дублирования кода не будет
                table-items поместить на уровень пресета
                table-headers сделать ссылкой в каждом пресете (они не меняются)
            Тест: Мониторить, согласен ли я с рейтингом
            Уведомлять только если рейтинг больше n

        Undercut notifications
            tag: title + n
            Global enable/disable option (radio button)
            Global interval option (radio button)
    */
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

        settings: settingsTemplate(),
        savedSettingsPresets: [],
        presetsChanged: false,
        competitionFactors: [1, 2, 3, 4, 5],
        presenceFactors: [5, 10, 15, 20, 25],
        constants: {
            metaGroup: {
                attribute_id: 1692,
                values: {
                    storyLine: 3,
                    faction: 4,
                    officer: 5,
                    deadspace: 6
                }
            },
            blueprints: 1955,
            
            sales_tax: 0.013,
            brokers_fee_sell: 0.01,
            brokers_fee_buy: 0.01
        
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
            ]
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
                sortDesc: [true]
            },
            headers: [
                { text: "Competition", value: "competition", sortable: true },
                { text: "Icon", value: "image", sortable: false },
                { text: "Name", value: "name", sortable: false },
                { text: "", value: "type_id", sortable: false },
                // { text: "Score", value: "score", sortable: true },
                // { text: "Score recent", value: "scoreRecent", sortable: true },
                { text: "Volume", value: "volume_average", sortable: true },
                // { text: "Capacity", value: "capacityAverage", sortable: true },
                { text: "Margin", value: "margin", sortable: true },
                { text: "Sell price", value: "sell_price", sortable: true },
                // { text: "Sell % diff", value: "sell_average_24h" },
                { text: "Buy price", value: "buy_price", sortable: true },
                // { text: "Buy % diff", value: "buy_average_24h" },
                { text: "Profit w relistings", value: "max_reasonable_with_relistings", sortable: true },
                { text: "👌", value: "volume_recommended", sortable: false },
                // { text: "Estimated profit", value: "estimated_profit", sortable: true },
                { text: "Rating", value: "score_scale", sortable: true },
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
            }
        },

        dialog: false,
        marketQuickbarText: '',

        sessionCache: {
            itemsInfo: {},
            itemRoughVolumeAverage: {},
        },

        fitting: "",
    },
    methods: {
        getClient: function() {
            console.log(this.SwaggerClient)
        },
        newSettingsPreset: function () {
            this.savedSettingsPresets.push(settingsTemplate());
        },
        apiCall: async function(endpointCategory, endpoint, kwargs, responseKey) {
            let result;
            let timesFailed = 0;
            while (!result && timesFailed < 3) {
                // TODO: Check whether auth is needed
                if (kwargs) {
                    // TODO: add structure_id check
                    if (endpoint.includes('character_id'))
                    kwargs.token = this.auth.access_token;
                }

                try {
                    const kwargsEncoded = kwargs ? Object.entries(kwargs)
                        .map(entry => entry.map(String).join(''))
                        .join('') : '';
                    const cacheKey = endpointCategory + endpoint + kwargsEncoded;
                    const cached = await this.dbGet('APIcache', cacheKey);

                    if (cached && (cached.expires) > new Date()) {
                        return cached.data[responseKey || 'body'];
                    }

                    const request = this.SwaggerClient.apis[endpointCategory][endpoint](kwargs);
                    const response = await request;

                    await this.dbSave('APIcache', {
                        id: cacheKey,
                        expires: new Date(response.headers.expires),
                        data: response
                    }, 'put');
                    result = response[responseKey || 'body'];
                }
                catch (error) {
                    this.error = true;
                    this.errorMessage = error;
                    if (error.status == 404) {
                        if (kwargs.type_id) {
                            this.errorMessage = `${endpoint} info for "${(await this.dbGet('itemsInfo', kwargs.type_id)).name}" not found`;
                        }
                        break;
                    }
                    if (error.status == 403) {
                        await this.refreshToken();
                    }
                    if (error = 'TypeError: Failed to fetch') {
                        await wait(5000);
                    }
                    timesFailed++;
                }
            }
            return result;
        },
        dbSave: async function (store, record, method = 'add') {
            let transaction = this.db.transaction(store, "readwrite"); // (1)
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
                if (error.name == "ConstraintError") {
                    console.log("Record with such id already exists:", store, record.type_id); // handle the error
                    // error.preventDefault(); // don't abort the transaction
                    // use another key for the book?
                    // error.stopPropagation(); // don't bubble error up, "chew" it
                } else {
                    console.warn("Error", error);
                    // unexpected error, can't handle it
                    // the transaction will abort
                }
            }
        },
        dbGet: async function (store, key) { // TODO: try it without async, maybe it'll still work
            let transaction = this.db.transaction(store); // (1)
            let objectStore = transaction.objectStore(store); // (2)
            try {
                return await objectStore.get(key); // (3)
            } catch (error) {
                console.warn("Error", error);
                // unexpected error, can't handle it
            }

        },
        getDealInfo: function(sell_price, buy_price) {
            // TODO: Sell taxes from Jita instead of Perimeter
            // TODO: Ability to choose this option per-item and remember it
            let profit_info = {};

            profit_info.margin = ((sell_price - buy_price) / (sell_price * 0.01)).toFixed(2);

            profit_info.max_profit = sell_price
                                        - buy_price
                                        - buy_price  * this.constants.brokers_fee_buy
                                        - sell_price * this.constants.brokers_fee_sell
                                        - sell_price * this.constants.sales_tax;

            profit_info.max_reasonable_with_relistings = parseInt(
                profit_info.max_profit
                    - (sell_price * (this.constants.brokers_fee_sell * 0.25) * 4) // 4 sell relistings at Jita 4-4
                    - (buy_price * (this.constants.brokers_fee_buy & 0.25) * 4)  // 4 buy relistings, 0.0025% each
            );
            return profit_info;
        },
        getItemInfo: async function(type_id) {
            if (!await this.dbGet('itemsInfo', type_id)) {
                const itemInfo = await this.apiCall(
                    'Universe', 'get_universe_types_type_id', { type_id }
                );
                if (!itemInfo) return;
                await this.dbSave('itemsInfo', itemInfo);
            }
            return await this.dbGet('itemsInfo', type_id);
        },
        // TODO: Refactoring: Вынести в отдельный файл
        scan: async function() {
            try {
                this.table.items = [];
                this.table.selected = [];
                this.loading = true;

                this.info = true;
                this.infoMessage = '1/5: Get market prices';

                this.indeterminate = true;
                const prices_info = await this.apiCall('Market', 'get_markets_prices');
                this.indeterminate = false;
                
                // Min price filter
                this.infoMessage = '2/5: Price';
                // TODO: automagic condition
                let valuable_items_prices = prices_info.filter(item => {
                    return (this.settings.minPrice
                                ? item.average_price >= parseFloat(this.settings.minPrice) * 1000000
                                : true)
                           && (this.settings.maxPrice
                                ? item.average_price <= parseFloat(this.settings.maxPrice) * 1000000
                                : true);
                });
                
                let filtered_valuable_items = {};
                
                this.loadingProgress = 0;
                this.indeterminate = false;
                this.infoMessage = '3/5: Basic';
                top_context: for (let i in valuable_items_prices) {
                    this.loadingProgress = percentage(i, valuable_items_prices);
                    let item_price_info = valuable_items_prices[i];
                    // If there is no data for given item - fetch it from ESI and save it to the local database

                    // let item;
                    // if (!this.presetsChanged) {
                    //     item = this.sessionCache.itemsInfo[item_price_info.type_id];
                    // }

                    // if (!item) {
                    
                    // }
                    // if (this.presetsChanged || !item) {
                        // item = await this.dbGet('itemsInfo', item_price_info.type_id);
                    let item = await this.getItemInfo(item_price_info.type_id);
                    if (!item) continue top_context;
                    this.sessionCache.itemsInfo[item.type_id] = item;
                    // }

                    if (item.dogma_attributes) {
                        for (let attr of item.dogma_attributes) {
                            if ((attr.attribute_id == this.constants.metaGroup.attribute_id
                                && attr.value == this.constants.metaGroup.values.officer)
                                || attr.attribute_id == this.constants.blueprints
                            ) {
                                continue top_context;
                            }
                        }
                    }

                    for (let attribute in this.ignore) {
                        if (this.ignore[attribute].includes(item[attribute])) {
                            continue top_context;
                        }
                    }

                    if (item.name.includes('Blueprint') || item.name.includes('SKIN')) {
                        continue top_context;
                    }
                    filtered_valuable_items[item.type_id] = item;
                }

                this.loadingProgress = 0;
                this.infoMessage = '4/5: Volume';
                let total = Object.keys(filtered_valuable_items);
                let counter = 0;
                for (let key in filtered_valuable_items) {
                    this.loadingProgress = percentage(counter++, total);

                    let item = filtered_valuable_items[key];

                    // Use one-time volume average measurement
                    if (this.settings.volumeHeuristics) {
                        let itemRoughVolumeAverage = await this.dbGet('itemRoughVolumeAverage', item.type_id);
                        if (itemRoughVolumeAverage) {
                            item.volume_average = itemRoughVolumeAverage.value;
                        }
                    }
                    if (!item.volume_average) {
                        let price_history = await this.apiCall(
                            'Market', 'get_markets_region_id_history',
                            { region_id: this.settings.selected_region, type_id: item.type_id }
                        );
                        if (!price_history) {
                            delete filtered_valuable_items[key];
                            continue;
                        }
                        let last_month_history = price_history.slice(Math.max(price_history.length - 30, 0));
                        item.volume_average = _.meanBy(last_month_history, 'volume').toFixed(1);

                        await this.dbSave('itemRoughVolumeAverage', {
                            type_id: item.type_id,
                            value: item.volume_average
                        });
                    }
                    // console.log(item.volume_average, this.settings.minVolumeAverage, item.volume_average <= parseInt(this.settings.minVolumeAverage))
                    if (item.volume_average <= parseInt(this.settings.minVolumeAverage)) {
                        delete filtered_valuable_items[key];
                    }
                }

                
                this.loadingProgress = 0;
                total = Object.keys(filtered_valuable_items);
                counter = 0;
                this.infoMessage = '5/5: Margin & Competition';
                let topScore = 0;
                for (let key in filtered_valuable_items) {
                    this.loadingProgress = percentage(counter++, total);

                    let item = filtered_valuable_items[key];

                    // TODO: Чо это? Описать
                    let itemCompetition24h;
                    if (this.settings.competitionHeuristics) {
                        itemCompetition24h = await this.dbGet('itemCompetition24h', item.type_id);
                        if (itemCompetition24h && itemCompetition24h.value > this.settings.maxCompetition) {
                            delete filtered_valuable_items[key];
                            continue;
                        }
                    }

                    const orders = await this.apiCall(
                        'Market', 'get_markets_region_id_orders',
                        { region_id: this.settings.selected_region, type_id: item.type_id }
                    );
                    if (!orders) {
                        delete filtered_valuable_items[key];
                        continue;
                    }

                    getCompetition(item, orders);

                    if (this.settings.competitionHeuristics && !itemCompetition24h) {
                        await this.dbSave('itemCompetition24h', {
                            type_id: item.type_id,
                            value: item.competition
                        });
                    }

                    if (item.competition > this.settings.maxCompetition) {
                        delete filtered_valuable_items[key];
                        continue;
                    }

                    // item.competitionRecent = (volumeRemainRecent / item.volume_average).toFixed(1);

                    const sell_orders = orders.filter(o => !o.is_buy_order);
                    const buy_orders = orders.filter(o => o.is_buy_order);

                    if (!sell_orders.length || !buy_orders.length) {
                        delete filtered_valuable_items[key];
                        continue;
                    }

                    item.sell_price = _.minBy(sell_orders, 'price').price;
                    item.buy_price = _.maxBy(buy_orders, 'price').price;                    
                    _.assignIn(item, this.getDealInfo(item.sell_price, item.buy_price));

                    /*
                    item.sell_average_24h = (
                        (
                            _.meanBy(
                                sell_orders.filter(o => (hoursAgo(o.issued) <= 23)),
                                'price'
                            ) 
                            - item.sell_price
                        )
                        / (item.sell_price * 0.01)
                    ).toFixed(1);
                    item.buy_average_24h = (
                        (
                            item.buy_price
                            - _.meanBy(
                                sell_orders.filter(o => (hoursAgo(o.issued) <= 23)),
                                'price'
                            )
                        )
                        / (item.buy_price * 0.01)
                    ).toFixed(1); */

                    item.volume_recommended = (
                        (parseInt(this.settings.presenceFactor) / 100)
                        * item.volume_average
                        * (1 - item.competition)
                    ).toFixed(1);

                    item.estimated_profit = Math.floor(item.volume_recommended * item.max_reasonable_with_relistings);

                    // item.capacityAverage = parseInt(item.volume_average * item.max_reasonable_with_relistings);

                    item.score = parseInt(item.estimated_profit
                            // / (item.competition ** this.settings.competitionFactor)
                            / item.competitionSpreadBuy
                            / item.competitionSpreadSell
                    );
                    // item.scoreRecent = parseInt(item.estimated_profit / (item.competitionRecent ** this.settings.competitionFactor));
                    if (item.score > topScore) {
                        topScore = item.score;
                    }

                    if (item.margin <= parseFloat(this.settings.minMargin)) {
                        delete filtered_valuable_items[key];
                    }
                }
                for (let item of Object.values(filtered_valuable_items)) {
                    item.score_scale = parseInt(item.score / (topScore * 0.1)) / 2;
                }


                this.table.items = Object.values(filtered_valuable_items);
                console.log(this.table.items)
                localStorage.tableItems = JSON.stringify(this.table.items);
            } catch (error) {
                this.error = true;
                this.errorMessage = error;
            } finally {
                this.loading = false;
                this.resetLoaders();
                this.info = false;
                this.infoMessage = '';
                this.presetsChanged = false;
                notify('SCAN READY', '', `https://images.evetech.net/characters/${this.auth.character_id}/portrait`);
            }
        },
        resetLoaders: function () {
            this.loadingProgress = 0;
            this.loadingColor = 'blue';
            this.indeterminate = false;
        },
        getMarketQuickbarText: function () {
            const contents = this.table.selected.map(item => `- ${item.name} [${Math.round(item.volume_recommended)}_${Math.round(item.sell_price / 1000)}_${Math.round(item.buy_price / 1000)}]`);
            this.marketQuickbarText =  this.settings.includeFolderName ? `+ ${this.settings.presetName}   : ${localStorage.quickbarCounter++}\n` : '';
            this.marketQuickbarText += contents.join('\n')
            this.$nextTick(() => {
                setTimeout(()=>{
                    this.$refs['toCopy'].$refs.input.select()
                }, 200)
            });
            // document.getElementById('toCopy').select();
        },
        sortPresets: function () {
            this.savedSettingsPresets.sort(sortBy('presetName'))
        },
        deletePreset: function () {
            const index = this.savedSettingsPresets.indexOf(this.settings);
            this.savedSettingsPresets.splice(index, 1);
        },

        copyFit: function () {
            let toCopy = '+ Fittings: ' + this.fitting.split('\n')[0] + '\n';
            let items = {};
            for (let item of this.fitting.split('\n').slice(1)) {
                if (!item) continue;
                const itemName = item.replace(/\sx\d+/g, '');
                const quantity = item.match(/\s(x\d+)/g) ? parseInt(item.match(/\s(x\d+)/g)[0].replace(' x', '')) : 1;
                if (items[itemName]) {
                    items[itemName] += quantity;
                }
                else {
                    items[itemName] = quantity;
                }
            }

            toCopy += '- ' + this.fitting.split('\n')[0].match(/\[(\S+)\, /)[1] + '\n';

            for (let itemName in items) {
                toCopy += `- ${itemName} [${items[itemName]}]\n`;
            }
            this.fitting = toCopy;
        },

        debugItemInfo: async function(item) {
            const groupInfo = await this.apiCall(
                'Universe', 'get_universe_groups_group_id',
                { group_id: item.group_id }
            )
            const marketGroupInfo = await this.apiCall(
                'Market', 'get_markets_groups_market_group_id',
                { market_group_id: item.market_group_id }
            )
            prompt('', `${item.type_id}, // ${item.name}\n${groupInfo.group_id}, // ${groupInfo.name}\n${marketGroupInfo.market_group_id}, // ${marketGroupInfo.name}`)
        },

        getMyOrders: async function() {
            console.log(this.auth.character_id);
            return await this.apiCall('Market', 'get_characters_character_id_orders', {
                character_id: this.auth.character_id
            });
        },
        checkMyOrders: async function () {
            console.log('!')
            // How to handle multiple orders of the same type?
            // Choose the best price!
            const myOrders = await this.getMyOrders();
            let itemsUndercut = [];
            for (let myOrder of myOrders) {
                const itemOrders = (await this.apiCall(
                    'Market', 'get_markets_region_id_orders',
                    { region_id: this.settings.selected_region, type_id: myOrder.type_id }
                )).filter(o => o.order_id != myOrder.order_id);
                const itemInfo = await this.getItemInfo(myOrder.type_id);
                itemInfo.sum = myOrder.price * myOrder.volume_remain;
                if (myOrder.is_buy_order) {
                    const buyMax = _.maxBy(itemOrders.filter(o => o.is_buy_order), 'price').price;
                    if (myOrder.price <= buyMax) {
                        itemsUndercut.push(itemInfo);
                    }
                }
                else {
                    const sellMin = _.minBy(itemOrders.filter(o => !o.is_buy_order), 'price').price;
                    if (myOrder.price >= sellMin) {
                        itemsUndercut.push(itemInfo);
                    }
                }
            }
            if (itemsUndercut.length) {
                itemsUndercut = _.sortBy(itemsUndercut, 'sum').reverse();
                for (let item of itemsUndercut) {
                    notify('UNDERCUT', item.name, `https://images.evetech.net/types/${item.type_id}/icon`);    
                }
                
            }
        },

        refreshToken: async function () {
            console.log('Refreshing token...');
            this.updateAuth(
                (await axios.get(`sso?code=${this.auth.refresh_token}&refresh=true`)).data
            );
            console.log('Token refreshed.')
        },
        updateAuth: function (authData) {
            localStorage.setItem('access_token', authData.access_token);
            localStorage.setItem('refresh_token', authData.refresh_token);
            localStorage.setItem('character_id', authData.decoded_access_token.sub.split(':')[2]);
            this.getAuthFromCache();
        },
        getAuthFromCache: function () {
            this.auth = {
                access_token: localStorage.getItem('access_token'),
                refresh_token: localStorage.getItem('refresh_token'),
                character_id: localStorage.getItem('character_id')
            }
        },
        
    },
    beforeCreate: async function () {
        this.$vuetify.theme.dark = true;
        this.SwaggerClient = await new SwaggerClient('https://esi.evetech.net/_latest/swagger.json?datasource=tranquility');

        this.db = await idb.openDB('db', 3, {
            upgrade(db, oldVersion, newVersion, transaction) {
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
            this.updateAuth(
                (await axios.get(`/sso${window.location.search}`)).data
            );
            window.location.href = 'http://localhost:8080/'
        }
        else if (localStorage.getItem('access_token')) {
            this.getAuthFromCache();
        }
        else {
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
        if (!localStorage.getItem('savedSettingsPresets')) {
            localStorage.setItem('savedSettingsPresets', JSON.stringify([]));
        }
        this.savedSettingsPresets = JSON.parse(localStorage.getItem('savedSettingsPresets'));
        if (this.savedSettingsPresets.length) {
            this.settings = this.savedSettingsPresets[0];
        }

        if (localStorage.tableItems) {
            this.table.items = JSON.parse(localStorage.tableItems);
        }
        if (!localStorage.quickbarCounter) {
            localStorage.quickbarCounter = 0;
        }
    },
    mounted: function () {
        let vm = this;
        window.addEventListener('keyup', function (event) {
            if (event.code == 'KeyE' && event.shiftKey) {
                event.preventDefault()
                vm.dialog = true;
                vm.getMarketQuickbarText()
            }
        })

        window.addEventListener('keyup', async function (event) {
            if (event.code == 'KeyS' && event.shiftKey) {
                event.preventDefault()
                await vm.scan()
            }
        })
        window.addEventListener('notificationclick', async function(event) {
            event.notification.close();
            if (event.action.includes('market-details')) {
                const type_id = event.action.split('-')[2];
                await this.apiCall('User Interface', 'post_ui_openwindow_marketdetails', {
                    type_id
                });
            } else {
              // Main body of notification was clicked
              // TODO: focus tab
            }
          }, false);
          

        if (this.auth.character_id) {
            // TODO: Check if authenticated
            setInterval(() => {
                this.checkMyOrders();
            }, 1000 * 60 * 20);

            setTimeout(() => {
                this.checkMyOrders();
            }, 1000 * 10);
        }
    },
    watch: {
        SwaggerClient: async function (newVal) {
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
                            'region_id', 'name'
                        )
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
        savedSettingsPresets: {
            handler: function (newVal) {
                localStorage.setItem('savedSettingsPresets', JSON.stringify(newVal));
            },
            deep: true
        }
    }
})
