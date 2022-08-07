
function sortBy(attr) {
    return function (a, b) {
        var keyA = a[attr],
        keyB = b[attr];
        if (keyA < keyB) return -1;
        if (keyA > keyB) return 1;
        return 0;
    }
}

function percentage(index, array) {
    return parseInt(index / (array.length * 0.01));
}

function today() {
    return new Date().toJSON().slice(0,10).replace(/-/g,'/');
}
function hoursAgo(datetime) {
    return Math.abs(new Date() - new Date(datetime)) / 36e5;
}


function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function notify(title, body, icon, type_id) {
    new Notification(title, {
        body,
        tag: body,
        silent: false,
        requireInteraction: true,
        icon,
        // actions: [
        //     {
        //       action: `market-details-${type_id}`,
        //       title: 'Market details',
        //     }
        // ]
    });
    /*
        navigator.serviceWorker.ready.then(function(registration) {
            registration.showNotification(title, {
                body,
                tag: body,
                silent: false,
                requireInteraction: true,
                icon,
                actions: [
                    {
                    action: `market-details-${type_id}`,
                    title: 'Market details',
                    }
                ]
            });
        });
    */
}

export { sortBy, percentage, today, hoursAgo, wait, notify }