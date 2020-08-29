import {
	API,
	IndependentPlatformPlugin,
	Logging,
	PlatformConfig
} from 'homebridge'
import { DahuaCameraConfig, CameraConfig } from './configTypes';
import axios, { AxiosRequestConfig, AxiosPromise, AxiosResponse } from 'axios';
let ipcamera = require('./dahua')

const PLUGIN_NAME = 'homebridge-dahua-alerts'
const PLATFORM_NAME = 'dahuaMotionAlerts';

export = (api: API) => {
	api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, dahuaMotionPlatform);
};

class dahuaMotionPlatform implements IndependentPlatformPlugin {
	private readonly log: Logging;
	private readonly api: API;
	private readonly config: DahuaCameraConfig;

	constructor(log: Logging, config: PlatformConfig, api: API) {
		this.log = log
		this.config = config as unknown as DahuaCameraConfig
		this.api = api
		
		if(this.isInvalidConfig(config)) {
			this.log.error('Errors above, doing nothing')
			return
		} else {
			let dahuaOptions = {
				host: config.host,
				port: '80',
				user: config.user,
				pass: config.pass,
				log: false
			}
			let dahua = new ipcamera.dahua(dahuaOptions)
			dahua.on('alarm', this.alertMotion)
		}
	}

	private alertMotion = (code: string, action: string, index: number) => {
		if (code === 'VideoMotion' && action === 'Start')	{
			this.log.info('Video Motion Detected on', index)
			axios.post(this.motionUrl(index)).then((res) => {
				this.log.info('Video motion posted to homebridge-camera-ffmpeg, received ', res.data)
			}).catch((err) => {
				this.log.error('Error when posting video motion to homebridge-camera-ffmpeg, received ', err.data)
			})
		}
		if (code === 'VideoMotion' && action === 'Stop')	{
			this.log.info('Video Motion Ended on', index)
			axios.post(this.resetMotionUrl(index)).then((res) => {
				this.log.info('Reset video motion posted to homebridge-camera-ffmpeg, received ', res.data)
			}).catch((err) => {
				this.log.error('Error when posting reset video motion to homebridge-camera-ffmpeg, received ', err.data)
			})
		}
	}

	private motionUrl = (cameraIndex: number): string => {
		return encodeURI(`http://localhost:${this.config.homebridgeCameraFfmpegHttpPort}/motion?${this.config.cameras[cameraIndex].cameraName}`)
	}

	private resetMotionUrl = (cameraIndex: number): string => {
		return encodeURI(`http://localhost:${this.config.homebridgeCameraFfmpegHttpPort}/motion/reset?${this.config.cameras[cameraIndex].cameraName}`)
	}

	private isInvalidConfig(config: PlatformConfig): boolean {
		let error = false
		if(!config.host) {
			this.log.error('host not set in config!')
			error = true
		} else if(!config.user) {
			this.log.error('user not set in config!')
			error = true
		} else if(!config.pass) {
			this.log.error('pass not set in config!')
			error = true
		} else if(!config.homebridgeCameraFfmpegHttpPort) {
			this.log.error('homebridge-camera-ffmpeg http port not set in config!')
			error = true
		} else if(!config.cameras || config.cameras.length === 0) {
			this.log.error('no cameras configured!')
			error = true
		}

		return error
	}
}