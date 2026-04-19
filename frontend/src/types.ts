export type Screen =
  | 'LibraryHome'
  | 'StoryWikiHub'
  | 'TimelineView'
  | 'AgentMode'
  | 'ZenEditor'
  | 'ProjectSetupWizard'
  | 'MotifThemePanel'
  | 'ContinuityCheckPanel'
  | 'SettingsScreen'
  | 'VersionHistory';

export type TransitionType = 'push' | 'push_back' | 'slide_up' | 'none';

export interface NavigationProps {
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
}
