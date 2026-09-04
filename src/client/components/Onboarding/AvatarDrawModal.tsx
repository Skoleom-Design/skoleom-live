import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Eraser, RotateCcw, Loader2 } from 'lucide-react';
import { uploadFile } from '../../../shared/api/http';
import { useLanguage } from '../../i18n/LanguageContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (url: string) => void;
}

const SIZE = 320;
const BACKGROUNDS = ['#ffffff', '#341839', '#ffc94d', '#ff5470', '#ff5470', '#ffc94d'];
const COLORS = ['#000000', '#ffffff', '#ffc94d', '#ff5470', '#ffc94d', '#ff4d6d', '#4d7dff', '#ff9f4d'];
const BRUSH_SIZES = [3, 8, 16];

// Atelier de dessin — canvas libre pour se creer un avatar entierement personnalise, en plus
// des categories preset. Le resultat est uploade comme une photo classique (meme helper que
// l'upload de photo de profil) puis traite exactement comme un avatar preset par l'appelant.
export function AvatarDrawModal({ open, onClose, onSave }: Props) {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<string[]>([]);

  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [erasing, setErasing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, SIZE, SIZE);
    historyRef.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function fillBackground(bg: string) {
    setBackground(bg);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    pushHistory();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  function pushHistory() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    historyRef.current.push(canvas.toDataURL());
    if (historyRef.current.length > 20) historyRef.current.shift();
  }

  function undo() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const last = historyRef.current.pop();
    if (!canvas || !ctx || !last) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, SIZE, SIZE);
    img.src = last;
  }

  function clearAll() {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    pushHistory();
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SIZE,
      y: ((e.clientY - rect.top) / rect.height) * SIZE,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    pushHistory();
    drawingRef.current = true;
    const p = pointFromEvent(e);
    lastPointRef.current = p;
    ctx.beginPath();
    ctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = erasing ? background : color;
    ctx.fill();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !lastPointRef.current) return;
    const p = pointFromEvent(e);
    ctx.strokeStyle = erasing ? background : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
  }

  function handlePointerUp() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('canvas empty');
      const file = new File([blob], `drawing-${Date.now()}.png`, { type: 'image/png' });
      const url = await uploadFile(file, 'avatars');
      onSave(url);
      onClose();
    } catch {
      // Echec d'upload — l'utilisateur reste sur l'atelier, peut reessayer.
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center px-4 py-6">
      <div className="cosmic-modal w-full max-w-sm border border-white/[0.08] rounded-[20px] p-5 max-h-full overflow-y-auto scrollbar-hide">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-base">{t('onboarding.drawTitle')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="flex items-center justify-center mb-4">
          <div className="rounded-full overflow-hidden ring-2 ring-white/10" style={{ width: SIZE, height: SIZE, maxWidth: '100%' }}>
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              className="w-full h-full touch-none cursor-crosshair"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
        </div>

        <p className="text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">{t('onboarding.drawBackground')}</p>
        <div className="flex gap-2 mb-4">
          {BACKGROUNDS.map((bg) => (
            <button
              key={bg}
              type="button"
              onClick={() => fillBackground(bg)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${background === bg ? 'border-[#ffc94d] scale-110' : 'border-white/15'}`}
              style={{ backgroundColor: bg }}
            />
          ))}
        </div>

        <p className="text-[11px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">{t('onboarding.drawColor')}</p>
        <div className="flex gap-2 mb-4 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setColor(c); setErasing(false); }}
              className={`w-7 h-7 rounded-full border-2 transition-all ${!erasing && color === c ? 'border-[#ffc94d] scale-110' : 'border-white/15'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setBrushSize(s)}
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                  brushSize === s ? 'border-[#ffc94d] bg-white/[0.06]' : 'border-white/15'
                }`}
              >
                <span className="rounded-full bg-white" style={{ width: s, height: s }} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setErasing((v) => !v)}
              title={t('onboarding.drawEraser')}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                erasing ? 'border-[#ffc94d] bg-white/[0.06] text-[#ffc94d]' : 'border-white/15 text-white/60'
              }`}
            >
              <Eraser size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={undo}
            title={t('onboarding.drawUndo')}
            className="w-9 h-9 rounded-full border border-white/15 text-white/60 hover:text-white flex items-center justify-center transition-all"
          >
            <RotateCcw size={15} />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={clearAll}
            className="flex-1 py-3 rounded-full border border-white/15 text-white/70 text-sm font-semibold hover:text-white transition-all"
          >
            {t('onboarding.drawClear')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-skoleom flex-[2] py-3 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime active:scale-[0.98] disabled:opacity-60 gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : t('onboarding.drawUse')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
