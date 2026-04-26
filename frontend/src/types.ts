export type Screen =
  | 'LibraryHome'
  | 'StoryWikiHub'
  | 'StoryBible'
  | 'StoryCanvas'
  | 'TimelineView'
  | 'AgentMode'
  | 'ZenEditor'
  | 'ProjectSetupWizard'
  | 'ContinuityCheckPanel'
  | 'SettingsScreen'
  | 'VersionHistory';

export type TransitionType = 'push' | 'push_back' | 'slide_up' | 'none';

export interface NavigationProps {
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
}
