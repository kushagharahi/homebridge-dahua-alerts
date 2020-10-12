import Axios, {AxiosBasicCredentials, AxiosResponse, AxiosError, AxiosRequestConfig} from 'axios'
import { Agent } from 'http'
import { EventEmitter } from 'events'

class DahuaEvents {
    //cgi-bin/eventManager.cgi?action=attach&codes=[AlarmLocal,VideoMotion,VideoLoss,VideoBlind] -- but we only care about VideoMotion
    private EVENTS_URI: string = '/cgi-bin/eventManager.cgi?action=attach&codes=[VideoMotion]'
    private HEADERS: any = {'Accept':'multipart/x-mixed-replace'}

    private eventEmitter: EventEmitter
    public ALARM_EVENT_NAME:        string = 'alarm'
    public ERROR_EVENT_NAME:        string = 'error'
    public CLOSE_EVENT_NAME:        string = 'close'
    public DATA_EVENT_NAME:         string = 'data'
    public RECONNECTING_EVENT_NAME:  string = 'reconnecting'

    constructor(host: string, user: string, pass: string) {
        const auth: AxiosBasicCredentials = {
            username: user,
            password: pass
        }
        const keepAliveAgent: Agent = new Agent({
            keepAlive: true,
            keepAliveMsecs: 1000,
            maxSockets: 1,
            maxFreeSockets: 0,
            timeout: 30000 //30s
        })

        const axiosRequestConfig: AxiosRequestConfig ={
            url: `http://${host}${this.EVENTS_URI}`,
            httpAgent: keepAliveAgent, 
            auth: auth,
            headers: this.HEADERS,
            method: 'GET',
            responseType: 'stream',
            timeout: 30000
        }

        this.eventEmitter = new EventEmitter()

        this.connect(axiosRequestConfig)
    }

    private connect = (axiosRequestConfig: AxiosRequestConfig) => {
        Axios.request(axiosRequestConfig).then((res: AxiosResponse) => {
            res.data.socket.on(this.DATA_EVENT_NAME, (data: Buffer) => {
                let event = this.parseEventData(data.toString())
                this.eventEmitter.emit(this.ALARM_EVENT_NAME, event.action, event.index)
            })

            res.data.socket.on(this.CLOSE_EVENT_NAME, (close: Buffer) => {
                this.eventEmitter.emit(this.CLOSE_EVENT_NAME, "Socket connection timed out or closed by NVR.")
                this.reconnect(axiosRequestConfig, 1000)
            })
        }).catch((err: AxiosError) => {
            this.eventEmitter.emit(this.ERROR_EVENT_NAME, "Error Received, reconnecting in 10s ", err)
            this.reconnect(axiosRequestConfig, 10000)
        })
    }

    
    private reconnect = (axiosRequestConfig: AxiosRequestConfig, reconnection_interval_ms: number) => {
        //reconnect after 30s
        this.eventEmitter.emit(this.RECONNECTING_EVENT_NAME, `Reconnecting in ${reconnection_interval_ms/1000}s.`)
        setTimeout(() => {
            this.connect(axiosRequestConfig)
        }, reconnection_interval_ms)
    }

    private parseEventData = (data: string) : {action: string, index: string} => {
        /** Sample data:
         
            myboundary
            Content-Type: text/plain
            Content-Length:36
            Code=VideoMotion;action=Stop;index=0
         */
        let res = data.split('\n')
        let alarm = res[3].split(';')
        let action = alarm[1].substr(7)
        let index = alarm[2].substr(6)
        return { action : action, index : index };
    }

    public getEventEmitter = (): EventEmitter => {
        return this.eventEmitter
    }
}

export {DahuaEvents}