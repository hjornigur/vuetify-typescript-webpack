import Vue from 'vue';
import App from './App.vue';
import { toIsk } from './lib';

window.addEventListener('unhandledrejection', event => {
    let request = event.target; // IndexedDB native request object
    let error = event.reason; //  Unhandled error object, same as request.error
    // ...report about the error...
    console.error(request);
    console.error(error);
});

import vuetify from './plugins/vuetify';

Vue.filter('toISK', toIsk);

Vue.config.productionTip = false;

const app = new Vue({
    // el: '#app',
    render: h => h(App),
    vuetify,

    beforeCreate: async function () {
        this.$vuetify.theme.dark = true;
    },
}).$mount('#app');
