import Axios, {AxiosBasicCredentials, AxiosResponse, AxiosError, AxiosRequestConfig} from 'axios'
import { Agent } from 'http'
import { EventEmitter } from 'events'

class DahuaEvents {
    //cgi-bin/eventManager.cgi?action=attach&codes=[AlarmLocal,VideoMotion,VideoLoss,VideoBlind] -- but we only care about VideoMotion
    private EVENTS_URI: string = '/cgi-bin/eventManager.cgi?action=attach&codes=[VideoMotion]'
    private HEADERS: any = {'Accept':'multipart/x-mixed-replace'}

    private eventEmitter: EventEmitter
    public ALARM_EVENT_NAME: string = 'alarm'
    public ERROR_EVENT_NAME: string = 'error'

    constructor(host: string, user: string, pass: string) {
        const auth: AxiosBasicCredentials = {
            username: user,
            password: pass
        }
        const keepAliveAgent: Agent = new Agent({
            keepAlive: true,
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
            responseType: 'stream'
        }

        this.eventEmitter = new EventEmitter()

        this.connect(axiosRequestConfig)
    }

    private connect = (axiosRequestConfig: AxiosRequestConfig) => {
        Axios.request(axiosRequestConfig).then((res: AxiosResponse) => {
            res.data.socket.on('data', (data: Buffer) => {
                this.parseEventData(data.toString())
            })
        }).catch((err: AxiosError) => {
            this.eventEmitter.emit(this.ERROR_EVENT_NAME, err)
            this.reconnect(axiosRequestConfig)
        }).then(() => {
            this.reconnect(axiosRequestConfig)
        }) 
    }

    private reconnect = (axiosRequestConfig: AxiosRequestConfig) => {
        //reconnect after 30s
        setTimeout(() => {
            this.connect(axiosRequestConfig)
        }, 30000)
    }

    private parseEventData = (data: string) => {
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
        this.eventEmitter.emit(this.ALARM_EVENT_NAME, action, index)
    }

    public getEventEmitter = (): EventEmitter => {
        return this.eventEmitter
    }
}

export {DahuaEvents}