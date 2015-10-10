import Dispatcher from './lib/Dispatcher.js';
import React from 'react';

/**
 * @flow
 */
export default class Flucky {
    dispatcher: Dispatcher;
    children: Array<Class<Flucky.ActionCreator>>;
    stores: Object;
    subscribers: Object;
    methods: Object;
    static Store: Function;
    static Component: Function;
    static ActionCreator: Function;

    constructor(dispatcher: Dispatcher, actionCreators: Array<Class<Flucky.ActionCreator>>, stores: {[key: string] : Class<Flucky.Store>}) {
        this.children = actionCreators;
        this.stores = stores;
        this.dispatcher = dispatcher;
        this.subscribers = {};
        this.methods = {};

        for(let child of this.children) {
            for(let propName of Object.getOwnPropertyNames(child.constructor.prototype)) {
                if(propName == 'constructor') {
                    continue;
                }

                let prop = child[propName];

                if(prop.constructor && prop.call && prop.apply) {
                    this.addMethod(propName, child);

                }
            }
        }

        for(let storeName in this.stores) {
            let store = this.stores[storeName];

            for(let methodName in this.methods) {
                let expectedListenerName = "on" + methodName.charAt(0).toUpperCase() + methodName.slice(1);
                //they are listening for everyone's event
                //e.g. onNotReal
                if(store[expectedListenerName] &&
                    store[expectedListenerName].constructor &&
                    store[expectedListenerName].apply &&
                    store[expectedListenerName].call) {
                    for(let type in this.methods[methodName]) {
                        let eventKey = Dispatcher.getEventKey(type, methodName);
                        let doneKey = Dispatcher.getEventDoneKey(null, methodName, store.constructor.name);
                        this.dispatcher.addAction(doneKey);
                        this.addSubscriber(eventKey,
                                           (a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af) => {
                                               store[expectedListenerName](a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa,
                                                                           ab, ac, ad, ae, af);
                                               this.dispatcher.enqueue(doneKey);
                                           });
                    }
                }

                //they are looking for a specific type
                //e.g. onTestActionsNotReal
                for(let type in this.methods[methodName]) {
                    let eventKey = Dispatcher.getEventKey(type, methodName);
                    let doneKey = Dispatcher.getEventDoneKey(type, methodName, store.constructor.name);
                    let expectedListenerName = "on" +
                        type +
                        methodName.charAt(0).toUpperCase() + methodName.slice(1);

                    this.dispatcher.addAction(doneKey);

                    if(store[expectedListenerName] &&
                        store[expectedListenerName].constructor &&
                        store[expectedListenerName].apply &&
                        store[expectedListenerName].call) {
                        this.addSubscriber(eventKey,
                                           (a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac, ad, ae, af) => {
                                               store[expectedListenerName](a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa,
                                                                           ab, ac, ad, ae, af);
                                               this.dispatcher.enqueue(doneKey);
                                           });
                    }
                }
            }
        }
    }

    addSubscriber(eventKey: string, callback: Function) : void {
        this.dispatcher.subscribe(eventKey, callback);
        this.subscribers[eventKey][this.getTypeOf(callback)] = callback;
    }

    addMethod(prop: string, child: Object) : void {
        if(!this.methods) {
            this.methods = {};
        }

        if(!this.methods[prop]) {
            this.methods[prop] = {};
            let getter = () => {
                return this.callMethod.bind(this, prop);
            };
            Object.defineProperty(this, prop, {get: getter})
        }

        let type = this.getTypeOf(child);
        let eventKey = Dispatcher.getEventKey(type, prop);
        this.dispatcher.addAction(eventKey);
        this.methods[prop][type] = child;
        this.subscribers[eventKey] = {};
    }

    callMethod(name: string, a1: any, a2: any, a3: any, a4: any, a5: any, a6: any, a7: any, a8: any, a9: any, a0: any,
               aa: any, ab: any, ac: any, ad: any, ae: any, af: any) : Array<any> {
        let dispatch = ((eventKey, payload) => {
            this.dispatcher.enqueue(eventKey, payload);
        }).bind(this);

        if(this.methods[name]) {
            let returns = [];

            for(let type in this.methods[name]) {
                let eventKey = Dispatcher.getEventKey(type, name);

                let dispatcher = {
                    dispatch: dispatch.bind(this, eventKey)
                };

                returns.push(
                    this.methods[name][type][name].bind(dispatcher)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a0, aa, ab, ac,
                                                                    ad, ae, af)
                );
            }

            return returns;
        } else {
            return [];
        }
    }

    getTypeOf(obj: any) : string {
        if(obj.constructor.name) {
            return obj.constructor.name;
        } else if(obj.constructor) {
            return obj.constructor.toString();
        } else {
            return typeof obj;
        }
    }
}

Flucky.ActionCreator = class {

};

Flucky.Store = class {

};

Flucky.Component = class extends React.Component {
    watchStore(type: Object, event: ?(string | Function)) {
        if(event != null) {
            this.addSpecificCallback(type, event);
        } else {
            this.addAllCallbacks(type);
        }
    }

    getStateFromStores() {
        throw "This method needs to be overloaded!";
    }

    _getStateFromStores() {
        this.setState(this.getStateFromStores());
    }

    addAllCallbacks(type: Object) {
        let _listener = this._getStateFromStores.bind(this);
        let flucky = this.getFlucky();

        for(let prop of Object.getOwnPropertyNames(type.prototype)) {
            if(prop != "constructor" && prop.startsWith('on')) {
                let eventKey = Dispatcher.getEventDoneKey(null, prop, type.name);
                flucky.dispatcher.subscribe(eventKey, _listener);
            }
        }
    }

    addSpecificCallback(type: Object, prop: (string | Function)) {
        let _listener = this._getStateFromStores.bind(this);
        let flucky = this.getFlucky();
        let propName = typeof prop === 'string' ? prop : prop.name;

        if(propName != "constructor" && propName.startsWith('on')) {
            let eventKey = Dispatcher.getEventDoneKey(null, propName, type.name);
            flucky.dispatcher.subscribe(eventKey, _listener);
        }
    }

    getFlucky() {
        if(!(this.context.flucky || this.props.flucky)) {
            throw "This Component instance isn't very flucky";
        } else {
            return this.props.flucky ? this.props.flucky : this.context.flucky;
        }
    }
};