/**
 * @flow
 */

import React from 'react';
import FluckyStore from './lib/FluckyStore.js';
import FluckyActionCreator from './lib/FluckyActionCreator';
import FluckyDispatcher from './lib/FluckyDispatcher';
import FluckyComponent from './lib/FluckyComponent';

class Flucky {
    dispatcher:FluckyDispatcher;
    children:Array<FluckyActionCreator>;
    stores:{[key:string]:FluckyStore};
    subscribers:{[key:string]:Object};
    methods:{[key:string]:{[key:string]:{[key:string]:Function}}};
    actionCallers:{[key:string]:Function};
    static Store:typeof FluckyStore;
    static Component:typeof FluckyComponent;
    static ActionCreator:typeof FluckyActionCreator;
    static Dispatcher: typeof FluckyDispatcher;

    constructor(dispatcher: FluckyDispatcher, actionCreators:Array<FluckyActionCreator>,
                stores:{[key: string] : FluckyStore}) {
        this.children = actionCreators;
        this.stores = stores;
        this.dispatcher = dispatcher;
        this.subscribers = {
            'ERROR': {}
        };
        this.methods = {};
        this.actionCallers = {};

        for(const child of this.children) {
            for(const propName of Object.getOwnPropertyNames(child.constructor.prototype)) {
                if(propName == 'constructor') {
                    continue;
                }
                // $FlowIgnore
                const prop = child[propName];

                if(prop.constructor && prop.call && prop.apply) {
                    this.addMethod(propName, child);
                }
            }
        }

        for(const storeName in this.stores) {
            const store = this.stores[storeName];

            // $FlowIgnore
            if(store.hasOwnProperty('onError') && store['onError'].constructor && store['onError'].apply && store['onError'].call) {
                const doneKey = Flucky.Dispatcher.getEventDoneKey(null, 'onError', store.constructor.name);
                this.dispatcher.addAction(doneKey);

                this.addSubscriber('ERROR', ((a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af) => {
                    // $FlowIgnore
                    store['onError'](a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af);
                    this.dispatcher.enqueue(doneKey);
                }).bind(this));
            }

            for(const methodName in this.methods) {
                const expectedListenerName = "on" + methodName.charAt(0).toUpperCase() + methodName.slice(1);
                //they are listening for everyone's event
                //e.g. onNotReal

                // $FlowIgnore
                if(store[expectedListenerName] && store[expectedListenerName].constructor && store[expectedListenerName].apply && store[expectedListenerName].call) {
                    for(const type in this.methods[methodName]) {
                        const eventKey = Flucky.Dispatcher.getEventKey(type, methodName);
                        const doneKey = Flucky.Dispatcher.getEventDoneKey(null, methodName, store.constructor.name);
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
                for(const type in this.methods[methodName]) {
                    const eventKey = Flucky.Dispatcher.getEventKey(type, methodName);
                    const doneKey = Flucky.Dispatcher.getEventDoneKey(type, methodName, store.constructor.name);
                    const _expectedListener = "on" + type +
                        methodName.charAt(0).toUpperCase() + methodName.slice(1);

                    this.dispatcher.addAction(doneKey);

                    // $FlowIgnore
                    if(store[_expectedListener] && store[_expectedListener].constructor && store[_expectedListener].apply && store[_expectedListener].call) {
                        this.addSubscriber(eventKey,
                                           ((a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af) => {
                                               // $FlowIgnore
                                               store[_expectedListener](a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af);
                                               this.dispatcher.enqueue(doneKey);
                                           }).bind(this));
                    }
                }
            }
        }
    }

    addSubscriber(eventKey:string, callback:Function):void {
        this.dispatcher.subscribe(eventKey, callback);
        this.subscribers[eventKey][Flucky.getTypeOf(callback)] = callback;
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

            this.actionCallers[prop] = (...args) => {
                return this.callMethod.bind(this, prop)(...args);
            };
            Object.defineProperty(this, prop, {get: getter})
        }

        const type = Flucky.getTypeOf(child);
        const eventKey = Flucky.Dispatcher.getEventKey(type, prop);
        this.dispatcher.addAction(eventKey);
        this.methods[prop][type] = child;
        this.subscribers[eventKey] = {};
    }

    callMethod(name:string, a1:any, a2:any, a3:any, a4:any, a5:any, a6:any, a7:any, a8:any, a9:any, a0:any,
               aa:any, ab:any, ac:any, ad:any, ae:any, af:any):Array<any> {
        const dispatch = ((eventKey, payload) => {
            this.dispatcher.enqueue(eventKey, payload);
        }).bind(this);

        if(this.methods[name]) {
            const returns = [];

            for(const type in this.methods[name]) {
                const eventKey = Flucky.Dispatcher.getEventKey(type, name);
                const _methods = this.actionCallers;

                const dispatcher = {
                    // $FlowIgnore
                    get actions() {
                        const sealed = {};
                        Object.assign(sealed, _methods);
                        Object.seal(sealed);
                        return sealed;
                    },
                    dispatch: dispatch.bind(this, eventKey),
                    error: ((xhr = null, msg = "Please provide error messages, dumbass.", data = {}) => {
                        const errorObject = {
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

    static getTypeOf(obj:any):string {
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


