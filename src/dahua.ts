import Axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from 'axios'
import { Agent as HttpsAgent, AgentOptions } from 'https'
import { Agent as HttpAgent } from 'http'
import { EventEmitter } from 'events'
import crypto from 'crypto'
import { Readable } from 'stream'

class DahuaEvents {
    //cgi-bin/eventManager.cgi?action=attach&codes=[AlarmLocal,VideoMotion,VideoLoss,VideoBlind] -- but we only care about VideoMotion
    private EVENTS_URI:             string = '/cgi-bin/eventManager.cgi?action=attach&codes=[VideoMotion]'
    
    private RECONNECT_INTERNAL_MS:  number = 10000

    private AGENT_SETTINGS: AgentOptions = {
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 1,
        maxFreeSockets: 1 //TODO: do we need a free socket?
    }

    private eventEmitter:           EventEmitter
     
    public ALARM_EVENT_NAME:        string = 'alarm'
    public DEBUG_EVENT_NAME:        string = 'alarm_payload'
    public ERROR_EVENT_NAME:        string = 'error'
    public DATA_EVENT_NAME:         string = 'data'
    public RECONNECTING_EVENT_NAME: string = 'reconnecting'

    private host:                   string
    private user:                   string
    private pass:                   string
    private requestConfig:          AxiosRequestConfig

    constructor(host: string, user: string, pass: string, useHttp: boolean) {
        this.host = host
        this.user = user
        this.pass = pass

        let keepAliveAgent: HttpAgent | HttpsAgent;
        if(useHttp) {
            keepAliveAgent = new HttpAgent({
                keepAlive: this.AGENT_SETTINGS.keepAlive,
                keepAliveMsecs: this.AGENT_SETTINGS.keepAliveMsecs,
                maxSockets: this.AGENT_SETTINGS.maxSockets,
                maxFreeSockets: this.AGENT_SETTINGS.maxFreeSockets,
            })
        } else {
            keepAliveAgent = new HttpsAgent({
                keepAlive: this.AGENT_SETTINGS.keepAlive,
                keepAliveMsecs: this.AGENT_SETTINGS.keepAliveMsecs,
                maxSockets: this.AGENT_SETTINGS.maxSockets,
                maxFreeSockets: this.AGENT_SETTINGS.maxFreeSockets,
                rejectUnauthorized: false,
                minVersion: "TLSv1"
            })
        }

        this.requestConfig = {
            url: `${useHttp ? 'http': 'https'}://${host}${this.EVENTS_URI}`,
            httpsAgent: keepAliveAgent, 
            httpAgent: keepAliveAgent,
            method: 'GET',
            responseType: 'stream',

        }

        this.eventEmitter = new EventEmitter()

        this.connect(0)
    }

    private connect = (count: number, authHeader?: string) => {
        Axios.request({
            ...this.requestConfig, 
            headers: {
                'accept': 'multipart/x-mixed-replace',
                'authorization': authHeader ?
                    authHeader :
                    // basic auth
                    Buffer.from(`${this.user}:${this.pass}`).toString('base64')
            }
        }).then((res: AxiosResponse) => {

            let stream: Readable = res.data
            this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Successfully connected and listening to host: ${this.host}`)

            this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Connection response received for host: ${this.host} ${JSON.stringify(res.headers)} ${JSON.stringify(res.statusText)} ${JSON.stringify(res.status)}`)
            
            stream.on(this.DATA_EVENT_NAME, (data: Buffer) => {
                this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Response recieved on host: ${this.host}: ${data.toString()}`)
                let event = this.parseEventData(data.toString())
                this.eventEmitter.emit(this.ALARM_EVENT_NAME, {action: event.action, index: event.index, host: this.host} as DahuaAlarm)
            })

            stream.on('close', () => {
                this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Socket connection closed for host: ${this.host}`)
            })
            
            stream.on('error', (data: Buffer) => {
                this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Socket connection errored on host: ${this.host}, error received: ${data.toString()}`)
                this.reconnect(this.RECONNECT_INTERNAL_MS)
            })
           
            stream.on('end', () => {
                this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `Socket connection ended on host: ${this.host}`)
                this.reconnect(this.RECONNECT_INTERNAL_MS)
            })
           
   
        }).catch((err: AxiosError) => {
            let error: DahuaError = {
                                        error: `Error received from host: ${this.host}`, 
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
                
                        const md5 = (str: string) => crypto.createHash('md5').update(str).digest('hex')
                
                        const HA1 = md5(`${this.user}:${realm}:${this.pass}`)
                        const HA2 = md5(`GET:${this.EVENTS_URI}`)
                        const response = md5(`${HA1}:${nonce}:${nonceCount}:${cnonce}:auth:${HA2}`)
                
                        const authHeader = `Digest username="${this.user}",realm="${realm}",` +
                        `nonce="${nonce}",uri="${this.EVENTS_URI}",qop="auth",algorithm="MD5",` +
                        `response="${response}",nc="${nonceCount}",cnonce="${cnonce}"`
                        
                        this.eventEmitter.emit(this.DEBUG_EVENT_NAME, `401 received and www-authenticate headers, sending digest auth. Count: ${count}`)
                        this.connect(count, authHeader)
                        return
                    } catch (e) {
                        error.errorDetails = `${error.errorDetails} Error when building digest auth headers, please open an issue with this log: \n ${e}`
                    }
                } else {
                    error.errorDetails = `${error.errorDetails} Status Code: ${err.response.status} Response: ${err.response.statusText}`
                }
            // client never received a response, or request never left
            } else if(err.request) {
                error.errorDetails = `${error.errorDetails} Didn't get a response from the NVR - ${err.message}`
            } else {
                error.errorDetails = `${error.errorDetails} ${err.message}`
            }

            this.eventEmitter.emit(this.ERROR_EVENT_NAME, error)
            this.reconnect(this.RECONNECT_INTERNAL_MS)
        })
    }

    
    private reconnect = (reconnection_interval_ms: number) => {
        //reconnect after 30s
        this.eventEmitter.emit(this.RECONNECTING_EVENT_NAME, `Will attempt reconnecting to ${this.host} in ${reconnection_interval_ms/1000}s.`)
        setTimeout(() => {
            this.eventEmitter.emit(this.RECONNECTING_EVENT_NAME, `Reconnecting to ${this.host}`)
            this.connect(0)
        }, reconnection_interval_ms)
    }

    private parseEventData = (data: string) : {action: string, index: string} => {
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
        try {
            let eventSplitByLine = data.split('\n')
            eventSplitByLine.forEach(event => {
                if(event.includes(';')) {
                    let alarm = event.split(';')
                    action = alarm[1].substr(7)
                    index = alarm[2].substr(6)
                }
            })
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

type DahuaAlarm = {
    action:       string
    index:        string
    host:         string
}

export { DahuaEvents, DahuaAlarm, DahuaError }