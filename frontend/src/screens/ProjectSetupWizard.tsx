import {useMemo, useState} from 'react';
import {ArrowLeft, ArrowRight, Check, ChevronDown, GripVertical, Hourglass, Plus, Settings, Trash2} from 'lucide-react';
import {NavigationProps} from '../types';
import {useProjectStore} from '../stores/projectStore';

const GENRES = ['Literary Fiction', 'Fantasy', 'Sci-Fi', 'Thriller', 'Romance', 'Historical', 'Experimental', 'Other'];
const POV_TYPES = ['1st person', '3rd limited', '3rd omniscient', '2nd person', 'Multiple POV', 'Unreliable narrator'];
const TENSES = ['Past', 'Present', 'Mixed'];
const VOCAB_LEVELS = ['Accessible', 'Standard', 'Literary', 'Experimental'];
const STRUCTURE_PRESETS = [
  'Single linear narrative',
  'Multiple POV (alternating chapters)',
  'Nonlinear / Fragmented',
  'Parallel timelines',
  'Anthology / Linked stories',
];
const CHAPTER_NAMING = ['Numbered ("Chapter 1")', 'Named', 'Roman numerals', 'Date-based', 'No chapters (scene-only)'];
const ROLES = ['Protagonist', 'Antagonist', 'Supporting', 'Minor'];

type CharacterSeed = {
  id: number;
  name: string;
  role: string;
  description: string;
  pov: boolean;
};

const STEPS = ['Identity', 'Style Profile', 'Structure', 'Seed Characters', 'Review & Create'];

