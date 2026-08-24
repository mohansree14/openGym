// pose-detection statically imports @mediapipe/pose for its BlazePose "mediapipe" runtime,
// which we don't use (FormTracker only loads the MoveNet runtime) and whose package doesn't
// expose an ESM-compatible named export for bundlers. Aliased in vite.config.js so the build
// doesn't need the real (much larger) package.
export class Pose {}
