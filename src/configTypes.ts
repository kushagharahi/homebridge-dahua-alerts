export type DahuaCameraConfig = {
  host:                           string
  user:                           string
  pass:                           string
  homebridgeCameraFfmpegHttpPort: number
  useHttp:                        boolean
  cameras:                        Array<CameraConfig>
}
  
export type CameraConfig = {
  index:                          number
  cameraName:                     string
  triggerEventTypes:              Array<string>
  cameraCredentials:              CameraCredentials
}

export type CameraCredentials = {
  host:                           string
  user:                           string
  pass:                           string
  useHttp:                        boolean
}