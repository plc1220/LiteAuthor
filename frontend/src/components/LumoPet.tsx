import {FormEvent, useEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Bell, Camera, Send, X} from 'lucide-react';
import lumoSpriteSheet from '../assets/lumo/lumo-sprite-sheet.png';
import './LumoPet.css';

type LumoState = 'idle' | 'blink' | 'thinking' | 'typing' | 'happy' | 'notification' | 'wave' | 'sleep';

type Message = {
  role: 'user' | 'lumo';
  text: string;
};

type LumoPetProps = {
  hidden?: boolean;
  manuscriptTitle?: string;
  currentScene?: string;
  selectedText?: string;
  aiBusy?: boolean;
  hasSuggestion?: boolean;
  onSnapshot?: () => void | Promise<void>;
};

const SPRITE_FRAME_COUNT = 9;

const spriteFrames = {
  idle: 0,
  blink: 1,
  thinking: 2,
  excited: 3,
  wink: 4,
  badge: 5,
  notification: 6,
  thought: 7,
  wave: 8,
} as const;

const lumoSequences: Record<LumoState, number[]> = {
  idle: [spriteFrames.idle],
  blink: [spriteFrames.blink, spriteFrames.idle],
  thinking: [spriteFrames.thinking],
  typing: [spriteFrames.thinking, spriteFrames.thought, spriteFrames.thinking],
  happy: [spriteFrames.excited, spriteFrames.idle],
  notification: [spriteFrames.excited, spriteFrames.idle, spriteFrames.excited],
  wave: [spriteFrames.idle, spriteFrames.wave, spriteFrames.idle],
  sleep: [spriteFrames.wink],
};

const frameSpeeds: Record<LumoState, number> = {
  idle: 0,
  blink: 160,
  thinking: 260,
  typing: 180,
  happy: 170,
  notification: 360,
  wave: 150,
  sleep: 0,
};

const loopingStates = new Set<LumoState>(['thinking', 'typing', 'notification']);

