import type {ReactNode} from 'react';
import {BookOpen, Home, Library, Settings} from 'lucide-react';
import type {NavigationProps, Screen, TransitionType} from '../types';

type AppSection = 'manuscript' | 'desk' | 'settings';

type AppScaffoldProps = {
  active: AppSection;
  children: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  mainClassName?: string;
  onNavigate: NavigationProps['onNavigate'];
  /** Shown before any built-in or action navigation (e.g. flush draft save). */
  beforeNavigate?: () => void | Promise<void>;
  /** Hide global header, footer, and the built-in right-side of the top bar; children control chrome. */
  minimalChrome?: boolean;
};

const NAV_ITEMS: {label: string; screen: Screen; active: AppSection; icon: ReactNode; transition: TransitionType}[] = [
  {label: 'Manuscript', screen: 'ZenEditor', active: 'manuscript', icon: <BookOpen className="h-4 w-4" />, transition: 'push_back'},
  {label: 'The Codex', screen: 'StoryWikiHub', active: 'desk', icon: <Library className="h-4 w-4" />, transition: 'push'},
  {label: 'Settings', screen: 'SettingsScreen', active: 'settings', icon: <Settings className="h-4 w-4" />, transition: 'push'},
];

export function AppScaffold({active, children, actions, footer, mainClassName = 'overflow-y-auto', onNavigate, beforeNavigate, minimalChrome = false}: AppScaffoldProps) {
  const go = (fn: () => void) => {
    void (async () => {
      try {
        await beforeNavigate?.();
      } catch {
        /* do not block navigation on save error */
      }
      fn();
    })();
  };

  return (
    <div className="flex h-screen min-h-screen flex-col bg-parchment text-ink paper-grain">
      {minimalChrome ? null : (
        <header className="relative z-50 flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-oak-variant bg-sepia-low/95 px-4 py-2 transition-transform duration-300 md:px-7">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              className="flex min-w-0 items-center gap-3 rounded-sm border border-transparent bg-transparent p-1 text-left hover:border-oak-variant hover:bg-sepia-mid"
              onClick={() => go(() => onNavigate('LibraryHome', 'push_back'))}
              title="Back to manuscript library"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-primary/35 bg-primary/10 font-serif text-sm font-bold text-primary">
                L
              </span>
              <span className="hidden font-sans text-sm font-semibold tracking-wide text-ink sm:inline">LiteAuthor</span>
            </button>

            <nav className="flex min-w-0 items-center gap-1 text-xs font-sans uppercase tracking-widest">
              <button
                type="button"
                className="hidden items-center gap-1.5 rounded-sm px-2 py-2 text-ink-muted hover:bg-sepia-mid hover:text-ink md:flex"
                onClick={() => go(() => onNavigate('LibraryHome', 'push_back'))}
              >
                <Home className="h-4 w-4" />
                Library
              </button>
              <span className="hidden text-oak-variant md:inline">/</span>
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.active}
                  type="button"
                  className={`flex items-center gap-1.5 rounded-sm px-2 py-2 ${
                    active === item.active ? 'bg-sepia-high text-primary' : 'text-ink-muted hover:bg-sepia-mid hover:text-ink'
                  }`}
                  onClick={() => go(() => onNavigate(item.screen, item.transition))}
                >
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="flex min-w-0 items-center gap-2">{actions}</div>
        </header>
      )}

      <main className={`relative min-h-0 flex-1 ${mainClassName}`}>{children}</main>
      {minimalChrome ? null : footer}
    </div>
  );
}
