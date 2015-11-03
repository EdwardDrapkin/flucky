/**
 * @flow
 */

import React from 'react';

export class FluckyActionCreator {
    error: Function;
    dispatch: Function;
}

export class FluckyStore {}

export class FluckyDispatcher {
    subscribers:{[key: string] : Object};
    subscriptionId:number;
    idPrefix:string;
    actions:{[key: string] : string};
    queue:Array<{action: string, payload: any}>;
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

    _dispatch(action:string, payload:any):void {
        this.isBusy = true;
        for(let id in this.subscribers[action]) {
            this.subscribers[action][id](payload);
        }
        this.isBusy = false;
    }

    enqueue(action:string, payload:any):void {
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

export class FluckyComponent extends React.Component {
    subscriptions:{[key:string]:boolean};
    stores:Array<{type:Object, event:?(string|Function)}>;

    constructor(ctx, props) {
        super(ctx, props);

        this.stores = [];
        this.subscriptions = {};
    }

    watchStore(type:Object, event:?(string | Function)) {
        this.stores.push({type, event});
    }

    componentWillMount() {
        for(let {type, event} of this.stores) {
            if(event != null) {
                this.addSpecificCallback(type, event);
            } else {
                this.addAllCallbacks(type);
            }
        }
    }

    componentWillUnmount() {
        for(let eventKey in this.subscriptions) {
            this.getFlucky().dispatcher.unsubscribe(eventKey, this.subscriptions[eventKey]);
            delete this.subscriptions[eventKey];
        }
    }

    getStateFromStores() {
        throw "This method needs to be overloaded!";
    }

    _getStateFromStores() {
        this.setState(this.getStateFromStores());
    }

    addAllCallbacks(type:Object) {
        let _listener = this._getStateFromStores.bind(this);
        let flucky = this.getFlucky();

        for(let prop of Object.getOwnPropertyNames(type.prototype)) {
            if(prop != "constructor" && prop.startsWith('on')) {
                let eventKey = Flucky.Dispatcher.getEventDoneKey(null, prop, type.name);

                if(!this.subscriptions[eventKey]) {
                    let subKey = flucky.dispatcher.subscribe(eventKey, _listener);
                    this.subscriptions[eventKey] = subKey;
                }
            }
        }
    }

    addSpecificCallback(type:Object, prop:(string | Function)) {
        let _listener = this._getStateFromStores.bind(this);
        let flucky = this.getFlucky();
        let propName = typeof prop === 'string' ? prop : prop.name;

        if(propName != "constructor" && propName.startsWith('on')) {
            let eventKey = Flucky.Dispatcher.getEventDoneKey(null, propName, type.name);
            if(!this.subscriptions[eventKey]) {
                let subKey = flucky.dispatcher.subscribe(eventKey, _listener);
                this.subscriptions[eventKey] = subKey;
            }
        }
    }

    getFlucky() {
        if(!(this.context.flucky || this.props.flucky)) {
            throw "This Component instance isn't very flucky";
        } else {
            return this.props.flucky ? this.props.flucky : this.context.flucky;
        }
    }
}

class Flucky {
    dispatcher:FluckyDispatcher;
    children:Array<FluckyActionCreator>;
    stores:{[key:string]:FluckyStore};
    subscribers:Object;
    methods:{[key:string]:{[key:string]:{[key:string]:Function}}};
    actionCallers:{[key:string]:Function};
    static Store:typeof FluckyStore;
    static Component:typeof FluckyComponent;
    static ActionCreator:typeof FluckyActionCreator;
    static Dispatcher: typeof FluckyDispatcher;

    constructor(dispatcher: Flucky.Dispatcher, actionCreators:Array<Flucky.ActionCreator>,
                stores:{[key: string] : Flucky.Store}) {
        this.children = actionCreators;
        this.stores = stores;
        this.dispatcher = dispatcher;
        this.subscribers = {
            'ERROR': {}
        };
        this.methods = {};
        this.actionCallers = {};

        for(let child of this.children) {
            for(let propName of Object.getOwnPropertyNames(child.constructor.prototype)) {
                if(propName == 'constructor') {
                    continue;
                }

                // $FlowIgnore
                let prop = child[propName];

                if(prop.constructor && prop.call && prop.apply) {
                    this.addMethod(propName, child);
                }
            }
        }

        for(let storeName in this.stores) {
            let store = this.stores[storeName];

            // $FlowIgnore
            if(store['onError'] && store['onError'].constructor && store['onError'].apply && store['onError'].call) {
                const doneKey = Flucky.Dispatcher.getEventDoneKey(null, 'onError', store.constructor.name);
                this.dispatcher.addAction(doneKey);

                this.addSubscriber('ERROR', ((a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af) => {
                    // $FlowIgnore
                    store['onError'](a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af);
                    this.dispatcher.enqueue(doneKey);
                }).bind(this));
            }

            for(let methodName in this.methods) {
                let expectedListenerName = "on" + methodName.charAt(0).toUpperCase() + methodName.slice(1);
                //they are listening for everyone's event
                //e.g. onNotReal

                // $FlowIgnore
                if(store[expectedListenerName] && store[expectedListenerName].constructor && store[expectedListenerName].apply && store[expectedListenerName].call) {
                    for(let type in this.methods[methodName]) {
                        let eventKey = Flucky.Dispatcher.getEventKey(type, methodName);
                        let doneKey = Flucky.Dispatcher.getEventDoneKey(null, methodName, store.constructor.name);
                        this.dispatcher.addAction(doneKey);
                        this.addSubscriber(eventKey,
                                           ((a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af) => {
                                               // $FlowIgnore
                                               store[expectedListenerName](a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af);
                                               this.dispatcher.enqueue(doneKey);
                                           }).bind(this));
                    }
                }

                //they are looking for a specific type
                //e.g. onTestActionsNotReal
                for(let type in this.methods[methodName]) {
                    let eventKey = Flucky.Dispatcher.getEventKey(type, methodName);
                    let doneKey = Flucky.Dispatcher.getEventDoneKey(type, methodName, store.constructor.name);
                    let expectedListenerName = "on" + type +
                        methodName.charAt(0).toUpperCase() + methodName.slice(1);

                    this.dispatcher.addAction(doneKey);

                    // $FlowIgnore
                    if(store[expectedListenerName] && store[expectedListenerName].constructor && store[expectedListenerName].apply && store[expectedListenerName].call) {
                        this.addSubscriber(eventKey,
                                           ((a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af) => {
                                               // $FlowIgnore
                                               store[expectedListenerName](a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af);
                                               this.dispatcher.enqueue(doneKey);
                                           }).bind(this));
                    }
                }
            }
        }
    }

    addSubscriber(eventKey:string, callback:Function):void {
        this.dispatcher.subscribe(eventKey, callback);
        this.subscribers[eventKey][this.getTypeOf(callback)] = callback;
    }

    addMethod(prop:string, child:Object):void {
        if(!this.methods) {
            this.methods = {};
        }

        if(!this.methods[prop]) {
            this.methods[prop] = {};
            const getter = () => {
                return this.callMethod.bind(this, prop);
            };

            const caller = (...args) => {
                return this.callMethod.bind(this, prop)(...args);
            };

            this.actionCallers[prop] = caller;
            Object.defineProperty(this, prop, {get: getter})
        }

        let type = this.getTypeOf(child);
        let eventKey = Flucky.Dispatcher.getEventKey(type, prop);
        this.dispatcher.addAction(eventKey);
        this.methods[prop][type] = child;
        this.subscribers[eventKey] = {};
    }

    callMethod(name:string, a1:any, a2:any, a3:any, a4:any, a5:any, a6:any, a7:any, a8:any, a9:any, a0:any,
               aa:any, ab:any, ac:any, ad:any, ae:any, af:any):Array<any> {
        let dispatch = ((eventKey, payload) => {
            this.dispatcher.enqueue(eventKey, payload);
        }).bind(this);

        if(this.methods[name]) {
            let returns = [];

            for(let type in this.methods[name]) {
                const eventKey = Flucky.Dispatcher.getEventKey(type, name);
                const _methods = this.actionCallers;

                let dispatcher = {
                    get actions() {
                        const sealed = {};
                        Object.assign(sealed, _methods);
                        Object.seal(sealed);
                        return sealed;
                    },
                    dispatch: dispatch.bind(this, eventKey),
                    error: ((xhr = null, msg = "Please provide error messages, dumbass.", data = {}) => {
                        let errorObject = {
                            _DEFERRED_SUCCESS_EVENT: eventKey, //is this ever useful?
                            _ACTION_CREATOR: type,
                            _ACTION: name,
                            xhr: xhr,
                            message: msg,
                            data: data
                        };

                        this.dispatcher.enqueue('ERROR', errorObject);
                    }).bind(this)
                };

                returns.push(
                    this.methods[name][type][name]
                        .bind(dispatcher)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af)
                );
            }

            return returns;
        } else {
            return [];
        }
    }

    getTypeOf(obj:any):string {
        if(obj.constructor.name) {
            return obj.constructor.name;
        } else if(obj.constructor) {
            return obj.constructor.toString();
        } else {
            return typeof obj;
        }
    }
}




Flucky.ActionCreator = FluckyActionCreator;

Flucky.Store = FluckyStore;

Flucky.Component = FluckyComponent;

Flucky.Dispatcher = FluckyDispatcher;

export default Flucky;


