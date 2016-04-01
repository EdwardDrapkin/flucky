/**
 * @flow
 */

import React from 'react';
import Flucky from './Flucky';

let ReactComponent = React.Component; //thx flow

export default class FluckyComponent<DefaultProps, Props, State> extends ReactComponent<DefaultProps, Props, State> {
    static defaultProps:DefaultProps;
    static propTypes:$Subtype<{[_: $Keys<Props>]: any}>; //object whose keys are in PropTypes

    subscriptions:{[key:string]:string};
    stores:Array<{type:Object, event:?(string|Function)}>;

    constructor(props:$Shape<Props>, context:any) {
        super(props, context);

        this.stores = [];
        this.subscriptions = {};
    }

    watchStore(type:Object, event:?(string | Function)) {
        this.stores.push({type, event});
    }

    componentWillMount():void {
        for(const {type, event} of this.stores) {
            if(event != null) {
                this.addSpecificCallback(type, event);
            } else {
                this.addAllCallbacks(type);
            }
        }
    }

    componentWillUnmount():void {
        for(const eventKey in this.subscriptions) {
            this.getFlucky().dispatcher.unsubscribe(eventKey, this.subscriptions[eventKey]);
            delete this.subscriptions[eventKey];
        }
    }

    getStateFromStores():{[key:string]:any} {
        throw "This method needs to be overloaded!";
    }

    _getStateFromStores() {
        this.setState(this.getStateFromStores());
    }

    addAllCallbacks(type:Object) {
        const _listener = this._getStateFromStores.bind(this);
        const flucky = this.getFlucky();

        for(const prop of Object.getOwnPropertyNames(type.prototype)) {
            if(prop != "constructor" && prop.startsWith('on')) {
                const eventKey = Flucky.Dispatcher.getEventDoneKey(null, prop, type.name);

                if(!this.subscriptions[eventKey]) {
                    this.subscriptions[eventKey] = flucky.dispatcher.subscribe(eventKey, _listener);
                }
            }
        }
    }

    addSpecificCallback(type:Object, prop:(string | Function)) {
        const _listener = this._getStateFromStores.bind(this);
        const flucky = this.getFlucky();
        const propName = typeof prop === 'string' ? prop : prop.name;

        if(propName != "constructor" && propName.startsWith('on')) {
            const eventKey = Flucky.Dispatcher.getEventDoneKey(null, propName, type.name);
            if(!this.subscriptions[eventKey]) {
                this.subscriptions[eventKey] = flucky.dispatcher.subscribe(eventKey, _listener);
            }
        }
    }

    getFlucky():Flucky & {[key:string]: Function} {
        if(!(this.context.flucky || this.props.flucky)) {
            throw "This Component instance isn't very flucky";
        } else {
            return this.props.flucky ? this.props.flucky : this.context.flucky;
        }
    }
}