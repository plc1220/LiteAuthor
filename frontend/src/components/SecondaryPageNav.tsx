import type {ReactNode} from 'react';
import {BookOpen, Home, Library} from 'lucide-react';
import type {NavigationProps, Screen} from '../types';

type SecondaryPageNavProps = {
  eyebrow: string;
  title: string;
  projectName?: string;
  active?: 'manuscript' | 'wiki';
  actions?: ReactNode;
  onNavigate: NavigationProps['onNavigate'];
};

export function SecondaryPageNav({eyebrow, title, projectName, active, actions, onNavigate}: SecondaryPageNavProps) {
  const navItems: {label: string; screen: Screen; icon: ReactNode; key: NonNullable<SecondaryPageNavProps['active']>}[] = [
    {label: 'Manuscript', screen: 'ZenEditor', icon: <BookOpen className="w-4 h-4" />, key: 'manuscript'},
    {label: 'Wiki', screen: 'WikiHub', icon: <Library className="w-4 h-4" />, key: 'wiki'},
  ];

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-oak-variant bg-sepia-low/95 px-4 py-3 md:px-7">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          className="flex items-center gap-3 rounded-sm border border-transparent bg-transparent p-1 text-left hover:border-oak-variant hover:bg-sepia-mid"
          onClick={() => onNavigate('LibraryHome', 'push_back')}
          title="Back to manuscript library"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-primary/35 bg-primary/10 font-serif text-sm font-bold text-primary">
            L
          </span>
          <span className="hidden font-sans text-sm font-semibold tracking-wide text-ink sm:inline">LiteAuthor</span>
        </button>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-sans uppercase tracking-[0.25em] text-ink-muted">{projectName ?? eyebrow}</p>
          <h1 className="truncate font-serif text-2xl italic text-primary">{title}</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <nav className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-2 rounded-sm border border-oak-variant px-3 py-2 text-xs uppercase tracking-widest text-ink-muted hover:border-primary hover:text-ink"
            onClick={() => onNavigate('LibraryHome', 'push_back')}
          >
            <Home className="h-4 w-4" />
            Library
          </button>
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`px-3 py-2 border rounded-sm text-xs uppercase tracking-widest flex items-center gap-2 ${
                active === item.key ? 'border-primary bg-sepia-highest text-primary' : 'border-oak-variant text-ink-muted hover:text-ink hover:border-primary'
              }`}
              onClick={() => onNavigate(item.screen, item.key === 'manuscript' ? 'push_back' : 'push')}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        {actions}
      </div>
    </header>
  );
}
