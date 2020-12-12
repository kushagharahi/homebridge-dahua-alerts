import Axios, {AxiosBasicCredentials, AxiosResponse, AxiosError, AxiosRequestConfig} from 'axios'
import { Agent } from 'http'
import { EventEmitter } from 'events'

class DahuaEvents {
    //cgi-bin/eventManager.cgi?action=attach&codes=[AlarmLocal,VideoMotion,VideoLoss,VideoBlind] -- but we only care about VideoMotion
    private EVENTS_URI:             string = '/cgi-bin/eventManager.cgi?action=attach&codes=VideoMotion'
    private HEADERS:                any = {'Accept':'multipart/x-mixed-replace'}
    private SOCKET_CLOSE:           string = 'close'
    private RECONNECT_INTERNAL_MS:  number = 10000

    private eventEmitter:           EventEmitter
     
    public ALARM_EVENT_NAME:        string = 'alarm'
    public DEBUG_EVENT_NAME:        string = 'alarm_payload'
    public ERROR_EVENT_NAME:        string = 'error'
    public DATA_EVENT_NAME:         string = 'data'
    public RECONNECTING_EVENT_NAME: string = 'reconnecting'


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
                this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Response recieved: ${data.toString()}`)
                let event = this.parseEventData(data.toString())
                this.eventEmitter.emit(this.ALARM_EVENT_NAME, event.action, event.index)
            })

            res.data.socket.on(this.SOCKET_CLOSE, (close: Buffer) => {
                this.eventEmitter.emit(this.DEBUG_EVENT_NAME, "Socket connection timed out or closed by NVR.")
                this.reconnect(axiosRequestConfig, 1000)
            })
        }).catch((err: AxiosError) => {
            let error: DahuaError = {
                                     error: `Error Received`, 
                                     errorDetails: `Error Details: ${JSON.stringify({"status code": err.code, "server response?": err.response, "error message":err.message}, null, "  ")}`
                                    }
            this.eventEmitter.emit(this.ERROR_EVENT_NAME,  error)
            this.reconnect(axiosRequestConfig, this.RECONNECT_INTERNAL_MS)
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

            or

            {
                topic: "VideoMotion/7/Start",
                payload: "Start",
                index: "7"
                code: "VideoMotion",
                _msgid: "e2a19ebd.fe23f2"
            }
         */

        if(data.startsWith("{", 0)) {
            let alarm = JSON.parse(data)
            if(alarm.action && alarm.index) {
                return { action: alarm.action, index: alarm.index }
            }
        }
        
        let res = data.split('\n')
        let alarm = res[3].split(';')
        let action = alarm[1].substr(7)
        let index = alarm[2].substr(6)
        return { action: action, index: index }
    }

    public getEventEmitter = (): EventEmitter => {
        return this.eventEmitter
    }
}

type DahuaError = {
    error:        string
    errorDetails: string
}

export { DahuaEvents, DahuaError }