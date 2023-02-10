# homebridge-dahua-alerts

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins) [![npm version](https://badge.fury.io/js/homebridge-dahua-alerts.svg)](https://www.npmjs.com/package/homebridge-dahua-alerts) [![npm total downloads](https://img.shields.io/npm/dt/homebridge-dahua-alerts.svg)](https://www.npmjs.com/package/homebridge-dahua-alerts)

Routes motion alerts for Dahua, Alhua, Amcrest and Lorex camera streams to homebridge-camera-ffmpeg

Like this plugin? -> [Buy me a ☕coffee☕](https://www.buymeacoffee.com/kusha)


### This plugin **only** supports **VideoMotion** alerts, not any SmartMotion detection. You must disable those features in order for this plugin to work correctly. [Please check issue #15 if you have compatible hardware and would like to contribute SmartMotion dectection](https://github.com/kushagharahi/homebridge-dahua-alerts/issues/15)

---
Confirmed working with: 
| Dahua DVR | Dahua/Amcrest Standalone Camera | Lorex DVR |
| - | - | - |
| - | IP3M-943B | - |
| - | IP5M-B1186EB | - |
| - | DH-IPC-HDW3641TMP | - |
|  NVR4208-8P | - | - |
| - | -| LHV1004 DHV |
| DHI-HCVR4116HS-S3 | - | - |
| DH-XVR5116HS-X | - | - | 
| - | DH-IPC-HDBW4631R-S | - | 
| DHI-NVR4104HS-P-4Ks2 | - | - |
| - | - | NR818 |
| - | N43AJ52-B | - |

but lots of Dahua/Lorex NVRs and standalone cameras share this VideoMotion api.


## Installation
1. Install Homebridge using the [official instructions](https://github.com/homebridge/homebridge/wiki).
2. Install [`homebridge-camera-ffmpeg`](https://github.com/Sunoo/homebridge-camera-ffmpeg)
3. Configure your RTSP streams in `homebridge-camera-ffmpeg`
   1. Configure `"porthttp": 8088` for `Http-based Automation`](https://sunoo.github.io/homebridge-camera-ffmpeg/automation/http.html)
   2. Configure `"motion": true` for the camera streams you want motion detection
   3. Configure `"motionTimeout": 0` to disable automatically resetting the motion after 1 second default
   4. (Optional) Configure `"localhttp": true` to ensure HTTP automations only work from same device (for enhanced security)
4. Install [`homebridge-dahua-alerts`](https://www.npmjs.com/package/homebridge-dahua-alerts).
5. Configure your NVR and camera settings.
    - Ensure you have enabled `https` or port 443 on your device if you're getting `ECONNREFUSED` in the debug logs. Not required by all.

## Sample config.json

* Configuration for one NVR with multiple cameras

### homebridge-camera-ffmpeg
```javascript
{
    "name": "Camera FFmpeg",
    "porthttp": 8088,
    "localhttp": true,
    "cameras": [
        {
            "name": "Driveway",
            "motion": true,
            "motionTimeout": 0,
            "videoConfig": {
                "source": "-i rtsp://admin:<snip>@192.168.1.XX:554/cam/realmonitor?channel=1&subtype=1"
            }
        },
        {
            "name": "Porch",
            "motion": true,
            "motionTimeout": 0,
            "videoConfig": {
                "source": "-i rtsp://admin:<snip>@192.168.1.XX:554/cam/realmonitor?channel=2&subtype=1"
            }
        },
        {
            "name": "Backdoor",
            "motion": true,
            "motionTimeout": 0,
            "videoConfig": {
                "source": "-i rtsp://admin:<snip>@192.168.1.XX:554/cam/realmonitor?channel=4&subtype=1"
            }
        }
    ],
    "platform": "Camera-ffmpeg"
}
```

### homebridge-dahua-alerts

```javascript
{
    "cameras": [
        {
            "index": 0,
            "cameraName": "Driveway"
        },
        {
            "index": 1,
            "cameraName": "Porch"
        },
        {
            "index": 3,
            "cameraName": "Backdoor"
        }
    ],
    "homebridgeCameraFfmpegHttpPort": 8088,
    "host": "XX.XX.XX.XX",
    "user": "admin",
    "pass": "XX",
    "platform": "dahua-alerts"
}
```
- `homebridgeCameraFfmpegHttpPort` must match the `porthttp` config in the `homebridge-camera-ffmpeg` config
- `host` is the IP of the NVR or camera
- `user` is username of the NVR or camera
- `pass` is the password of the NVR or camera
- `useHttp` (optional) use HTTP instead of HTTPS to connect to host

For each camera you want to monitor, add a new entry to the `cameras` array.
- `index` if the camera's channel number substracted by 1 (the index starts from 0, the camera channel starts from 1)
- `cameraName` must match the `name` of the camera specified in the `homebridge-camera-ffmpeg` config

#### Override Camera Connection Credentials
This is useful if you have standalone IP Camera(s) (not going through an NVR), a mix of IP Cameras and NVR(s), or multiple NVRs.

To define a host/user/pass on a camera simply add the `cameraCredentials` object. If you have a top level host/user/pass defined, this object will override it. 
```javascript
    "cameras": [
        {
            "index": 0,
            "cameraName": "Driveway"
            "cameraCredentials": {
                    "host": "XX.XX.XX.XX",
                    "user": "admin",
                    "pass": "XX"
            }
        },
```

* If using a standalone camera, the index will always be `0`

### Local development
- `npm run build` to get JS output in `dist`
- `npm test` to run Jest tests

## Credits
Referenced [nayrnet/node-dahua-api](https://github.com/nayrnet/node-dahua-api) for the Dahua/Lorex motion alerts API.
