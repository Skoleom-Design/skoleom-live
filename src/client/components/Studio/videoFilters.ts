// Filtres video temps reel pour le Studio (createur uniquement) — traite le flux camera brut via
// un <canvas> avant publication LiveKit, donc les spectateurs voient le filtre aussi (pas juste un
// gadget local). Le pipeline tourne toujours (boucle requestAnimationFrame) des que start() est
// appele ; setConfig() change juste ce qui est dessine a chaque frame, sans jamais interrompre le
// flux de sortie (changer de filtre en direct ne coupe pas la publication).
//
// Filtres de couleur : ctx.filter (CSS), aucune dependance externe, toujours disponibles.
// Filtres arriere-plan / visage : MediaPipe Tasks Vision (@mediapipe/tasks-vision), charges a la
// demande (WASM + modele telecharges au premier usage depuis le CDN de Google) — si ce
// chargement echoue (reseau, navigateur incompatible), on degrade proprement : les filtres de
// couleur restent utilisables, seuls arriere-plan/visage sont desactives (voir getMlError()).
import type { FaceDetector, FaceDetectorResult, ImageSegmenter, ImageSegmenterResult } from '@mediapipe/tasks-vision';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const SEGMENTER_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

// Resolution de traitement plafonnee — la decoupe arriere-plan fait une passe pixel par pixel en
// JS (voir compositeBackgroundBlur) : a 1280x720 ça sature le CPU et fait ramer le direct. 640px
// de large suffit largement pour un live mobile-first et reste fluide.
const MAX_PROCESS_WIDTH = 640;

export type ColorFilterId = 'none' | 'bw' | 'sepia' | 'vivid' | 'cold' | 'warm' | 'vintage';
export type BackgroundFilterId = 'none' | 'blur';
export type FaceFilterId = 'none' | 'sunglasses' | 'dogEars' | 'mustache';

export interface FilterConfig {
  color: ColorFilterId;
  background: BackgroundFilterId;
  face: FaceFilterId;
}

export const NO_FILTERS: FilterConfig = { color: 'none', background: 'none', face: 'none' };

export const COLOR_FILTER_PRESETS: { id: ColorFilterId; label: string; css: string }[] = [
  { id: 'none', label: 'Aucun', css: 'none' },
  { id: 'bw', label: 'Noir & blanc', css: 'grayscale(1) contrast(1.05)' },
  { id: 'sepia', label: 'Sépia', css: 'sepia(0.7) contrast(1.05)' },
  { id: 'vivid', label: 'Vif', css: 'saturate(1.6) contrast(1.1)' },
  { id: 'cold', label: 'Froid', css: 'saturate(1.1) hue-rotate(-8deg) brightness(1.03) contrast(1.05)' },
  { id: 'warm', label: 'Chaud', css: 'saturate(1.15) hue-rotate(8deg) brightness(1.05) sepia(0.15)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.35) contrast(0.9) brightness(1.05) saturate(0.85)' },
];

export const BACKGROUND_FILTER_PRESETS: { id: BackgroundFilterId; label: string }[] = [
  { id: 'none', label: 'Aucun' },
  { id: 'blur', label: 'Flou' },
];

export const FACE_FILTER_PRESETS: { id: FaceFilterId; label: string; emoji: string }[] = [
  { id: 'none', label: 'Aucun', emoji: '🚫' },
  { id: 'sunglasses', label: 'Lunettes', emoji: '😎' },
  { id: 'dogEars', label: 'Oreilles de chien', emoji: '🐶' },
  { id: 'mustache', label: 'Moustache', emoji: '🥸' },
];

function colorCss(id: ColorFilterId): string {
  return COLOR_FILTER_PRESETS.find((f) => f.id === id)?.css ?? 'none';
}

export function filtersActive(cfg: FilterConfig): boolean {
  return cfg.color !== 'none' || cfg.background !== 'none' || cfg.face !== 'none';
}

export class FilterEngine {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private subjectCanvas: HTMLCanvasElement | null = null;
  private rafId: number | null = null;
  private stopped = false;

  private segmenter: ImageSegmenter | null = null;
  private faceDetector: FaceDetector | null = null;
  private mlLoadPromise: Promise<void> | null = null;
  private mlLoadError: string | null = null;

  private config: FilterConfig = NO_FILTERS;
  private outputStream: MediaStream | null = null;

