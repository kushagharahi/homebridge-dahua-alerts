import Axios, {AxiosBasicCredentials, AxiosResponse, AxiosError, AxiosRequestConfig} from 'axios'
import { Agent } from 'https'
import { EventEmitter } from 'events'
import crypto from 'crypto'
import tls from 'tls'

tls.DEFAULT_MIN_VERSION = 'TLSv1';
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

class DahuaEvents {
    //cgi-bin/eventManager.cgi?action=attach&codes=[AlarmLocal,VideoMotion,VideoLoss,VideoBlind] -- but we only care about VideoMotion
    private EVENTS_URI:             string = '/cgi-bin/eventManager.cgi?action=attach&codes=[VideoMotion]'
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
            timeout: 30000, //30s
            rejectUnauthorized: false
        })

        const axiosRequestConfig: AxiosRequestConfig ={
            url: `https://${host}${this.EVENTS_URI}`,
            httpAgent: keepAliveAgent, 
            auth: auth,
            headers: this.HEADERS,
            method: 'GET',
            responseType: 'stream',
            timeout: 30000
        }

        this.eventEmitter = new EventEmitter()

        this.connect(axiosRequestConfig, 0)
    }

    private connect = (axiosRequestConfig: AxiosRequestConfig, count: number) => {
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
                                     errorDetails: "Error Details:"
                                    }

            // Request made and server responded with response
            if(err.response) {
                if(err.response.status === 401) {
                    if(err.response.headers['www-authenticate']) {
                        //digest auth, build digest auth header
                        const authDetails = err.response.headers['www-authenticate'].split(', ').map(v => v.split('='))

                        ++count
                        const nonceCount = ('00000000' + count).slice(-8)
                        const cnonce = crypto.randomBytes(24).toString('hex')
                
                        const realm = authDetails[0][1].replace(/"/g, '')
                        const nonce = authDetails[2][1].replace(/"/g, '')
                
                        const md5 = str => crypto.createHash('md5').update(str).digest('hex')
                
                        const HA1 = md5(`${axiosRequestConfig.auth?.username}:${realm}:${axiosRequestConfig.auth?.password}`)
                        const HA2 = md5(`GET:${this.EVENTS_URI}`);
                        const response = md5(`${HA1}:${nonce}:${nonceCount}:${cnonce}:auth:${HA2}`)
                
                        this.HEADERS['authorization'] = `Digest username="${axiosRequestConfig.auth?.username}",realm="${realm}",` +
                        `nonce="${nonce}",uri="${this.EVENTS_URI}",qop="auth",algorithm="MD5",` +
                        `response="${response}",nc="${nonceCount}",cnonce="${cnonce}"`
                        
                        axiosRequestConfig.headers = this.HEADERS

                        this.connect(axiosRequestConfig, count)
                        return
                    }
                }
                error.errorDetails = `${error.errorDetails} Status Code: ${err.response.status} Response: ${err.response.data.statusMessage}`
            // as able to make a request, but for some reason, it didn't see a response
            } else if(err.request) {
                error.errorDetails = `${error.errorDetails} Didn't get a response from the NVR - ${err.message}`
            } else {
                error.errorDetails = `${error.errorDetails} ${err.message}`
            }

            this.eventEmitter.emit(this.ERROR_EVENT_NAME, error)
            this.reconnect(axiosRequestConfig, this.RECONNECT_INTERNAL_MS)
        })
    }

    
    private reconnect = (axiosRequestConfig: AxiosRequestConfig, reconnection_interval_ms: number) => {
        //reconnect after 30s
        this.eventEmitter.emit(this.RECONNECTING_EVENT_NAME, `Reconnecting in ${reconnection_interval_ms/1000}s.`)
        setTimeout(() => {
            this.connect(axiosRequestConfig, 0)
        }, reconnection_interval_ms)
    }

    private parseEventData = (data: string) : {action: string, index: string} => {
        /** Sample data:
         
            myboundary
            Content-Type: text/plain
            Content-Length:36
            Code=VideoMotion;action=Stop;index=0
         */
        let action = ""
        let index = ""
        try {
                let res = data.split('\n')
                let alarm = res[3].split(';')
                action = alarm[1].substr(7)
                index = alarm[2].substr(6)
        } catch (e) {
            this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Could not parse event data: ${data}`)
        }
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