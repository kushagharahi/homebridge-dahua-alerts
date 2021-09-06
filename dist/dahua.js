"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DahuaEvents = void 0;
const axios_1 = __importDefault(require("axios"));
const https_1 = require("https");
const http_1 = require("http");
const events_1 = require("events");
const crypto_1 = __importDefault(require("crypto"));
class DahuaEvents {
    constructor(host, user, pass, useHttp) {
        ///cgi-bin/eventManager.cgi?action=attach&codes=[AlarmLocal,VideoMotion,VideoLoss,VideoBlind] -- but we only care about VideoMotion
        this.EVENTS_URI = '/cgi-bin/eventManager.cgi?action=attach&codes=[VideoMotion]';
        this.HEADERS = { 'Accept': 'multipart/x-mixed-replace' };
        this.SOCKET_CLOSE = 'close';
        this.RECONNECT_INTERNAL_MS = 10000;
        this.AGENT_SETTINGS = {
            keepAlive: true,
            keepAliveMsecs: 1000,
            maxSockets: 1,
            maxFreeSockets: 1,
            timeout: 30000
        };
        this.ALARM_EVENT_NAME = 'alarm';
        this.DEBUG_EVENT_NAME = 'alarm_payload';
        this.ERROR_EVENT_NAME = 'error';
        this.DATA_EVENT_NAME = 'data';
        this.RECONNECTING_EVENT_NAME = 'reconnecting';
        this.connect = (axiosRequestConfig, count) => {
            axios_1.default.request(axiosRequestConfig).then((res) => {
                let stream = res.data;
                this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Successfully connected and listening to host: ${this.host}`);
                this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Connection response received for host: ${this.host} ${JSON.stringify(res.headers)} ${JSON.stringify(res.statusText)} ${JSON.stringify(res.status)}`);
                stream.on(this.DATA_EVENT_NAME, (data) => {
                    this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Response recieved on host: ${this.host}: ${data.toString()}`);
                    let event = this.parseEventData(data.toString());
                    this.eventEmitter.emit(this.ALARM_EVENT_NAME, { action: event.action, index: event.index, host: this.host });
                });
                stream.on(this.SOCKET_CLOSE, () => {
                    this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Socket connection closed for host: ${this.host}`);
                    this.reconnect(axiosRequestConfig, 1000);
                });
                stream.on('error', (data) => {
                    this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Socket connection errored on host: ${this.host} + ${data.toString()}`);
                });
                stream.on('end', () => {
                    this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Socket connection ended on host: ${this.host}`);
                });
                stream.on('timeout', () => {
                    this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Socket connection timed out for host: ${this.host} after ${this.AGENT_SETTINGS.timeout / 1000} seconds, destroying connection`);
                    stream.destroy((error) => {
                        this.eventEmitter.emit(this.ERROR_EVENT_NAME, `Error destroying connection to ${this.host} ${JSON.stringify(error)}`);
                    });
                });
            }).catch((err) => {
                var _a, _b, _c;
                let error = {
                    error: `Error received from host: ${this.host}`,
                    errorDetails: "Error Details:"
                };
                // Request made and server responded with response
                if (err.response) {
                    if (err.response.status === 401 && err.response.headers['www-authenticate']) {
                        try {
                            /* digest auth, build digest auth header
                             * The two examples I've seen from these cameras are:
                             * Digest realm="Login to ND021811019863",qop="auth",nonce="211955164",opaque="9a206a55e922ee7900769ec61ae49bf0c1f30242"
                             * or:
                             * Digest realm="Login to ND021811019863", qop="auth", nonce="211955164", opaque="9a206a55e922ee7900769ec61ae49bf0c1f30242"
                             * The split() regex splits on the commas eliminating any potential white-spaces before and after the comma (s*)
                             */
                            const authDetails = err.response.headers['www-authenticate'].split(/\s*,\s*/).map(v => v.split('='));
                            ++count;
                            const nonceCount = ('00000000' + count).slice(-8);
                            const cnonce = crypto_1.default.randomBytes(24).toString('hex');
                            const realm = authDetails[0][1].replace(/"/g, '');
                            const nonce = authDetails[2][1].replace(/"/g, '');
                            const md5 = str => crypto_1.default.createHash('md5').update(str).digest('hex');
                            const HA1 = md5(`${(_a = axiosRequestConfig.auth) === null || _a === void 0 ? void 0 : _a.username}:${realm}:${(_b = axiosRequestConfig.auth) === null || _b === void 0 ? void 0 : _b.password}`);
                            const HA2 = md5(`GET:${this.EVENTS_URI}`);
                            const response = md5(`${HA1}:${nonce}:${nonceCount}:${cnonce}:auth:${HA2}`);
                            this.HEADERS['authorization'] = `Digest username="${(_c = axiosRequestConfig.auth) === null || _c === void 0 ? void 0 : _c.username}",realm="${realm}",` +
                                `nonce="${nonce}",uri="${this.EVENTS_URI}",qop="auth",algorithm="MD5",` +
                                `response="${response}",nc="${nonceCount}",cnonce="${cnonce}"`;
                            axiosRequestConfig.headers = this.HEADERS;
                            this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `401 received and www-authenticate headers, sending digest auth. Count: ${count}`);
                            this.connect(axiosRequestConfig, count);
                            return;
                        }
                        catch (e) {
                            error.errorDetails = `${error.errorDetails} Error when building digest auth headers, please open an issue with this log: \n ${e}`;
                        }
                    }
                    else {
                        error.errorDetails = `${error.errorDetails} Status Code: ${err.response.status} Response: ${err.response.data.statusMessage}`;
                    }
                    // client never received a response, or request never left
                }
                else if (err.request) {
                    error.errorDetails = `${error.errorDetails} Didn't get a response from the NVR - ${err.message}`;
                }
                else {
                    error.errorDetails = `${error.errorDetails} ${err.message}`;
                }
                this.eventEmitter.emit(this.ERROR_EVENT_NAME, error);
                this.reconnect(axiosRequestConfig, this.RECONNECT_INTERNAL_MS);
            });
        };
        this.reconnect = (axiosRequestConfig, reconnection_interval_ms) => {
            //reconnect after 30s
            this.eventEmitter.emit(this.RECONNECTING_EVENT_NAME, `Reconnecting to ${this.host} in ${reconnection_interval_ms / 1000}s.`);
            setTimeout(() => {
                this.connect(axiosRequestConfig, 0);
            }, reconnection_interval_ms);
        };
        this.parseEventData = (data) => {
            /** Sample data:
             
                myboundary
                Content-Type: text/plain
                Content-Length:36
                Code=VideoMotion;action=Stop;index=0
    
                ---or---
    
                --myboundary
    
                Content-Type: text/plain
    
                Content-Length:77
    
                Code=VideoMotion;action=Stop;index=5;data={
                "SmartMotionEnable" : false
                }
             */
            let action = "";
            let index = "";
            try {
                let eventSplitByLine = data.split('\n');
                eventSplitByLine.forEach(event => {
                    if (event.includes(';')) {
                        let alarm = event.split(';');
                        action = alarm[1].substr(7);
                        index = alarm[2].substr(6);
                    }
                });
            }
            catch (e) {
                this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Could not parse event data: ${data}`);
            }
            return { action: action, index: index };
        };
        this.getEventEmitter = () => {
            return this.eventEmitter;
        };
        this.host = host;
        const auth = {
            username: user,
            password: pass
        };
        let keepAliveAgent;
        if (useHttp) {
            keepAliveAgent = new http_1.Agent({
                keepAlive: this.AGENT_SETTINGS.keepAlive,
                keepAliveMsecs: this.AGENT_SETTINGS.keepAliveMsecs,
                maxSockets: this.AGENT_SETTINGS.maxSockets,
                maxFreeSockets: this.AGENT_SETTINGS.maxFreeSockets,
                timeout: this.AGENT_SETTINGS.timeout
            });
        }
        else {
            keepAliveAgent = new https_1.Agent({
                keepAlive: this.AGENT_SETTINGS.keepAlive,
                keepAliveMsecs: this.AGENT_SETTINGS.keepAliveMsecs,
                maxSockets: this.AGENT_SETTINGS.maxSockets,
                maxFreeSockets: this.AGENT_SETTINGS.maxFreeSockets,
                rejectUnauthorized: false,
                minVersion: "TLSv1",
                timeout: this.AGENT_SETTINGS.timeout
            });
        }
        let useSSL = useHttp ? 'http' : 'https';
        const axiosRequestConfig = {
            url: `${useSSL}://${host}${this.EVENTS_URI}`,
            httpsAgent: keepAliveAgent,
            httpAgent: keepAliveAgent,
            auth: auth,
            headers: this.HEADERS,
            method: 'GET',
            responseType: 'stream'
        };
        this.eventEmitter = new events_1.EventEmitter();
        this.connect(axiosRequestConfig, 0);
    }
}
exports.DahuaEvents = DahuaEvents;
//# sourceMappingURL=dahua.js.map