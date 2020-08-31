# homebridge-dahua-alerts

[![npm version](https://badge.fury.io/js/homebridge-dahua-alerts.svg)](https://badge.fury.io/js/homebridge-dahua-alerts)


Routes motion alerts for Dahua and Lorex camera streams to homebridge-camera-ffmpeg 

## Installation
1. Install Homebridge using the [official instructions](https://github.com/homebridge/homebridge/wiki).
2. Install [`homebridge-camera-ffmpeg`](https://github.com/Sunoo/homebridge-camera-ffmpeg)
3. Configure your RTSP streams in `homebridge-camera-ffmpeg` and configure [`Http-based Automation`](https://sunoo.github.io/homebridge-camera-ffmpeg/automation/http.html) for the camera streams you want motion detection. Make sure to set `motionTimeout` to 0 and set HTTP Localhost Only to true.
4. Install [`homebridge-dahua-alerts`](https://www.npmjs.com/package/homebridge-dahua-alerts).
5. Configure your NVR and camera settings.

## Sample config.json

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
    "host": "192.168.1.XX",
    "user": "admin",
    "pass": "<snip>",
    "homebridgeCameraFfmpegHttpPort": 8088,
    "platform": "dahua-alerts"
}
```


### Local development
- `npm run build` to get JS output in `dist`

## Credits
Referenced [nayrnet/node-dahua-api](https://github.com/nayrnet/node-dahua-api) for the Dahua/Lorex motion alerts API.
