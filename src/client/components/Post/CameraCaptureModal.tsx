import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, SwitchCamera } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  /** Masque le bascule Photo/Vidéo — utile quand seule une photo a un sens (ex: photo produit). */
  photoOnly?: boolean;
}

const VIDEO_MIME_CANDIDATES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

function pickSupportedMimeType(): string {
  return VIDEO_MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export function CameraCaptureModal({ open, onClose, onCapture, photoOnly }: Props) {
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [recording, setRecording] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState('');
  const [recordSeconds, setRecordSeconds] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');

    function requestStream(retriesLeft = 2) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: facing }, audio: true })
        .then((stream) => {
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch((err) => {
          if (cancelled) return;
          const name = err instanceof DOMException ? err.name : '';
          // NotReadableError/TrackStartError sont très souvent transitoires (double-montage
          // StrictMode, ou libération tardive du handle caméra côté OS après un autre onglet/app)
          // — un court retry silencieux résout la grande majorité des cas.
          if ((name === 'NotReadableError' || name === 'TrackStartError') && retriesLeft > 0) {
            setTimeout(() => { if (!cancelled) requestStream(retriesLeft - 1); }, 500);
            return;
          }
          const messages: Record<string, string> = {
            NotAllowedError: "Accès à la caméra/micro refusé — autorise-les pour ce site puis réessaie.",
            NotFoundError: "Aucune caméra ou aucun micro détecté sur cet appareil.",
            NotReadableError: "Ta caméra ou ton micro est déjà utilisé par une autre application (Zoom, Teams, un autre onglet...). Ferme-la puis réessaie.",
            TrackStartError: "Ta caméra ou ton micro est déjà utilisé par une autre application (Zoom, Teams, un autre onglet...). Ferme-la puis réessaie.",
          };
          setError(messages[name] || "Impossible d'accéder à la caméra et au micro — vérifie les autorisations du navigateur.");
        });
    }

    // Reporte l'appel getUserMedia d'un tick : le double-montage StrictMode (mount -> cleanup ->
    // remount) est entierement synchrone, donc le cleanup du premier montage "jetable" annule ce
    // timeout avant qu'il ne se declenche — une seule requete camera part reellement par ouverture,
    // au lieu de deux requetes concurrentes qui se disputent le meme peripherique (NotReadableError).
    const kickoffId = setTimeout(() => { if (!cancelled) requestStream(); }, 0);

    return () => {
      cancelled = true;
      clearTimeout(kickoffId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, facing]);

  useEffect(() => {
    if (!recording) {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordSeconds(0);
      return;
    }
    timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stopStream();
      onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      onClose();
    }, 'image/jpeg', 0.92);
  }

  function startRecording() {
    if (!streamRef.current) return;
    const mimeType = pickSupportedMimeType();
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      stopStream();
      onCapture(new File([blob], `video-${Date.now()}.${ext}`, { type: blob.type }));
      onClose();
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function handleMainAction() {
    if (mode === 'photo') takePhoto();
    else if (recording) stopRecording();
    else startRecording();
  }

  function handleClose() {
    if (recording) mediaRecorderRef.current?.stop();
    stopStream();
    onClose();
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-4 shrink-0">
        <button onClick={handleClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <X size={18} className="text-white" />
        </button>
        {recording && (
          <div className="flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white text-xs font-bold tabular-nums">
              {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}
            </span>
          </div>
        )}
        <button
          onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
          disabled={recording}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30"
        >
          <SwitchCamera size={18} className="text-white" />
        </button>
      </div>

      {/* Preview */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
          <p className="text-white/60 text-sm px-8 text-center">{error}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        )}
      </div>

      {/* Bottom controls */}
      <div className="shrink-0 pb-8 pt-4 flex flex-col items-center gap-4">
        {!photoOnly && (
          <div className="relative flex bg-white/10 rounded-full p-1 w-40">
            <div
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm transition-transform duration-300 ease-out"
              style={{ transform: mode === 'video' ? 'translateX(calc(100% + 4px))' : 'translateX(0)' }}
            />
            {(['photo', 'video'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => !recording && setMode(m)}
                className={`relative z-10 flex-1 py-1.5 rounded-full text-xs font-semibold transition-colors duration-300 ${
                  mode === m ? 'text-black' : 'text-white/60'
                }`}
              >
                {m === 'photo' ? 'Photo' : 'Vidéo'}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleMainAction}
          disabled={!!error}
          className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-30"
        >
          <span
            className={`transition-all bg-red-500 ${
              mode === 'video' && recording ? 'w-6 h-6 rounded-md' : 'w-12 h-12 rounded-full'
            }`}
          />
        </button>
      </div>
    </div>,
    document.body,
  );
}
