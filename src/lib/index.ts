function sortBy(attr: any) {
    return function (a: any, b: any) {
        var keyA = a[attr],
            keyB = b[attr];
        if (keyA < keyB) return -1;
        if (keyA > keyB) return 1;
        return 0;
    };
}

function percentage(index: number, array: string[]): number {
    return Math.floor(index / (array.length * 0.01));
}

function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function notify(title: string, body: string, icon: string, type_id: number) {
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

function toIsk(value: any) {
    if (typeof value !== 'number') {
        return value;
    }
    var formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'ISK',
        minimumFractionDigits: 0,
    });
    return formatter.format(value);
}

export { sortBy, percentage, wait, notify, toIsk };
