import Axios, {AxiosBasicCredentials, AxiosResponse, AxiosError, AxiosRequestConfig} from 'axios'
import { Agent as HttpsAgent } from 'https'
import { Agent as HttpAgent } from 'http'
import { EventEmitter } from 'events'
import crypto from 'crypto'
import tls from 'tls'

tls.DEFAULT_MIN_VERSION = 'TLSv1'
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

class DahuaEvents {
    private HEADERS:                any = {'Accept':'multipart/x-mixed-replace'}
    
    private SOCKET_CLOSE:           string = 'close'
    private RECONNECT_INTERNAL_MS:  number = 10000

    private AGENT_SETTINGS = {
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 1,
        maxFreeSockets: 0,
        timeout: 1200000, //20min = 1200s
        rejectUnauthorized: false
    }
     
    public ALARM_EVENT_NAME:        string = 'alarm'
    public DEBUG_EVENT_NAME:        string = 'alarm_payload'
    public ERROR_EVENT_NAME:        string = 'error'
    public DATA_EVENT_NAME:         string = 'data'
    public RECONNECTING_EVENT_NAME: string = 'reconnecting'

    private eventEmitter:           EventEmitter
    private host:                   string
    private eventsWatchUri:         string

    constructor(host: string, user: string, pass: string, useHttp: boolean, events: Set<string>) {
        this.host = host;
        //cgi-bin/eventManager.cgi?action=attach&codes=[AlarmLocal,VideoMotion,VideoLoss,VideoBlind]
        //See more https://github.com/SaWey/home-assistant-dahua-event
        this.eventsWatchUri = `/cgi-bin/eventManager.cgi?action=attach&codes=[${Array.from(events).join(",")}]`;
        this.eventEmitter = new EventEmitter()

        const auth: AxiosBasicCredentials = {
            username: user,
            password: pass
        }

        let keepAliveAgent;

        if(useHttp) {
            keepAliveAgent = new HttpAgent({
                keepAlive: this.AGENT_SETTINGS.keepAlive,
                keepAliveMsecs: this.AGENT_SETTINGS.keepAliveMsecs,
                maxSockets: this.AGENT_SETTINGS.maxSockets,
                maxFreeSockets: this.AGENT_SETTINGS.maxFreeSockets,
                timeout: this.AGENT_SETTINGS.timeout,
            }) 
        } else {
            keepAliveAgent = new HttpsAgent({
                keepAlive: this.AGENT_SETTINGS.keepAlive,
                keepAliveMsecs: this.AGENT_SETTINGS.keepAliveMsecs,
                maxSockets: this.AGENT_SETTINGS.maxSockets,
                maxFreeSockets: this.AGENT_SETTINGS.maxFreeSockets,
                timeout: this.AGENT_SETTINGS.timeout,
                rejectUnauthorized: this.AGENT_SETTINGS.rejectUnauthorized
            })
        }
        

        let useSSL = useHttp ? 'http': 'https'
        const axiosRequestConfig: AxiosRequestConfig ={
            url: `${useSSL}://${host}${this.eventsWatchUri}`,
            httpAgent: keepAliveAgent, 
            auth: auth,
            headers: this.HEADERS,
            method: 'GET',
            responseType: 'stream',
            timeout: 1200000 // 20min
        }

        this.connect(axiosRequestConfig, 0)
    }

    private connect = (axiosRequestConfig: AxiosRequestConfig, count: number) => {
        Axios.request(axiosRequestConfig).then((res: AxiosResponse) => {
            res.data.socket.on(this.DATA_EVENT_NAME, (data: Buffer) => {
                this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Response recieved: ${data.toString()}`)
                let event = this.parseEventData(data.toString())
                this.eventEmitter.emit(this.ALARM_EVENT_NAME, 
                    {action: event.action, index: event.index, eventType: event.eventType, host: this.host} as DahuaAlarm)
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
                if(err.response.status === 401 && err.response.headers['www-authenticate']) {
                    try {
                        /* digest auth, build digest auth header
                         * The two examples I've seen from these cameras are:
                         * Digest realm="Login to ND021811019863",qop="auth",nonce="211955164",opaque="9a206a55e922ee7900769ec61ae49bf0c1f30242"
                         * or: 
                         * Digest realm="Login to ND021811019863", qop="auth", nonce="211955164", opaque="9a206a55e922ee7900769ec61ae49bf0c1f30242"
                         * The split() regex splits on the commas eliminating any potential white-spaces before and after the comma (s*)
                         */
                        const authDetails = err.response.headers['www-authenticate'].split(/\s*,\s*/).map(v => v.split('='))
                        
                        ++count
                        const nonceCount = ('00000000' + count).slice(-8)
                        const cnonce = crypto.randomBytes(24).toString('hex')
                
                        const realm = authDetails[0][1].replace(/"/g, '')
                        const nonce = authDetails[2][1].replace(/"/g, '')
                
                        const md5 = str => crypto.createHash('md5').update(str).digest('hex')
                
                        const HA1 = md5(`${axiosRequestConfig.auth?.username}:${realm}:${axiosRequestConfig.auth?.password}`)
                        const HA2 = md5(`GET:${this.eventsWatchUri}`);
                        const response = md5(`${HA1}:${nonce}:${nonceCount}:${cnonce}:auth:${HA2}`)
                
                        this.HEADERS['authorization'] = `Digest username="${axiosRequestConfig.auth?.username}",realm="${realm}",` +
                        `nonce="${nonce}",uri="${this.eventsWatchUri}",qop="auth",algorithm="MD5",` +
                        `response="${response}",nc="${nonceCount}",cnonce="${cnonce}"`
                        
                        axiosRequestConfig.headers = this.HEADERS

                        this.connect(axiosRequestConfig, count)
                        return
                    } catch (e) {
                        error.errorDetails = `${error.errorDetails} Error when building digest auth headers, please open an issue with this log: \n ${e}`
                    }
                } else {
                    error.errorDetails = `${error.errorDetails} Uri: ${err.config.url} Status Code: ${err.response.status} Response: ${err.response.data.statusMessage}`
                }
            // client never received a response, or request never left
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

    private parseEventData = (data: string) : {action: string, index: string, eventType: string} => {
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
        let action = ""
        let index = ""
        let eventType = ""
        try {
            let eventSplitByLine = data.split('\n')
            eventSplitByLine.forEach(event => {
                if(event.includes(';')) {
                    let alarm = event.split(';')
                    eventType = alarm[0].substr(5)
                    action = alarm[1].substr(7)
                    index = alarm[2].substr(6)
                }
            })
        } catch (e) {
            this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Could not parse event data: ${data}`)
        }
        return { action: action, index: index, eventType: eventType }
    }

    public getEventEmitter = (): EventEmitter => {
        return this.eventEmitter
    }
}

type DahuaError = {
    error:        string
    errorDetails: string
}

type DahuaAlarm = {
    eventType:    string
    action:       string
    index:        string
    host:         string
}

export { DahuaEvents, DahuaAlarm, DahuaError }