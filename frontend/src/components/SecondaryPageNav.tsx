import type {ReactNode} from 'react';
import {BookOpen, Library, Settings} from 'lucide-react';
import type {NavigationProps, Screen} from '../types';

type SecondaryPageNavProps = {
  eyebrow: string;
  title: string;
  projectName?: string;
  active?: 'manuscript' | 'wiki' | 'settings';
  actions?: ReactNode;
  onNavigate: NavigationProps['onNavigate'];
};

export function SecondaryPageNav({eyebrow, title, projectName, active, actions, onNavigate}: SecondaryPageNavProps) {
  const navItems: {label: string; screen: Screen; icon: ReactNode; key: NonNullable<SecondaryPageNavProps['active']>}[] = [
    {label: 'Manuscript', screen: 'ZenEditor', icon: <BookOpen className="w-4 h-4" />, key: 'manuscript'},
    {label: 'Story Wiki', screen: 'StoryWikiHub', icon: <Library className="w-4 h-4" />, key: 'wiki'},
    {label: 'Settings', screen: 'SettingsScreen', icon: <Settings className="w-4 h-4" />, key: 'settings'},
  ];

  return (
    <header className="sticky top-0 z-20 bg-sepia-low border-b border-oak-variant px-8 py-5 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-ink-muted truncate">{projectName ?? eyebrow}</p>
        <h1 className="text-3xl font-serif italic text-primary">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <nav className="flex flex-wrap items-center gap-2">
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
