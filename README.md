# homebridge-dahua-alerts

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins) [![npm version](https://badge.fury.io/js/homebridge-dahua-alerts.svg)](https://www.npmjs.com/package/homebridge-dahua-alerts) [![npm total downloads](https://img.shields.io/npm/dt/homebridge-dahua-alerts.svg)](https://www.npmjs.com/package/homebridge-dahua-alerts)


Routes motion alerts for Dahua and Lorex camera streams to homebridge-camera-ffmpeg 

-- Confirmed working with: Lorex: LHV1004 DHV & Dahua: DHI-HCVR4116HS-S3, DH-XVR5116HS-X, DH-IPC-HDBW4631R-S but lots of Dahua/Lorex NVRs and standalone cameras share this VideoMotion api.

## Installation
1. Install Homebridge using the [official instructions](https://github.com/homebridge/homebridge/wiki).
2. Install [`homebridge-camera-ffmpeg`](https://github.com/Sunoo/homebridge-camera-ffmpeg)
3. Configure your RTSP streams in `homebridge-camera-ffmpeg` and configure [`Http-based Automation`](https://sunoo.github.io/homebridge-camera-ffmpeg/automation/http.html) for the camera streams you want motion detection. Make sure to set `motionTimeout` to 0 and set HTTP Localhost Only to true.
4. Install [`homebridge-dahua-alerts`](https://www.npmjs.com/package/homebridge-dahua-alerts).
5. Configure your NVR and camera settings.

## Sample config.json

* Configuration for one NVR with multiple cameras

### homebridge-camera-ffmpeg
```
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

```
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
    "platform": "dahua-alerts",
    "host": "XX.XX.XX.XX",
    "user": "admin",
    "pass": "XX"
}
```

#### Override Camera Connection Credentials
This is useful if you have standalone IP Camera(s) (not going through an NVR), a mix of IP Cameras and NVR(s), or multiple NVRs.

To define a host/user/pass on a camera simply add the `cameraCredentials` object. If you have a top level host/user/pass defined, this object will override it. 
```
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

### Local development
- `npm run build` to get JS output in `dist`

## Credits
Referenced [nayrnet/node-dahua-api](https://github.com/nayrnet/node-dahua-api) for the Dahua/Lorex motion alerts API.
