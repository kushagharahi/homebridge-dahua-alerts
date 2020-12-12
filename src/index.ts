import {
	API,
	IndependentPlatformPlugin,
	Logging,
	PlatformConfig
} from 'homebridge'
import { DahuaCameraConfig, CameraConfig } from './configTypes';
import axios, {} from 'axios';
import { DahuaError, DahuaEvents } from './dahua'

const PLUGIN_NAME = 'homebridge-dahua-alerts'
const PLATFORM_NAME = 'dahua-alerts';

export = (api: API) => {
	api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, DahuaMotionAlertsPlatform);
}

class DahuaMotionAlertsPlatform implements IndependentPlatformPlugin {
	private readonly log: Logging
	private readonly config: DahuaCameraConfig
	private cameras: Map<number, string>

	constructor(log: Logging, config: PlatformConfig) {
		this.log = log
		this.config = config as unknown as DahuaCameraConfig
		this.cameras = new Map()
		
		if(this.isInvalidConfig(this.config)) {
			this.log.error('Errors above, doing nothing')
			return
		} else {
			this.config.cameras.forEach((camera: CameraConfig) => {
				this.cameras.set(camera.index, camera.cameraName)
			})

			this.log.info("Cameras", this.cameras)

			let events: DahuaEvents = new DahuaEvents(this.config.host, this.config.user, this.config.pass);

			events.getEventEmitter().on(events.ALARM_EVENT_NAME, this.alertMotion)
			events.getEventEmitter().on(events.ERROR_EVENT_NAME, (data: DahuaError) => { 
				this.log.error(`${data.error} (for more info enable debug logging)`)
				this.log.debug(`${data.errorDetails}`)
			})
			events.getEventEmitter().on(events.DEBUG_EVENT_NAME, (data) => this.log.debug(data))
			events.getEventEmitter().on(events.RECONNECTING_EVENT_NAME, (data) => this.log.info(data))
		}
	}

	private alertMotion = (action: string, index: number) => {
		let cameraName = this.cameras.get(Number(index))
		if(cameraName) {
			if (action === 'Start') {
				this.log.debug('Video Motion Detected on', index, cameraName)
				axios.post(this.motionUrl(cameraName)).then(res => {
					this.log.info(`Motion for ${cameraName} posted to homebridge-camera-ffmpeg, received`, res.data)
				}).catch(err => {
					this.log.error('Error when posting video motion to homebridge-camera-ffmpeg, received', err.data)
				})
			}
			if (action === 'Stop')	{
				this.log.debug('Video Motion Ended on', index, cameraName)
				axios.post(this.resetMotionUrl(cameraName)).then(res => {
					this.log.info(`Reset motion for  ${cameraName} posted to homebridge-camera-ffmpeg, received`, res.data)
				}).catch(err => {
					this.log.error('Error when posting reset video motion to homebridge-camera-ffmpeg, received', err.data)
				})
			}
		}
	}

	private motionUrl = (cameraName: string): string => {
		return encodeURI(`http://localhost:${this.config.homebridgeCameraFfmpegHttpPort}/motion?${cameraName}`)
	}

	private resetMotionUrl = (cameraName: string): string => {
		return encodeURI(`http://localhost:${this.config.homebridgeCameraFfmpegHttpPort}/motion/reset?${cameraName}`)
	}

	private isInvalidConfig = (config: DahuaCameraConfig): boolean => {
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