/**
 * @flow
 */

import React from 'react';
import FluckyStore from './lib/FluckyStore.js';
import FluckyActionCreator from './lib/FluckyActionCreator';
import FluckyDispatcher from './lib/FluckyDispatcher';
import FluckyComponent from './lib/FluckyComponent';
import Flucky from './lib/Flucky';




Flucky.ActionCreator = FluckyActionCreator;

Flucky.Store = FluckyStore;

Flucky.Component = FluckyComponent;

Flucky.Dispatcher = FluckyDispatcher;

export {Flucky as default, FluckyDispatcher, FluckyComponent, FluckyStore, FluckyActionCreator};


