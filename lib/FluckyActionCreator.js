export default class FluckyActionCreator {
    error:Function;
    dispatch:Function;
    actions:{
        [key: string]: Function
    };
}