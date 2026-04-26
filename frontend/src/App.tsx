import {useEffect, useState} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {Screen, TransitionType} from './types';
import LibraryHome from './screens/LibraryHome';
import StoryWikiHub from './screens/StoryWikiHub';
import StoryBible from './screens/StoryBible';
import StoryCanvas from './screens/StoryCanvas';
import TimelineView from './screens/TimelineView';
import AgentMode from './screens/AgentMode';
import ZenEditor from './screens/ZenEditor';
import ProjectSetupWizard from './screens/ProjectSetupWizard';
import ContinuityCheckPanel from './screens/ContinuityCheckPanel';
import SettingsScreen from './screens/SettingsScreen';
import VersionHistory from './screens/VersionHistory';
import {useProjectStore} from './stores/projectStore';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('LibraryHome');
  const [transition, setTransition] = useState<TransitionType>('none');
  const loadProjects = useProjectStore((s) => s.loadProjects);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const onNavigate = (screen: Screen, trans: TransitionType = 'push') => {
    setTransition(trans);
    setCurrentScreen(screen);
  };

  const getVariants = (type: TransitionType) => {
    switch (type) {
      case 'push':
        return {initial: {x: '100vw'}, animate: {x: 0}, exit: {x: '-100vw'}};
      case 'push_back':
        return {initial: {x: '-100vw'}, animate: {x: 0}, exit: {x: '100vw'}};
      case 'slide_up':
        return {initial: {y: '100vh'}, animate: {y: 0}, exit: {opacity: 0}};
      case 'none':
      default:
        return {initial: {opacity: 0}, animate: {opacity: 1}, exit: {opacity: 0}};
    }
  };

  const renderScreen = () => {
    const props = {onNavigate};
    switch (currentScreen) {
      case 'LibraryHome':
        return <LibraryHome {...props} />;
      case 'StoryWikiHub':
        return <StoryWikiHub {...props} />;
      case 'StoryBible':
        return <StoryBible {...props} />;
      case 'StoryCanvas':
        return <StoryCanvas {...props} />;
      case 'TimelineView':
        return <TimelineView {...props} />;
      case 'AgentMode':
        return <AgentMode {...props} />;
      case 'ZenEditor':
        return <ZenEditor {...props} />;
      case 'ProjectSetupWizard':
        return <ProjectSetupWizard {...props} />;
      case 'ContinuityCheckPanel':
        return <ContinuityCheckPanel {...props} />;
      case 'SettingsScreen':
        return <SettingsScreen {...props} />;
      case 'VersionHistory':
        return <VersionHistory {...props} />;
      default:
        return null;
    }
  };

  const variants = getVariants(transition);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-parchment font-serif selection:bg-sepia-highest">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={currentScreen}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            mass: 1,
            duration: transition === 'none' ? 0 : 0.4,
          }}
          className="w-full h-full"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