export default function LumoPet({hidden = false, manuscriptTitle, currentScene, selectedText = '', aiBusy = false, hasSuggestion = false, onSnapshot}: LumoPetProps) {
  const [state, setState] = useState<LumoState>('idle');
  const [sequenceStep, setSequenceStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'lumo',
      text: "Hi, I'm Lumo. I can help with rewrites, scene ideas, continuity checks, or a quick snapshot.",
    },
  ]);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const contextLine = useMemo(() => {
    const bits = [manuscriptTitle, currentScene].filter(Boolean);
    return bits.length ? bits.join(' / ') : 'LiteAuthor';
  }, [currentScene, manuscriptTitle]);

  const sequence = lumoSequences[state];
  const spriteFrame = sequence[sequenceStep % sequence.length];
  const spritePosition = `${(spriteFrame / (SPRITE_FRAME_COUNT - 1)) * 100}% center`;

  useEffect(() => {
    if (aiBusy) {
      setState('thinking');
      return;
    }
    if (hasSuggestion) {
      setState('notification');
      return;
    }
    if (state === 'thinking' || state === 'notification') resetIdleTimer();
  }, [aiBusy, hasSuggestion]);

  useEffect(() => {
    if (hidden || open) return;
    const scheduleBlink = () => {
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
      blinkTimer.current = setTimeout(() => {
        setState((current) => (current === 'idle' ? 'blink' : current));
        scheduleBlink();
      }, 18000 + Math.random() * 9000);
    };
    scheduleBlink();
    return () => {
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
    };
  }, [hidden, open]);

  useEffect(() => {
    setSequenceStep(0);
    if (gestureReturnTimer.current) clearTimeout(gestureReturnTimer.current);
    const speed = frameSpeeds[state];
    const totalFrames = lumoSequences[state].length;
    if (!speed || totalFrames <= 1) return;

    const loops = loopingStates.has(state);
    let raf = 0;
    let last = performance.now();
    let accumulated = 0;
    let virtualStep = 0;
    let done = false;
    const tick = (now: number) => {
      if (done) return;
      accumulated += now - last;
      last = now;
      if (accumulated >= speed) {
        const steps = Math.floor(accumulated / speed);
        accumulated %= speed;
        virtualStep += steps;
        if (!loops && virtualStep >= totalFrames - 1) {
          virtualStep = totalFrames - 1;
          done = true;
          setSequenceStep(virtualStep);
          gestureReturnTimer.current = setTimeout(() => setState('idle'), speed);
          return;
        }
        setSequenceStep(virtualStep);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      done = true;
      if (gestureReturnTimer.current) clearTimeout(gestureReturnTimer.current);
      cancelAnimationFrame(raf);
    };
  }, [state]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({block: 'end'});
  }, [messages, open]);

  useEffect(
    () => () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
      if (gestureReturnTimer.current) clearTimeout(gestureReturnTimer.current);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    [],
  );

  function resetIdleTimer(next: LumoState = 'idle') {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setState(next), 2400);
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, {role: 'user', text: trimmed}]);
    setInput('');
    setState('thinking');
    const reply = await fakeLumoReply(trimmed, {currentScene, selectedText});
    setMessages((prev) => [...prev, {role: 'lumo', text: reply}]);
    setState('happy');
    resetIdleTimer();
  }

  if (hidden) return null;

  return (
    <div className="lumo-root" data-state={state}>
      <AnimatePresence>
        {open ? (
          <motion.section
            className="lumo-chat"
            initial={{opacity: 0, y: 14, scale: 0.97}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: 12, scale: 0.97}}
            transition={{duration: 0.18}}
            aria-label="Lumo chat"
          >
            <header className="lumo-chat-header">
              <div className="lumo-chat-title">
                <strong>Lumo</strong>
                <span>{contextLine}</span>
              </div>
              <button type="button" className="lumo-icon-button" onClick={() => setOpen(false)} aria-label="Close Lumo">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="lumo-messages" aria-live="polite">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`lumo-message ${message.role}`}>
                  {message.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="lumo-quick-row">
              <button type="button" onClick={() => setInput('Rewrite this paragraph')} disabled={!selectedText.trim()}>
                Rewrite
              </button>
              <button type="button" onClick={() => setInput('Check continuity in this scene')}>
                Continuity
              </button>
              <button type="button" onClick={() => setInput('Suggest the next scene beat')}>
                Next beat
              </button>
              {onSnapshot ? (
                <button type="button" onClick={() => void onSnapshot()}>
                  <Camera className="h-3.5 w-3.5" />
                  Snapshot
                </button>
              ) : null}
            </div>

            <form className="lumo-input-row" onSubmit={sendMessage}>
              <input
                value={input}
                placeholder="Ask Lumo..."
                onChange={(event) => {
                  setInput(event.target.value);
                  if (typingTimer.current) clearTimeout(typingTimer.current);
                  if (event.target.value) {
                    setState('typing');
                    typingTimer.current = setTimeout(() => {
                      setState('thinking');
                      resetIdleTimer();
                    }, 850);
                  } else {
                    setState('idle');
                  }
                }}
              />
              <button type="submit" aria-label="Send message">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!open && state === 'notification' ? (
          <motion.div className="lumo-bubble" initial={{opacity: 0, x: 8}} animate={{opacity: 1, x: 0}} exit={{opacity: 0, x: 8}}>
            <Bell className="h-3.5 w-3.5" />
            Thought ready
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        className="lumo-pet-button"
        onClick={() => {
          setOpen(true);
          setState('wave');
          resetIdleTimer();
        }}
        whileHover={{scale: 1.04}}
        whileTap={{scale: 0.95}}
        aria-label="Chat with Lumo"
      >
        {state === 'notification' ? <span className="lumo-notification-dot" aria-hidden /> : null}
        <motion.span
          className="lumo-sprite"
          aria-hidden
          style={{
            backgroundImage: `url(${lumoSpriteSheet})`,
            backgroundPosition: spritePosition,
            backgroundSize: `${SPRITE_FRAME_COUNT * 100}% 100%`,
          }}
          animate={
            state === 'idle'
              ? {
                  y: [0, -1.5, 0.5, 0],
                  rotate: [0, -0.35, 0.25, 0],
                  scaleX: [1, 1.006, 0.998, 1],
                  scaleY: [1, 0.992, 1.006, 1],
                }
              : state === 'thinking'
                ? {rotate: [-2, 2, -2], y: [0, -1, 0]}
                : state === 'typing'
                  ? {x: [-2, 2, -2], y: [0, -1, 0]}
                  : state === 'happy' || state === 'notification'
                    ? {scale: [1, 1.04, 1], y: [0, -3, 0]}
                    : state === 'wave'
                      ? {rotate: [0, -1.5, 1.5, 0], y: [0, -2, 0]}
                    : {}
          }
          transition={{
            duration: state === 'idle' ? 3.4 : 0.86,
            repeat: state === 'idle' || state === 'thinking' || state === 'typing' || state === 'notification' ? Infinity : 0,
            ease: 'easeInOut',
          }}
        />
        <span className="sr-only">Lumo</span>
      </motion.button>
    </div>
  );
}

async function fakeLumoReply(userText: string, context: {currentScene?: string; selectedText?: string}): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 520));
  const text = userText.toLowerCase();
  const selection = context.selectedText?.trim();
  if (text.includes('rewrite')) {
    return selection
      ? 'I can help rewrite the selected passage. Use the selection toolbar for an inline replacement, or tell me the tone you want.'
      : 'Select a paragraph first, then ask me to rewrite it with a clearer, sharper, or more literary tone.';
  }
  if (text.includes('continuity')) {
    return `For ${context.currentScene ?? 'this scene'}, check names, timeline promises, emotional reversals, and any detail that changed since the last chapter.`;
  }
  if (text.includes('next') || text.includes('idea')) {
    return 'A useful next beat usually raises pressure, reveals one concrete fact, or forces the character to choose. Which kind of turn do you want?';
  }
  return "I'm here. Ask for rewriting, critique, continuity checks, next-scene ideas, or plot-hole hunting.";
}