function FieldLabel({children}: {children: React.ReactNode}) {
  return <label className="font-sans text-[10px] text-ink-muted uppercase block mb-2 font-bold tracking-widest">{children}</label>;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <select
          className="w-full appearance-none bg-sepia-highest/40 border border-oak-variant rounded-sm px-3 py-3 pr-9 font-serif text-sm italic text-primary focus:outline-none focus:border-primary"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-oak absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

function SliderField({
  left,
  right,
  value,
  onChange,
}: {
  left: string;
  right: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between font-sans text-[10px] uppercase tracking-widest font-bold text-oak mb-2">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#7c5138]"
      />
    </div>
  );
}

function describeAxis(value: number, low: string, balanced: string, high: string) {
  if (value < 38) return low;
  if (value > 62) return high;
  return balanced;
}

export default function ProjectSetupWizard({onNavigate}: NavigationProps) {
  const createProject = useProjectStore((s) => s.createProject);
  const activeProject = useProjectStore((s) => s.activeProject);
  const exitTarget = activeProject ? 'WikiHub' : 'LibraryHome';
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['Literary Fiction']);
  const [targetWords, setTargetWords] = useState('80000');
  const [povType, setPovType] = useState('3rd limited');
  const [tense, setTense] = useState('Past');
  const [spareDense, setSpareDense] = useState(35);
  const [lyricalDirect, setLyricalDirect] = useState(42);
  const [slowPropulsive, setSlowPropulsive] = useState(55);
  const [styleNotes, setStyleNotes] = useState('');
  const [vocabulary, setVocabulary] = useState('Standard');
  const [structurePreset, setStructurePreset] = useState('Single linear narrative');
  const [chapterNaming, setChapterNaming] = useState('Numbered ("Chapter 1")');
  const [narrativePresent, setNarrativePresent] = useState('');
  const [characters, setCharacters] = useState<CharacterSeed[]>([]);
  const [fileTreeOpen, setFileTreeOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const styleDescriptor = useMemo(
    () =>
      [
        describeAxis(spareDense, 'spare', 'balanced texture', 'dense'),
        describeAxis(lyricalDirect, 'lyrical', 'clear-toned', 'direct'),
        describeAxis(slowPropulsive, 'slow-burn', 'measured pace', 'propulsive'),
      ].join(' / '),
    [spareDense, lyricalDirect, slowPropulsive],
  );

  const validCharacters = characters.filter((character) => character.name.trim());
  const parsedTargetWords = Math.max(0, Number.parseInt(targetWords, 10) || 0);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) => (prev.includes(genre) ? prev.filter((x) => x !== genre) : [...prev, genre]));
  };

  const goToStep = (nextStep: number) => {
    setErr(null);
    setStep(Math.max(0, Math.min(STEPS.length - 1, nextStep)));
  };

  const continueWizard = () => {
    if (step === 0 && !title.trim()) {
      setErr('Please enter a working title.');
      return;
    }
    goToStep(step + 1);
  };

  const skipStep = () => {
    if (step === 0) {
      onNavigate(exitTarget, 'push_back');
      return;
    }
    if (step < STEPS.length - 1) goToStep(step + 1);
  };

  const addCharacter = () => {
    if (characters.length >= 5) return;
    setCharacters((prev) => [
      ...prev,
      {id: Date.now(), name: '', role: 'Supporting', description: '', pov: false},
    ]);
  };

  const updateCharacter = (id: number, patch: Partial<CharacterSeed>) => {
    setCharacters((prev) => prev.map((character) => (character.id === id ? {...character, ...patch} : character)));
  };

  const moveCharacter = (id: number, direction: -1 | 1) => {
    setCharacters((prev) => {
      const index = prev.findIndex((character) => character.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  };

  const removeCharacter = (id: number) => {
    setCharacters((prev) => prev.filter((character) => character.id !== id));
  };

  const finish = async () => {
    if (!title.trim()) {
      setErr('Please enter a working title.');
      goToStep(0);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await createProject(title.trim(), selectedGenres, parsedTargetWords);
      onNavigate('ZenEditor', 'push');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const renderIdentity = () => (
    <>
      <div className="mb-8">
        <span className="font-sans text-[10px] text-ink-muted uppercase font-bold tracking-widest">Step 1 - Identity</span>
        <h2 className="text-4xl font-semibold italic text-primary mt-2">What is the soul of this story?</h2>
      </div>
      <div className="space-y-7">
        <div>
          <FieldLabel>Project Title</FieldLabel>
          <div className="border-b-2 border-oak transition-all focus-within:border-primary">
            <input
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-3xl italic font-medium py-2 placeholder:text-oak-variant text-primary font-serif"
              placeholder="Untitled Manuscript"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div>
          <FieldLabel>Working Subtitle</FieldLabel>
          <input
            className="w-full bg-sepia-highest/30 border border-oak-variant rounded-sm px-3 py-3 font-serif text-sm italic text-primary placeholder:text-oak-variant focus:outline-none focus:border-primary"
            placeholder="Optional"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Genre Tags</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => toggleGenre(genre)}
                className={`px-4 py-1.5 rounded-full border font-sans text-xs font-bold transition-colors ${
                  selectedGenres.includes(genre)
                    ? 'bg-amber-wax-container border-amber-wax text-ink'
                    : 'bg-sepia-highest/50 border-oak-variant text-ink hover:bg-sepia-highest'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full max-w-xs">
          <FieldLabel>Word Count Target</FieldLabel>
          <div className="flex items-center gap-3 border-b border-oak py-2 focus-within:border-primary transition-colors">
            <input
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-lg font-serif italic text-primary p-0"
              type="number"
              min={0}
              value={targetWords}
              onChange={(e) => setTargetWords(e.target.value)}
            />
            <span className="font-sans text-[9px] text-oak uppercase font-bold">Words</span>
          </div>
          <button
            type="button"
            className="mt-2 bg-transparent border-none p-0 font-sans text-[10px] uppercase tracking-widest font-bold text-oak hover:text-primary cursor-pointer"
            onClick={() => setTargetWords('0')}
          >
            Skip for now
          </button>
        </div>
      </div>
    </>
  );

  const renderStyle = () => (
    <>
      <div className="mb-8">
        <span className="font-sans text-[10px] text-ink-muted uppercase font-bold tracking-widest">Step 2 - Style Profile</span>
        <h2 className="text-4xl font-semibold italic text-primary mt-2">Teach the project its voice.</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <SelectField label="POV Type" value={povType} options={POV_TYPES} onChange={setPovType} />
        <SelectField label="Tense" value={tense} options={TENSES} onChange={setTense} />
      </div>
      <div className="mt-7 space-y-5">
        <FieldLabel>Prose Register</FieldLabel>
        <div className="border border-oak-variant rounded-sm bg-sepia-low/20 p-4 space-y-4">
          <SliderField left="Spare" right="Dense" value={spareDense} onChange={setSpareDense} />
          <SliderField left="Lyrical" right="Direct" value={lyricalDirect} onChange={setLyricalDirect} />
          <SliderField left="Slow-burn" right="Propulsive" value={slowPropulsive} onChange={setSlowPropulsive} />
          <p className="font-serif italic text-sm text-primary">Style card: {styleDescriptor}</p>
        </div>
      </div>
      <div className="mt-7">
        <FieldLabel>Style Notes</FieldLabel>
        <textarea
          className="w-full min-h-24 bg-sepia-highest/30 border border-oak-variant rounded-sm px-3 py-3 font-serif text-sm italic text-primary placeholder:text-oak-variant focus:outline-none focus:border-primary resize-y"
          placeholder="Write like..., always avoid..., favor..."
          value={styleNotes}
          onChange={(e) => setStyleNotes(e.target.value)}
        />
      </div>
      <div className="mt-6">
        <FieldLabel>Vocabulary Level</FieldLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {VOCAB_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setVocabulary(level)}
              className={`px-3 py-2 rounded-sm border font-sans text-[11px] font-bold uppercase tracking-widest transition-colors ${
                vocabulary === level ? 'bg-primary text-parchment border-primary' : 'bg-sepia-highest/40 text-ink border-oak-variant hover:bg-sepia-highest'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const renderStructure = () => (
    <>
      <div className="mb-8">
        <span className="font-sans text-[10px] text-ink-muted uppercase font-bold tracking-widest">Step 3 - Structure</span>
        <h2 className="text-4xl font-semibold italic text-primary mt-2">Choose the book's skeleton.</h2>
      </div>
      <div>
        <FieldLabel>Structure Preset</FieldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STRUCTURE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setStructurePreset(preset)}
              className={`min-h-20 text-left p-4 rounded-sm border font-serif text-sm italic transition-all ${
                structurePreset === preset
                  ? 'border-primary bg-amber-wax-container/20 text-primary shadow-sm'
                  : 'border-oak-variant bg-sepia-highest/30 text-ink hover:border-oak'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-7">
        <FieldLabel>Chapter Naming</FieldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CHAPTER_NAMING.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setChapterNaming(option)}
              className={`px-3 py-2 rounded-sm border text-left font-sans text-[11px] font-bold uppercase tracking-widest transition-colors ${
                chapterNaming === option ? 'bg-primary text-parchment border-primary' : 'bg-sepia-highest/40 text-ink border-oak-variant hover:bg-sepia-highest'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-7">
        <FieldLabel>Narrative Present</FieldLabel>
        <input
          className="w-full bg-sepia-highest/30 border border-oak-variant rounded-sm px-3 py-3 font-serif text-sm italic text-primary placeholder:text-oak-variant focus:outline-none focus:border-primary"
          placeholder="October 1943, Year 4 of the Collapse..."
          value={narrativePresent}
          onChange={(e) => setNarrativePresent(e.target.value)}
        />
      </div>
    </>
  );

  const renderCharacters = () => (
    <>
      <div className="mb-8">
        <span className="font-sans text-[10px] text-ink-muted uppercase font-bold tracking-widest">Step 4 - Seed Characters</span>
        <h2 className="text-4xl font-semibold italic text-primary mt-2">Name the first voices.</h2>
      </div>
      <div className="space-y-3">
        {characters.length === 0 ? (
          <div className="border border-dashed border-oak-variant rounded-sm bg-sepia-highest/20 p-8 text-center">
            <p className="font-serif italic text-oak">Characters are optional. Add up to five seeds for review.</p>
          </div>
        ) : null}
        {characters.map((character, index) => (
          <div key={character.id} className="border border-oak-variant rounded-sm bg-sepia-low/20 p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 text-oak">
                <GripVertical className="w-4 h-4" />
                <span className="font-sans text-[10px] uppercase tracking-widest font-bold">Character {index + 1}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="w-7 h-7 rounded-sm bg-sepia-highest/50 border border-oak-variant text-oak hover:text-primary cursor-pointer"
                  onClick={() => moveCharacter(character.id, -1)}
                  disabled={index === 0}
                  title="Move up"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mx-auto rotate-90" />
                </button>
                <button
                  type="button"
                  className="w-7 h-7 rounded-sm bg-sepia-highest/50 border border-oak-variant text-oak hover:text-primary cursor-pointer"
                  onClick={() => moveCharacter(character.id, 1)}
                  disabled={index === characters.length - 1}
                  title="Move down"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mx-auto -rotate-90" />
                </button>
                <button
                  type="button"
                  className="w-7 h-7 rounded-sm bg-sepia-highest/50 border border-oak-variant text-oak hover:text-primary cursor-pointer"
                  onClick={() => removeCharacter(character.id)}
                  title="Delete character"
                >
                  <Trash2 className="w-3.5 h-3.5 mx-auto" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="bg-sepia-highest/30 border border-oak-variant rounded-sm px-3 py-2 font-serif text-sm italic text-primary placeholder:text-oak-variant focus:outline-none focus:border-primary"
                placeholder="Name"
                value={character.name}
                onChange={(e) => updateCharacter(character.id, {name: e.target.value})}
              />
              <input
                className="bg-sepia-highest/30 border border-oak-variant rounded-sm px-3 py-2 font-serif text-sm italic text-primary placeholder:text-oak-variant focus:outline-none focus:border-primary"
                placeholder="Role"
                list="character-roles"
                value={character.role}
                onChange={(e) => updateCharacter(character.id, {role: e.target.value})}
              />
              <input
                className="sm:col-span-2 bg-sepia-highest/30 border border-oak-variant rounded-sm px-3 py-2 font-serif text-sm italic text-primary placeholder:text-oak-variant focus:outline-none focus:border-primary"
                placeholder="One-line description"
                value={character.description}
                onChange={(e) => updateCharacter(character.id, {description: e.target.value})}
              />
            </div>
            <label className="mt-3 inline-flex items-center gap-2 font-sans text-[10px] uppercase tracking-widest font-bold text-oak cursor-pointer">
              <input
                type="checkbox"
                checked={character.pov}
                onChange={(e) => updateCharacter(character.id, {pov: e.target.checked})}
                className="accent-[#7c5138]"
              />
              POV character
            </label>
          </div>
        ))}
        <datalist id="character-roles">
          {ROLES.map((role) => (
            <option key={role} value={role} />
          ))}
        </datalist>
      </div>
      <button
        type="button"
        className="mt-5 px-4 py-2 rounded-sm border border-oak-variant bg-sepia-highest/40 font-sans text-[11px] uppercase tracking-widest font-bold text-ink hover:bg-sepia-highest disabled:opacity-40 cursor-pointer"
        onClick={addCharacter}
        disabled={characters.length >= 5}
      >
        <Plus className="inline w-3.5 h-3.5 mr-1 align-[-2px]" />
        Add another character
      </button>
    </>
  );

  const renderReview = () => (
    <>
      <div className="mb-8">
        <span className="font-sans text-[10px] text-ink-muted uppercase font-bold tracking-widest">Step 5 - Review & Create</span>
        <h2 className="text-4xl font-semibold italic text-primary mt-2">Ready the blank page.</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5">
        <div className="space-y-3">
          {[
            {label: 'Identity', edit: 0, value: title.trim() || 'Untitled Manuscript', meta: [subtitle, selectedGenres.join(', '), `${parsedTargetWords.toLocaleString()} words`].filter(Boolean).join(' / ')},
            {label: 'Style', edit: 1, value: `${povType}, ${tense.toLowerCase()} tense`, meta: `${styleDescriptor}; ${vocabulary.toLowerCase()} vocabulary`},
            {label: 'Structure', edit: 2, value: structurePreset, meta: [chapterNaming, narrativePresent].filter(Boolean).join(' / ') || 'No timeline anchor yet'},
            {label: 'Characters', edit: 3, value: validCharacters.length ? `${validCharacters.length} seeded` : 'Skipped for now', meta: validCharacters.map((character) => character.name.trim()).join(', ')},
          ].map((section) => (
            <section key={section.label} className="border border-oak-variant rounded-sm bg-sepia-low/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-sans text-[10px] text-oak uppercase font-bold tracking-widest">{section.label}</h3>
                  <p className="font-serif text-lg italic text-primary mt-1">{section.value}</p>
                  {section.meta ? <p className="font-sans text-xs text-ink-muted mt-1 leading-relaxed">{section.meta}</p> : null}
                </div>
                <button
                  type="button"
                  className="bg-transparent border-none p-0 font-sans text-[10px] uppercase tracking-widest font-bold text-oak hover:text-primary cursor-pointer"
                  onClick={() => goToStep(section.edit)}
                >
                  Edit
                </button>
              </div>
            </section>
          ))}
          {styleNotes.trim() ? (
            <section className="border border-oak-variant rounded-sm bg-sepia-low/20 p-4">
              <h3 className="font-sans text-[10px] text-oak uppercase font-bold tracking-widest">Style Notes</h3>
              <p className="font-serif text-sm italic text-primary mt-2 leading-relaxed">{styleNotes.trim()}</p>
            </section>
          ) : null}
        </div>
        <div className="border border-oak-variant rounded-sm bg-parchment-bright/60 p-4">
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 bg-transparent border-none p-0 text-left cursor-pointer"
            onClick={() => setFileTreeOpen((open) => !open)}
          >
            <h3 className="font-sans text-[10px] text-oak uppercase font-bold tracking-widest">Planned Wiki Files</h3>
            <ChevronDown className={`w-4 h-4 text-oak transition-transform ${fileTreeOpen ? '' : '-rotate-90'}`} />
          </button>
          {fileTreeOpen ? (
            <div className="font-mono text-[12px] leading-6 text-ink mt-3">
              <p>story/</p>
              <p className="pl-4">style.md</p>
              <p className="pl-4">motifs.md</p>
              <p className="pl-4">timeline.md</p>
              <p className="pl-4">unresolved_threads.md</p>
              <p className="pl-4">characters/</p>
              {validCharacters.length ? (
                validCharacters.map((character) => <p key={character.id} className="pl-8">{character.name.trim().toLowerCase().replace(/\s+/g, '-')}.md</p>)
              ) : (
                <p className="pl-8 text-oak">empty for now</p>
              )}
              <p>chapter_summaries/</p>
            </div>
          ) : null}
          <p className="mt-4 font-sans text-[11px] leading-relaxed text-ink-muted">
            The current backend creates the compatible project skeleton. Style, structure, and character details are reviewed here only until the creation API accepts richer setup data.
          </p>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-parchment-dim paper-grain">
      <header className="fixed top-0 left-0 right-0 h-10 flex justify-between items-center px-6 z-10 bg-parchment-bright/80 border-b border-oak-variant text-ink font-serif text-sm pointer-events-none">
        <div className="flex items-center gap-6">
          <span className="italic text-xl font-bold">LiteAuthor</span>
          <nav className="hidden sm:flex items-center gap-4">
            <span className="border-b border-ink pb-0.5">Project</span>
            <span>Chapter</span>
            <span>Scene</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span>-</span>
          <Hourglass className="w-4 h-4" />
          <Settings className="w-4 h-4" />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden px-4 pb-6 pt-14 sm:px-6">
        <div className="bg-parchment-bright mx-auto flex h-full min-h-0 w-full max-w-[920px] flex-col overflow-hidden stacked-paper relative">
          <div className="h-2 w-full bg-sepia-highest deckle-edge absolute top-0 left-0 rotate-180" />

          <div className="shrink-0 px-6 sm:px-10 pt-9 pb-4 border-b border-oak-variant bg-parchment-bright/95 relative z-20">
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                className="font-sans text-[10px] font-bold text-oak hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-widest bg-transparent border-none cursor-pointer"
                onClick={() => (step === 0 ? onNavigate(exitTarget, 'push_back') : goToStep(step - 1))}
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
              <p className="font-sans text-[10px] text-ink-muted uppercase font-bold tracking-widest text-center">
                Step {step + 1} of {STEPS.length}: {STEPS[step]}
              </p>
              <button
                type="button"
                className="font-sans text-[10px] font-bold text-oak hover:text-primary transition-colors uppercase tracking-widest bg-transparent border-none cursor-pointer"
                onClick={() => (step === STEPS.length - 1 ? void finish() : skipStep())}
              >
                {step === 0 ? 'Exit' : step === STEPS.length - 1 ? 'Create' : 'Skip'}
              </button>
            </div>
            <div className="mt-5 flex justify-center gap-2">
              {STEPS.map((stepName, index) => (
                <button
                  key={stepName}
                  type="button"
                  onClick={() => goToStep(index)}
                  className={`w-2 h-2 rounded-full border-none transition-all cursor-pointer ${
                    index === step ? 'bg-primary scale-125' : index < step ? 'bg-amber-wax-container' : 'bg-oak-variant'
                  }`}
                  aria-label={`Go to ${stepName}`}
                />
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 pb-12 sm:p-10 sm:pb-14 lg:p-12 lg:pb-16">
            <div className="w-full max-w-[720px] mx-auto">
              {step === 0 ? renderIdentity() : null}
              {step === 1 ? renderStyle() : null}
              {step === 2 ? renderStructure() : null}
              {step === 3 ? renderCharacters() : null}
              {step === 4 ? renderReview() : null}
              {err ? <p className="mt-6 text-sm text-red-700 font-sans">{err}</p> : null}
            </div>
          </div>

          <div className="shrink-0 p-5 sm:px-10 border-t border-oak-variant flex flex-wrap items-center justify-between gap-4 bg-sepia-low relative z-20">
            <div className="hidden sm:flex items-center gap-2 text-oak font-sans text-[10px] uppercase tracking-widest font-bold">
              {STEPS.map((stepName, index) => (
                <span key={stepName} className={index === step ? 'text-primary' : ''}>
                  {index < step ? <Check className="w-3 h-3 inline align-[-2px]" /> : index + 1}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 ml-auto">
              {step > 0 ? (
                <button
                  type="button"
                  className="px-5 py-3 rounded-sm border border-oak-variant bg-transparent font-sans text-[10px] font-bold text-oak hover:text-primary uppercase tracking-widest cursor-pointer"
                  onClick={() => goToStep(step - 1)}
                >
                  Back
                </button>
              ) : null}
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  className="bg-primary text-parchment-bright px-8 py-3 rounded-sm font-sans text-xs font-bold uppercase tracking-[0.1em] hover:bg-amber-wax active:scale-95 transition-all border border-primary cursor-pointer"
                  onClick={continueWizard}
                >
                  Continue <ArrowRight className="inline w-3.5 h-3.5 ml-1 align-[-2px]" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className="bg-primary text-parchment-bright px-8 py-3 rounded-sm font-sans text-xs font-bold uppercase tracking-[0.1em] hover:bg-amber-wax active:scale-95 transition-all border border-primary cursor-pointer disabled:opacity-50"
                  onClick={() => void finish()}
                >
                  {busy ? 'Creating...' : 'Create Project'}
                </button>
              )}
            </div>
          </div>

          <div className="h-2 w-full bg-sepia-highest deckle-edge absolute bottom-0 left-0" />
        </div>
      </main>
    </div>
  );
}