  constructor(private sourceStream: MediaStream) {
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = sourceStream;
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D non supporté.');
    this.ctx = ctx;
  }

  async start(): Promise<MediaStream> {
    await this.video.play();
    const track = this.sourceStream.getVideoTracks()[0];
    const settings = track?.getSettings();
    const srcW = settings?.width || this.video.videoWidth || 1280;
    const srcH = settings?.height || this.video.videoHeight || 720;
    const scale = Math.min(1, MAX_PROCESS_WIDTH / srcW);
    this.canvas.width = Math.round(srcW * scale);
    this.canvas.height = Math.round(srcH * scale);

    this.outputStream = this.canvas.captureStream(30);
    for (const audioTrack of this.sourceStream.getAudioTracks()) this.outputStream.addTrack(audioTrack);

    this.stopped = false;
    this.loop();
    return this.outputStream;
  }

  stop() {
    this.stopped = true;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.outputStream?.getTracks().forEach((t) => t.stop());
    this.video.pause();
    this.video.srcObject = null;
    this.segmenter?.close();
    this.faceDetector?.close();
  }

  setConfig(config: FilterConfig) {
    this.config = config;
  }

  // A appeler juste apres setConfig() quand le nouveau reglage a besoin du ML (arriere-plan ou
  // visage) — lance le chargement au besoin (une seule fois, reutilise ensuite) et resout avec un
  // message d'erreur si ça a echoue (reseau, navigateur incompatible), sinon null.
  async ensureMlLoaded(): Promise<string | null> {
    if (this.config.background !== 'none' || this.config.face !== 'none') {
      if (!this.mlLoadPromise) this.mlLoadPromise = this.loadMlModels();
      await this.mlLoadPromise;
    }
    return this.mlLoadError;
  }

