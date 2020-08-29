"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const ipcamera = __importStar(require("./dahua"));
const axios_1 = __importDefault(require("axios"));
const PLUGIN_NAME = 'homebridge-dahua-alerts';
const PLATFORM_NAME = 'dahuaMotionAlerts';
let hap;
let Accessory;
class dahuaMotionPlatform {
    constructor(log, config, api) {
        this.alertMotion = (code, action, index) => {
            if (code === 'VideoMotion' && action === 'Start') {
                this.log.info('Video Motion Detected on', index);
                axios_1.default.post(this.motionUrl(index)).then((res) => {
                    this.log.info('Video motion posted to homebridge-camera-ffmpeg, received ', res.data);
                }).catch((err) => {
                    this.log.error('Error when posting video motion to homebridge-camera-ffmpeg, received ', err.data);
                });
            }
            if (code === 'VideoMotion' && action === 'Stop') {
                this.log.info('Video Motion Ended on', index);
                axios_1.default.post(this.resetMotionUrl(index)).then((res) => {
                    this.log.info('Reset video motion posted to homebridge-camera-ffmpeg, received ', res.data);
                }).catch((err) => {
                    this.log.error('Error when posting reset video motion to homebridge-camera-ffmpeg, received ', err.data);
                });
            }
        };
        this.motionUrl = (cameraIndex) => {
            return encodeURI(`http://localhost:${this.config.homebridgeCameraFfmpegHttpPort}/motion?${this.config.cameras[cameraIndex].cameraName}`);
        };
        this.resetMotionUrl = (cameraIndex) => {
            return encodeURI(`http://localhost:${this.config.homebridgeCameraFfmpegHttpPort}/motion/reset?${this.config.cameras[cameraIndex].cameraName}`);
        };
        this.log = log;
        this.config = config;
        this.api = api;
        if (this.isInvalidConfig(this.config)) {
            this.log.error('Errors above, doing nothing');
        }
        else {
            let dahuaOptions = {
                host: this.config.host,
                port: '80',
                user: this.config.user,
                pass: this.config.pass,
                log: false
            };
            let dahua = new ipcamera.dahua(dahuaOptions);
            dahua.on('alarm', this.alertMotion);
        }
    }
    isInvalidConfig(config) {
        let error = false;
        if (!config.host) {
            this.log.error('host not set in config!');
            error = true;
        }
        else if (!config.user) {
            this.log.error('user not set in config!');
            error = true;
        }
        else if (!config.pass) {
            this.log.error('pass not set in config!');
            error = true;
        }
        else if (!config.homebridgeCameraFfmpegHttpPort) {
            this.log.error('homebridge-camera-ffmpeg http port not set in config!');
            error = true;
        }
        else if (!config.cameras || config.cameras.length === 0) {
            this.log.error('no cameras configured!');
            error = true;
        }
        return error;
    }
}
module.exports = (api) => {
    hap = api.hap;
    Accessory = api.platformAccessory;
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, dahuaMotionPlatform);
};
//# sourceMappingURL=index.js.map