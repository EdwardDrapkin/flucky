/**
 * @flow
 */

import FluckyDispatcher from './FluckyDispatcher';
import FluckyActionCreator from './FluckyActionCreator';
import FluckyStore from './FluckyStore';

export default class Flucky {
    dispatcher:FluckyDispatcher;
    children:Array<FluckyActionCreator>;
    stores:{[key:string]:FluckyStore};
    subscribers:{[key:string]:Object};
    methods:{[key:string]:{[key:string]:{[key:string]:Function}}};
    actionCallers:{[key:string]:Function};
    constructor(dispatcher:FluckyDispatcher, actionCreators:Array<FluckyActionCreator>,
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
            if(store.onError && store['onError'].constructor && store['onError'].apply && store['onError'].call) {
                let doneKey = FluckyDispatcher.getEventDoneKey(null, 'onError', store.constructor.name);
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
                    for(const type in this.methods[methodName]) {
                        let __eventKey = FluckyDispatcher.getEventKey(type, methodName);
                        let __doneKey = FluckyDispatcher.getEventDoneKey(null, methodName, store.constructor.name);
                        let __dispatch = this.dispatcher.enqueue.bind(this.dispatcher, __doneKey);

                        this.dispatcher.addAction(__doneKey);
                        this.addSubscriber(__eventKey,
                                           ((a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af) => {
                                               // $FlowIgnore
                                               store[expectedListenerName](a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa,
                                                                           ab, ac, ad, ae, af);
                                               __dispatch();
                                           }).bind(this));
                    }
                }

                //they are looking for a specific type
                //e.g. onTestActionsNotReal
                for(const type in this.methods[methodName]) {
                    let _eventKey = FluckyDispatcher.getEventKey(type, methodName);
                    let _doneKey = FluckyDispatcher.getEventDoneKey(type, methodName, store.constructor.name);
                    let _expectedListener = "on" + type + methodName.charAt(0).toUpperCase() + methodName.slice(1);

                    this.dispatcher.addAction(_doneKey);
                    let _dispatch = this.dispatcher.enqueue.bind(this.dispatcher, _doneKey);

                    // $FlowIgnore
                    if(store[_expectedListener] && store[_expectedListener].constructor && store[_expectedListener].apply && store[_expectedListener].call) {
                        this.addSubscriber(_eventKey,
                                           ((a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af) => {
                                               // $FlowIgnore
                                               store[_expectedListener](a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab,
                                                                        ac, ad, ae, af);
                                               _dispatch();
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
        const eventKey = FluckyDispatcher.getEventKey(type, prop);
        this.dispatcher.addAction(eventKey);
        this.methods[prop][type] = child;
        this.subscribers[eventKey] = {};
    }

    error(message:string, data?:any = null, xhr :?Object = null) : void {
        const errorObj = {
            _DEFERRED_SUCCESS_EVENT: "Manual error invocation, call site not available.",
            _ACTION_CREATOR: "Flucky",
            _ACTION: "ERROR",
            xhr: xhr,
            message: message,
            data: data
        };

        Object.seal(errorObj);

        this.dispatcher.enqueue("ERROR", errorObj);
    }

    callMethod(name:string, a1:any, a2:any, a3:any, a4:any, a5:any, a6:any, a7:any, a8:any, a9:any, a0:any,
               aa:any, ab:any, ac:any, ad:any, ae:any, af:any):Array<any> {
        const dispatch = ((eventKey, payload) => {
            this.dispatcher.enqueue(eventKey, payload);
        }).bind(this);

        if(this.methods[name]) {
            const returns = [];

            for(const type in this.methods[name]) {
                const eventKey = FluckyDispatcher.getEventKey(type, name);
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
                    error: ((xhr = null, msg = "An error message was not provided.", data = {}) => {
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
