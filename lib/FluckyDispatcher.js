/**
 * @flow
 */
export default class FluckyDispatcher {
    subscribers:{[key: string] : Object};
    subscriptionId:number;
    idPrefix:string;
    actions:{[key: string] : string};
    queue:Array<{action: string, payload: ?Object}>;
    isBusy:boolean;
    dispatchAsync:boolean;

    constructor(dispatchAsync:boolean = false) {
        this.subscribers = {
            ERROR: {}
        };
        this.subscriptionId = 0;
        this.idPrefix = '____dispatch____';
        this.actions = {
            ERROR: 'ERROR'
        };
        this.queue = [];
        this.isBusy = false;
        this.dispatchAsync = dispatchAsync;
    }

    addAction(action:string):void {
        this.subscribers[action] = {};
        this.actions[action] = action;
    }

    deleteAction(action:string):void {
        delete this.subscribers[action];
        delete this.actions[action];
    }

    dispatch():void {
        if(this.isBusy && this.dispatchAsync) {
            throw "Can't dispatch while dispatching, use enqueue instead.";
        }

        if(this.queue.length > 0) {
            var oldQueue = this.queue;
            this.queue = [];

            for(var i = 0; i < oldQueue.length; i++) {
                var tempQueue = this.queue;
                this.queue = [];
                var action = oldQueue[i].action;
                var payload = oldQueue[i].payload;
                this._dispatch(action, payload);
                this.queue = tempQueue.concat(this.queue);
            }
        }
    }

    _dispatch(action:string, payload:?Object):void {
        this.isBusy = true;
        for(const id in this.subscribers[action]) {
            this.subscribers[action][id](payload);
        }
        this.isBusy = false;
    }

    enqueue(action:string, payload:?Object = null):void {
        this._verify(action);
        this.queue.push({action, payload});

        if(!this.dispatchAsync) {
            this.dispatch();
        }
    }

    subscribe(action:string, listener:Function, id:?string = null):string {
        if(id == null) {
            id = this.idPrefix + this.subscriptionId++;
        }

        this._verify(action);
        this.subscribers[action][id] = listener;
        return id;
    }

    unsubscribe(action:string, id:string) {
        this._verify(action);
        delete this.subscribers[action][id];
    }

    _verify(action:string) {
        if(!this.actions[action]) {
            throw "No such action: " + action;
        }
    }

    static getEventKey(type:string, name:string) {
        return (type + "_" + name).toUpperCase();
    }

    static getEventDoneKey(type:?string, name:string, store:string) {
        if(name.toLowerCase().startsWith('on')) {
            name = name.slice(2);
        }
        return (store + "_" + (type != null ? type + name : name) + "_done").toUpperCase();
    }
}