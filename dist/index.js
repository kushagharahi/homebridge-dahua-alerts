"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const axios_1 = __importDefault(require("axios"));
const dahua_1 = require("./dahua");
const PLUGIN_NAME = 'homebridge-dahua-alerts';
const PLATFORM_NAME = 'dahua-alerts';
class DahuaMotionAlertsPlatform {
    constructor(log, config) {
        this.alertMotion = (dahuaAlarm) => {
            let cameraName = this.getCameraName(dahuaAlarm);
            if (cameraName) {
                if (dahuaAlarm.action === 'Start') {
                    this.log.debug(`Video Motion Detected on index: ${dahuaAlarm.index}, mapped to camera ${cameraName}`);
                    axios_1.default.post(this.motionUrl(cameraName)).then(res => {
                        this.log.info(`Motion for ${cameraName} posted to homebridge-camera-ffmpeg, received`, res.data);
                    }).catch((err) => {
                        let msg = 'Error when posting video motion to homebridge-camera-ffmpeg';
                        if (err.response) {
                            this.log.error(`${msg} - Status Code: ${err.response.status} Response: ${err.response.data.statusMessage}`);
                        }
                        else if (err.request) {
                            this.log.error(`${msg} - didn't get a response from homebridge-camera-ffmpeg - ${err.message}`);
                        }
                        else {
                            this.log.error(`${msg}`);
                        }
                    });
                }
                else if (dahuaAlarm.action === 'Stop') {
                    this.log.debug(`Video Motion Ended on index: ${dahuaAlarm.index}, mapped to camera ${cameraName}`);
                    axios_1.default.post(this.resetMotionUrl(cameraName)).then(res => {
                        this.log.info(`Reset motion for ${cameraName} posted to homebridge-camera-ffmpeg, received`, res.data);
                    }).catch((err) => {
                        let msg = 'Error when posting reset video motion to homebridge-camera-ffmpeg';
                        if (err.response) {
                            this.log.error(`${msg} - Status Code: ${err.response.status} Response: ${err.response.data.statusMessage}`);
                        }
                        else if (err.request) {
                            this.log.error(`${msg} - didn't get a response from homebridge-camera-ffmpeg - ${err.message}`);
                        }
                        else {
                            this.log.error(`${msg}`);
                        }
                    });
                }
            }
        };
        this.motionUrl = (cameraName) => {
            return encodeURI(`http://localhost:${this.config.homebridgeCameraFfmpegHttpPort}/motion?${cameraName}`);
        };
        this.resetMotionUrl = (cameraName) => {
            return encodeURI(`http://localhost:${this.config.homebridgeCameraFfmpegHttpPort}/motion/reset?${cameraName}`);
        };
        this.getCameraName = (alarm) => {
            for (let i = 0; i < this.config.cameras.length; i++) {
                let camera = this.config.cameras[i];
                if (camera.index === Number(alarm.index)) {
                    if ((camera.cameraCredentials && camera.cameraCredentials.host === alarm.host) ||
                        (!camera.cameraCredentials && this.config.host && this.config.host === alarm.host)) {
                        return camera.cameraName;
                    }
                }
            }
            return null;
        };
        this.isInvalidConfig = (config) => {
            let error = false;
            if (!config.homebridgeCameraFfmpegHttpPort) {
                this.log.error('homebridge-camera-ffmpeg http port not set in config!');
                error = true;
            }
            else if (!config.cameras || config.cameras.length === 0) {
                this.log.error('no cameras configured!');
                error = true;
            }
            else if ((config.host || config.user || config.pass) && this.invalidCameraCredentials({ host: config.host, user: config.user, pass: config.pass })) {
                error = true;
            }
            else {
                config.cameras.forEach((camera) => {
                    if (!camera.cameraName || (!camera.index && camera.index !== 0)) {
                        this.log.error('no camera name or index set!');
                        error = true;
                        return;
                    }
                    /*if it has camera credentials and it's invalid */
                    else if (camera.cameraCredentials && this.invalidCameraCredentials(camera.cameraCredentials)) {
                        error = true;
                        return error;
                    }
                });
            }
            return error;
        };
        this.log = log;
        this.config = config;
        if (this.isInvalidConfig(this.config)) {
            this.log.error('Errors above, shutting plugin down');
            return;
        }
        else {
            //find all uniqueHosts in config in order to only setup one "DahuaEvents" (socket) connection per unique host
            let uniqueHosts = new Map();
            if (config.host) {
                uniqueHosts.set(config.host, { host: config.host, user: config.user, pass: config.pass, useHttp: config.useHttp });
            }
            this.config.cameras.forEach(camera => {
                if (camera.cameraCredentials) {
                    uniqueHosts.set(camera.cameraCredentials.host, camera.cameraCredentials);
                }
            });
            uniqueHosts.forEach(host => {
                let events = new dahua_1.DahuaEvents(host.host, host.user, host.pass, host.useHttp);
                events.getEventEmitter().on(events.ALARM_EVENT_NAME, this.alertMotion);
                events.getEventEmitter().on(events.ERROR_EVENT_NAME, (data) => {
                    this.log.error(`${data.error} (for more info enable debug logging)`);
                    this.log.debug(`${data.errorDetails}`);
                });
                events.getEventEmitter().on(events.DEBUG_EVENT_NAME, (data) => this.log.debug(data));
                events.getEventEmitter().on(events.RECONNECTING_EVENT_NAME, (data) => this.log.debug(data));
            });
        }
    }
    invalidCameraCredentials(config) {
        let error = false;
        if (!config.host) {
            this.log.error('host not set!');
            error = true;
        }
        else if (!config.user) {
            this.log.error('user not set!');
            error = true;
        }
        else if (!config.pass) {
            this.log.error('pass not set!');
            error = true;
        }
        return error;
    }
}
module.exports = (api) => {
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, DahuaMotionAlertsPlatform);
};
//# sourceMappingURL=index.js.map