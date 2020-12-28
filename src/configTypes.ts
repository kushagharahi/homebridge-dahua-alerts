export type DahuaCameraConfig = {
  host:                           string
  user:                           string
  pass:                           string
  homebridgeCameraFfmpegHttpPort: number
  cameras:                        Array<CameraConfig>
}
  
export type CameraConfig = {
  index:      number
  cameraName: string
  altHost:    string
  altUser:    string
  altPass:   string
}