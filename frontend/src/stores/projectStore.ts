import {create} from 'zustand';
import {api, type Chapter, type Project, type Scene} from '../lib/api';

type Outline = {chapters: Chapter[]; scenes: Scene[]};

function firstSceneId(outline: Outline): string | null {
  const sceneByChapter = new Map<string, Scene[]>();
  for (const scene of outline.scenes) {
    const scenes = sceneByChapter.get(scene.chapter_id) ?? [];
    scenes.push(scene);
    sceneByChapter.set(scene.chapter_id, scenes);
  }

  for (const chapter of [...outline.chapters].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))) {
    const firstScene = (sceneByChapter.get(chapter.id) ?? []).sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))[0];
    if (firstScene) return firstScene.id;
  }

  return outline.scenes[0]?.id ?? null;
}

type ProjectState = {
  projects: Project[];
  activeProject: Project | null;
  outline: Outline | null;
  activeSceneId: string | null;
  lastError: string | null;
  wordCount: number;
  loadProjects: () => Promise<void>;
  selectProject: (id: string) => Promise<void>;
  refreshOutline: () => Promise<Outline | null>;
  setActiveScene: (sceneId: string | null) => void;
  setWordCount: (n: number) => void;
  createProject: (name: string, genres: string[], targetWords: number) => Promise<void>;
  clearError: () => void;
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  outline: null,
  activeSceneId: null,
  lastError: null,
  wordCount: 0,
  clearError: () => set({lastError: null}),
  setWordCount: (n) => set({wordCount: n}),
  loadProjects: async () => {
    try {
      const projects = await api.listProjects();
      set({projects, lastError: null});
    } catch (e) {
      set({lastError: (e as Error).message});
    }
  },
  selectProject: async (id: string) => {
    try {
      const activeProject = await api.getProject(id);
      const outline = await api.outline(id);
      const firstScene = firstSceneId(outline);
      set({activeProject, outline, activeSceneId: firstScene, lastError: null});
    } catch (e) {
      set({lastError: (e as Error).message});
    }
  },
  refreshOutline: async () => {
    const p = get().activeProject;
    if (!p) return null;
    const outline = await api.outline(p.id);
    const currentSceneId = get().activeSceneId;
    const nextSceneId = currentSceneId && outline.scenes.some((scene) => scene.id === currentSceneId) ? currentSceneId : firstSceneId(outline);
    set({outline, activeSceneId: nextSceneId});
    return outline;
  },
  setActiveScene: (sceneId) => set({activeSceneId: sceneId}),
  createProject: async (name, genres, targetWords) => {
    const p = await api.createProject({name, genres, target_words: targetWords});
    const outline = await api.outline(p.id);
    const firstScene = firstSceneId(outline);
    set((s) => ({
      projects: [p, ...s.projects.filter((x) => x.id !== p.id)],
      activeProject: p,
      outline,
      activeSceneId: firstScene,
      lastError: null,
    }));
  },
}));