  private async loadMlModels() {
    try {
      const { FilesetResolver, ImageSegmenter, FaceDetector } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      const [segmenter, faceDetector] = await Promise.all([
        ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: SEGMENTER_MODEL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        }),
        FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
          runningMode: 'VIDEO',
        }),
      ]);
      this.segmenter = segmenter;
      this.faceDetector = faceDetector;
    } catch (err) {
      this.mlLoadError = "Les filtres arrière-plan/visage n'ont pas pu se charger (réseau, ou navigateur incompatible) — les filtres de couleur restent disponibles.";
      console.error('FilterEngine: échec du chargement MediaPipe', err);
    }
  }

  private loop = () => {
    if (this.stopped) return;
    this.rafId = requestAnimationFrame(this.loop);
    if (this.video.readyState < 2) return;

    const { ctx, canvas, video, config } = this;
    const w = canvas.width;
    const h = canvas.height;
    const now = performance.now();

    let drewBase = false;
    if (config.background === 'blur' && this.segmenter) {
      try {
        const result = this.segmenter.segmentForVideo(video, now);
        this.compositeBackgroundBlur(result);
        drewBase = true;
      } catch {
        drewBase = false;
      }
    }
    if (!drewBase) {
      ctx.save();
      ctx.filter = colorCss(config.color);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
    }

    if (config.face !== 'none' && this.faceDetector) {
      try {
        const result = this.faceDetector.detectForVideo(video, now);
        this.drawFaceFilter(result, config.face);
      } catch {
        // un echec ponctuel de detection ne doit pas interrompre le flux — on garde juste l'image sans filtre visage cette frame
      }
    }
  };

  // Fond flou (+ filtre de couleur applique aux deux couches pour rester cohérent), sujet decoupe
  // net par-dessus via le masque de segmentation. Le masque MediaPipe peut avoir une resolution
  // differente du canvas — on le reechantillonne au plus proche (nearest neighbor, suffisant pour
  // un simple flou d'arriere-plan).
  private compositeBackgroundBlur(result: ImageSegmenterResult) {
    const { ctx, canvas, video, config } = this;
    const w = canvas.width;
    const h = canvas.height;
    const mask = result.categoryMask;
    if (!mask) {
      ctx.drawImage(video, 0, 0, w, h);
      return;
    }

    if (!this.subjectCanvas) {
      this.subjectCanvas = document.createElement('canvas');
    }
    this.subjectCanvas.width = w;
    this.subjectCanvas.height = h;
    const sctx = this.subjectCanvas.getContext('2d', { willReadFrequently: true })!;
    sctx.save();
    sctx.filter = colorCss(config.color);
    sctx.drawImage(video, 0, 0, w, h);
    sctx.restore();

    const maskData = mask.getAsUint8Array();
    const maskW = mask.width;
    const maskH = mask.height;
    const subjectImage = sctx.getImageData(0, 0, w, h);
    const scaleX = maskW / w;
    const scaleY = maskH / h;
    for (let y = 0; y < h; y++) {
      const my = Math.min(maskH - 1, (y * scaleY) | 0);
      for (let x = 0; x < w; x++) {
        const mx = Math.min(maskW - 1, (x * scaleX) | 0);
        const isPerson = maskData[my * maskW + mx] === 1;
        subjectImage.data[(y * w + x) * 4 + 3] = isPerson ? 255 : 0;
      }
    }
    sctx.putImageData(subjectImage, 0, 0);
    mask.close();

    ctx.save();
    ctx.filter = `blur(10px) ${colorCss(config.color)}`;
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    ctx.drawImage(this.subjectCanvas, 0, 0);
  }

  // Stickers dessines directement au canvas (pas d'image externe) positionnes a partir des
  // repères renvoyés par BlazeFace (ordre documenté : oeil droit, oeil gauche, bout du nez,
  // bouche, oreille droite, oreille gauche — coordonnées normalisées [0,1]).
  private drawFaceFilter(result: FaceDetectorResult, filter: FaceFilterId) {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    for (const detection of result.detections) {
      const kp = detection.keypoints;
      if (!kp || kp.length < 4) continue;
      const rightEye = { x: kp[0].x * w, y: kp[0].y * h };
      const leftEye = { x: kp[1].x * w, y: kp[1].y * h };
      const noseTip = { x: kp[2].x * w, y: kp[2].y * h };
      const mouth = { x: kp[3].x * w, y: kp[3].y * h };
      const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y) || w * 0.15;
      const box = detection.boundingBox;

      ctx.save();
      if (filter === 'sunglasses') {
        const lensR = eyeDist * 0.42;
        ctx.fillStyle = 'rgba(10,10,14,0.92)';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = Math.max(2, eyeDist * 0.05);
        [rightEye, leftEye].forEach((eye) => {
          ctx.beginPath();
          ctx.ellipse(eye.x, eye.y, lensR, lensR * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.beginPath();
        ctx.moveTo(rightEye.x + lensR * 0.8, rightEye.y);
        ctx.lineTo(leftEye.x - lensR * 0.8, leftEye.y);
        ctx.stroke();
      } else if (filter === 'dogEars' && box) {
        const earW = box.width * 0.42;
        const earH = box.height * 0.6;
        const topY = box.originY;
        ctx.fillStyle = '#7a4a2b';
        const drawEar = (cx: number, flip: number) => {
          ctx.beginPath();
          ctx.moveTo(cx, topY + earH * 0.35);
          ctx.quadraticCurveTo(cx + flip * earW * 0.55, topY - earH * 0.75, cx + flip * earW * 0.15, topY + earH * 0.05);
          ctx.quadraticCurveTo(cx + flip * earW * 0.05, topY + earH * 0.3, cx, topY + earH * 0.35);
          ctx.closePath();
          ctx.fill();
        };
        drawEar(box.originX + box.width * 0.22, -1);
        drawEar(box.originX + box.width * 0.78, 1);
        // Petit nez de chien
        ctx.fillStyle = '#241a16';
        ctx.beginPath();
        ctx.ellipse(noseTip.x, noseTip.y, eyeDist * 0.16, eyeDist * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (filter === 'mustache') {
        const midY = (noseTip.y + mouth.y) / 2;
        const width = eyeDist * 0.9;
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.moveTo(noseTip.x - width / 2, midY);
        ctx.quadraticCurveTo(noseTip.x - width * 0.2, midY - eyeDist * 0.14, noseTip.x, midY - eyeDist * 0.02);
        ctx.quadraticCurveTo(noseTip.x + width * 0.2, midY - eyeDist * 0.14, noseTip.x + width / 2, midY);
        ctx.quadraticCurveTo(noseTip.x, midY + eyeDist * 0.16, noseTip.x, midY - eyeDist * 0.02);
        ctx.quadraticCurveTo(noseTip.x, midY + eyeDist * 0.16, noseTip.x - width / 2, midY);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
