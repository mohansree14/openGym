import { useEffect, useRef, useState } from 'react'
import * as tf from '@tensorflow/tfjs'
import * as poseDetection from '@tensorflow-models/pose-detection'
import { t } from '../lib/i18n.js'

// Bone pairs for MoveNet's 17-keypoint layout — only the ones useful for checking
// lifting form (arms, torso, legs); face points are detected but not drawn.
const EDGES = [
  ['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
]
const MIN_SCORE = 0.3

// Live skeleton overlay on the front camera — issue #17's MVP: prove the pose-detection
// pipeline works end to end before adding any rep-counting or form-correction logic.
// Everything runs on-device (tfjs + MoveNet); the video frame never leaves the browser.
export default function FormTracker() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | denied | error

  useEffect(() => {
    let stream, detector, raf, stopped = false
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        if (stopped) return
        const v = videoRef.current
        v.srcObject = stream
        await v.play()
        await tf.ready()
        detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        })
        if (stopped) return
        setStatus('ready')

        const draw = async () => {
          if (stopped) return
          const c = canvasRef.current
          if (v.readyState >= 2) {
            if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight }
            const poses = await detector.estimatePoses(v)
            const kp = poses[0]?.keypoints || []
            const byName = Object.fromEntries(kp.map(p => [p.name, p]))
            const ctx = c.getContext('2d')
            ctx.clearRect(0, 0, c.width, c.height)
            ctx.strokeStyle = '#5eead4'
            ctx.lineWidth = Math.max(2, c.width / 160)
            for (const [a, b] of EDGES) {
              const pa = byName[a], pb = byName[b]
              if (pa && pb && pa.score > MIN_SCORE && pb.score > MIN_SCORE) {
                ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke()
              }
            }
            ctx.fillStyle = '#facc15'
            const r = Math.max(3, c.width / 120)
            for (const p of kp) if (p.score > MIN_SCORE) { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill() }
          }
          raf = requestAnimationFrame(draw)
        }
        draw()
      } catch (e) {
        setStatus(e && e.name === 'NotAllowedError' ? 'denied' : 'error')
      }
    })()
    return () => {
      stopped = true
      if (raf) cancelAnimationFrame(raf)
      stream?.getTracks().forEach(tr => tr.stop())
      detector?.dispose()
    }
  }, [])

  return <>
    <h3>{t('Form check')}</h3>
    {status === 'denied' && <div className="muted">{t('Camera access was denied — allow it in your browser settings to see your form.')}</div>}
    {status === 'error' && <div className="muted">{t('Could not start the camera on this device.')}</div>}
    {status !== 'denied' && status !== 'error' && <div style={{ position: 'relative', marginTop: 8 }}>
      <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: 12, display: 'block', transform: 'scaleX(-1)' }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }} />
      {status === 'loading' && <div className="muted" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t('Starting camera…')}</div>}
    </div>}
    <div className="muted small" style={{ marginTop: 10 }}>{t('Skeleton overlay only, for now — nothing is recorded or uploaded.')}</div>
  </>
}
