"use client"
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseSRT, SubtitleCue } from '@/lib/srtParser';

interface WordAnalysis {
  word: string;
  translation: string;
  root: string;
  type: string;
  explanation: string;
}

const fallbackArabicCues: SubtitleCue[] = [
  { id: 1, startTime: 0.5, endTime: 4.8, text: "أَعْتَذِرُ يَا سُمُوَّ الأَمِيرِ لِتَأَخُّرِي." },
  { id: 2, startTime: 5.2, endTime: 9.8, text: "لُورَنْس؟ إِنَّهُ دَائِمًا يَتَأَخَّرُ، وَأَظُنُّهُ يَتَعَمَّدُ ذَلِكَ." },
  { id: 3, startTime: 10.2, endTime: 15.0, text: "مُحَاضَرَتِي فِي المَعْهَدِ تَأَخَّرَتْ كَثِيرًا. أَنْتَ رَجُلٌ مَطْلُوبٌ جِدًّا." }
];

const fallbackSimpleArabicCues: SubtitleCue[] = [
  { id: 1, startTime: 0.5, endTime: 4.8, text: "أَعْتَذِرْ يَا سُمُوَّ الأَمِير لِأَنِّي تَأَخَّرْت." },
  { id: 2, startTime: 5.2, endTime: 9.8, text: "لُورَنْس؟ هَذَا دَايِمْ يَتَأَخَّرْ، مُتَأَكِّدْ إِنَّهُ يَقْصِدْهَا." },
  { id: 3, startTime: 10.2, endTime: 15.0, text: "مُحَاضَرَتِي بِالمَعْهَدْ طَوَّلَتْ مَرَّة. الكِلْ يَبِيكْ وَمَطْلُوبْ حِيلْ." }
];

const fallbackEnglishCues: SubtitleCue[] = [
  { id: 1, startTime: 0.5, endTime: 4.8, text: "Your Royal Highness, forgive me for my delay." },
  { id: 2, startTime: 5.2, endTime: 9.8, text: "Lawrence? He's always late. Does it deliberately, I'm sure." },
  { id: 3, startTime: 10.2, endTime: 15.0, text: "My lecture at the RGS overran horribly. You are in great demand." }
];

const fallbackDictionary: Record<string, WordAnalysis> = {
  "أَعْتَذِرُ": { word: "أَعْتَذِرُ", translation: "I apologize", root: "ع - ذ - ر", type: "فعل مضارع مرفوع", explanation: "أبدي أسفاً وقدّم عذراً." },
  "اعتذر": { word: "اعْتَذَرَ", translation: "To apologize", root: "ع - ذ - ر", type: "فعل ماضٍ", explanation: "أبدى أسفاً وقدّم عذراً." },
  "سمو": { word: "سُمُوّ", translation: "Highness", root: "س - م - و", type: "اسم مرفوع", explanation: "لقب تفخيم ورفعة مستخدم للأمراء." },
  "الأمير": { word: "الأَمِير", translation: "The Prince", root: "أ - م - ر", type: "اسم معرف", explanation: "من يتولى الحكم أو الإمارة." },
  "لتأخري": { word: "لِتَأَخُّرِي", translation: "For my delay", root: "أ - خ - ر", type: "اسم + ضمير", explanation: "مكون من الاسم تأخر وياء المتكلم." },
  "لورنس": { word: "لُورَنْس", translation: "Lawrence", root: "أعجمي", type: "اسم علم أعجمي", explanation: "اسم علم مذكر غربي." },
  "دائماً": { word: "دَائِمًا", translation: "Always", root: "د - و - م", type: "ظرف زمان", explanation: "يعني الاستمرار وعدم الانقطاع." },
  "يتأخر": { word: "يَتَأَخَّرُ", translation: "He delays", root: "أ - خ - ر", type: "فعل مضارع", explanation: "تبطأ ولم يأتِ في الموعد." }
};

export default function App() {
  const [appState, setAppState] = useState<'welcome' | 'loading' | 'player'>('welcome');
  const [loadingStep, setLoadingStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(438);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<'native' | 'english' | 'arabic-standard' | 'arabic-simplified'>('arabic-standard');
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState<'standard' | 'simplified' | 'english' | 'none'>('standard');
  const [activeSubtitle, setActiveSubtitle] = useState<string>('');
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [selectedWordDetails, setSelectedWordDetails] = useState<WordAnalysis | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const audioEnRef = useRef<HTMLAudioElement | null>(null);
  const audioArStdRef = useRef<HTMLAudioElement | null>(null);
  const audioArSimpRef = useRef<HTMLAudioElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodesRef = useRef<Record<string, GainNode>>({});
  const sourcesRef = useRef<Record<string, MediaElementAudioSourceNode>>({});
  const masterGainRef = useRef<GainNode | null>(null);

  const steps = [
    { label: "تحميل ملف الفيديو الرئيسي...", duration: 500 },
    { label: "التعرف اللحظي على مسار الصوت الأساسي...", duration: 600 },
    { label: "فحص واستخراج ملفات الترجمة المصاصبة (WebVTT)...", duration: 500 },
    { label: "ربط الصوت العربي الفصيح ومزامنته بذاكرة التخزين...", duration: 500 },
    { label: "توليد الملف اللغوي والتوصيف الصرفي للمتعلمين المبتدئين...", duration: 600 },
    { label: "جهاز مشغل اللغات جاهز بالكامل للتشغيل!", duration: 400 }
  ];

  const [arabicCues, setArabicCues] = useState<SubtitleCue[]>(fallbackArabicCues);
  const [simpleArabicCues, setSimpleArabicCues] = useState<SubtitleCue[]>(fallbackSimpleArabicCues);
  const [englishCues, setEnglishCues] = useState<SubtitleCue[]>(fallbackEnglishCues);
  const [dictionary, setDictionary] = useState<Record<string, WordAnalysis>>(fallbackDictionary);

  useEffect(() => {
    async function loadResources() {
      try {
        const [arRes, simpleArRes, enRes, dictRes] = await Promise.all([
          fetch('/arabic.srt'),
          fetch('/arabic_simple.srt'),
          fetch('/english.srt'),
          fetch('/dictionary.json')
        ]);

        if (arRes.ok) {
          const arText = await arRes.text();
          setArabicCues(parseSRT(arText));
        }
        if (simpleArRes.ok) {
          const simpleArText = await simpleArRes.text();
          setSimpleArabicCues(parseSRT(simpleArText));
        }
        if (enRes.ok) {
          const enText = await enRes.text();
          setEnglishCues(parseSRT(enText));
        }
        if (dictRes.ok) {
          const dictData = await dictRes.json();
          setDictionary(dictData);
        }
      } catch (error) {
        console.error("حدث خطأ أثناء تحميل ملفات الترجمة أو القاموس الموحد:", error);
      }
    }

    loadResources();
  }, []);

  const handleStartAnalysis = (file: File | null) => {
    setUploadedFile(file);
    setAppState('loading');
    setLoadingStep(0);
  };

  useEffect(() => {
    if (appState !== 'loading') return;

    if (loadingStep < steps.length) {
      const timer = setTimeout(() => {
        setLoadingStep(prev => prev + 1);
      }, steps[loadingStep].duration);
      return () => clearTimeout(timer);
    } else {
      const transitionTimer = setTimeout(() => {
        setAppState('player');
        initializeWebAudio();
      }, 500);
      return () => clearTimeout(transitionTimer);
    }
  }, [appState, loadingStep]);

  const initializeWebAudio = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(volume, ctx.currentTime);
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      const setupTrack = (id: string, element: HTMLAudioElement) => {
        if (!ctx || sourcesRef.current[id]) return;
        const source = ctx.createMediaElementSource(element);
        const gainNode = ctx.createGain();
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        source.connect(gainNode);
        gainNode.connect(masterGain);

        sourcesRef.current[id] = source;
        gainNodesRef.current[id] = gainNode;
      };

      if (audioEnRef.current) setupTrack('english', audioEnRef.current);
      if (audioArStdRef.current) setupTrack('arabic-standard', audioArStdRef.current);
      if (audioArSimpRef.current) setupTrack('arabic-simplified', audioArSimpRef.current);

    } catch (e) {
      console.warn("فشل تهيئة نظام مزج الصوت الرقمي Web Audio Mixer:", e);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncTracks = () => {
      const targetTime = video.currentTime;
      const audios = [audioEnRef.current, audioArStdRef.current, audioArSimpRef.current];
      
      audios.forEach(audio => {
        if (audio && Math.abs(audio.currentTime - targetTime) > 0.1) {
          audio.currentTime = targetTime;
        }
      });
    };

    video.addEventListener('timeupdate', syncTracks);
    video.addEventListener('seeking', syncTracks);
    return () => {
      video.removeEventListener('timeupdate', syncTracks);
      video.removeEventListener('seeking', syncTracks);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const ctx = audioContextRef.current;
    if (!video) return;

    if (selectedAudioTrack === 'native') {
      video.muted = isMuted;
      video.volume = volume;
      
      if (ctx) {
        Object.keys(gainNodesRef.current).forEach(key => {
          const gainNode = gainNodesRef.current[key];
          gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        });
      }
    } else {
      video.muted = true;

      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        Object.keys(gainNodesRef.current).forEach(key => {
          const gainNode = gainNodesRef.current[key];
          const targetVal = (key === selectedAudioTrack && !isMuted) ? 1.0 : 0.0;
          
          gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
          gainNode.gain.linearRampToValueAtTime(targetVal, ctx.currentTime + 0.15);
        });
      }
    }
  }, [selectedAudioTrack, isMuted, volume]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const audios = [audioEnRef.current, audioArStdRef.current, audioArSimpRef.current];

    if (isPlaying) {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }

      video.play().catch(err => console.log("تم اعتراض بدء التشغيل التلقائي:", err));
      audios.forEach(audio => {
        if (audio) {
          audio.play().catch(() => {});
        }
      });
    } else {
      video.pause();
      audios.forEach(audio => {
        if (audio) audio.pause();
      });
    }
  }, [isPlaying]);

  useEffect(() => {
    if (masterGainRef.current && audioContextRef.current) {
      const targetVolume = isMuted ? 0 : volume;
      masterGainRef.current.gain.setValueAtTime(targetVolume, audioContextRef.current.currentTime);
    }
  }, [volume, isMuted]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    setCurrentTime(video.currentTime);

    if (selectedSubtitleTrack === 'none') {
      setActiveSubtitle('');
      return;
    }

    const currentCues = selectedSubtitleTrack === 'standard' 
      ? arabicCues 
      : selectedSubtitleTrack === 'simplified' 
        ? simpleArabicCues 
        : englishCues;

    const currentCue = currentCues.find(
      cue => video.currentTime >= cue.startTime && video.currentTime <= cue.endTime
    );

    if (currentCue) {
      setActiveSubtitle(currentCue.text);
    } else {
      setActiveSubtitle('');
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = val;
    setCurrentTime(val);

    const audios = [audioEnRef.current, audioArStdRef.current, audioArSimpRef.current];
    audios.forEach(audio => {
      if (audio) audio.currentTime = val;
    });
  };

  const getCleanWord = (word: string): string => {
    return word.trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?؟،;]/g, "")
      .replace(/[\u064B-\u065F]/g, ""); // تنظيف علامات التشكيل والتنوين
  };

  const handleWordClick = (word: string) => {
    const clean = getCleanWord(word);
    const details = dictionary[clean];
    
    setIsPlaying(false);

    if (details) {
      setSelectedWordDetails({ ...details, word: word });
    } else {
      setSelectedWordDetails({
        word: word,
        translation: "Interactive Lookup",
        root: "N/A",
        type: "إدخال لغوي سياقي",
        explanation: `الكلمة "${word}" مستخرجة من سياق الحوار النشط ومتاحة لعمليات الفحص الصرفي المباشرة بذاكرة المشغل.`
      });
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground font-sans flex flex-col justify-between overflow-x-hidden select-none">
      
      {/* Hidden background multitrack audio players synced dynamically */}
      <audio ref={audioEnRef} src="/english.wav" preload="auto" />
      <audio ref={audioArStdRef} src="/arabic_standard.wav" preload="auto" />
      <audio ref={audioArSimpRef} src="/arabic_simplified.wav" preload="auto" />

      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/20">
          <svg className="w-6 h-6 animate-pulse" fill="green" viewBox="0 0 80 80" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M 55.00,24.00
                  C 48.64,28.39 31.69,35.07 24.00,37.07
                    20.27,37.93 13.68,38.75 10.10,37.07
                    3.41,34.14 0.97,16.25 15.00,13.20
                    25.97,10.82 15.84,21.42 20.74,26.40
                    23.84,29.56 31.44,26.21 35.00,25.00
                    35.00,25.00 62.00,12.81 62.00,12.81
                    64.44,11.80 69.99,9.14 72.38,11.04
                    74.63,12.82 72.70,16.16 71.61,18.00
                    71.61,18.00 59.87,35.00 59.87,35.00
                    58.41,37.66 51.25,50.80 57.09,46.64
                    57.25,48.17 63.26,59.48 58.26,66.95
                    53.90,73.39 43.06,76.73 40.32,66.95
                    38.17,59.36 41.45,49.97 44.43,43.00
                    49.16,31.93 51.40,31.91 55.00,24.00 Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              مشغل تيسير <span className="text-xs px-2.5 py-0.5 bg-secondary text-secondary-foreground font-medium rounded-full border border-border font-mono">v2.0 SRT & Audio Matrix</span>
            </h1>
            <p className="text-xs text-muted-foreground">للتعليم والاستماع المتدرج ومطابقة القواميس الحية</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {appState === 'player' && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/40 rounded-lg border border-border">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-mono">تزامن الصوت والترجمات نشط</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col justify-center items-center">
        
        {/* Welcome state panel */}
        {appState === 'welcome' && (
          <div className="w-full max-w-3xl">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold tracking-tight mb-2">المشغل التفاعلي لتعلم العربية بالصوت والترجمة المصاحبة</h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
                قم بسحب وإفلات ملف الفيديو المخصص لديك لفرزه، أو قم بتشغيل العرض التوضيحي المباشر مع جلب ملفات القاموس والـ SRT المتزامنة بالكامل من الذاكرة العامة.
              </p>
            </div>

            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleStartAnalysis(e.dataTransfer.files[0]);
                }
              }}
              className="group border-2 border-dashed border-border hover:border-primary/50 transition-all duration-300 bg-card rounded-2xl p-10 text-center cursor-pointer relative shadow-md hover:shadow-lg overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex flex-col items-center justify-center space-y-4 relative z-10">
                <div className="p-4 bg-accent rounded-full border border-border group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-lg text-foreground">اسحب وأفلت الفيديو الخاص بك هنا (.mkv, .mp4)</p>
                  <p className="text-xs text-muted-foreground mt-1">يدعم حاويات الوسائط المتكاملة وقراءة ملفات الـ SRT الفردية</p>
                </div>
                <div className="flex items-center gap-2 py-1 px-3 bg-secondary rounded-lg border border-border text-xs text-muted-foreground">
                  أو انقر هنا لتصفح الملفات من جهازك
                </div>
                
                <input 
                  type="file" 
                  accept="video/*" 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleStartAnalysis(e.target.files[0]);
                    }
                  }}
                />
              </div>
            </div>

            <div className="mt-6 bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-xl">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-sm">تشغيل العرض التوضيحي السريع</h4>
                  <p className="text-xs text-muted-foreground">اختبر على الفور محرك الفرز وقراءة نصوص SRT التفاعلية والقاموس المرفق.</p>
                </div>
              </div>
              <button 
                onClick={() => handleStartAnalysis(null)}
                className="w-full md:w-auto flex items-center justify-center gap-2 py-2.5 px-5 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-xl transition-all shadow-md text-sm active:scale-[0.98]"
              >
                ابدأ تشغيل برنامج تعلم العربية
              </button>
            </div>
          </div>
        )}

        {/* Loading and profiling state */}
        {appState === 'loading' && (
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl p-6 md:p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
              <svg className="w-5 h-5 text-primary animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
              </svg>
              <div>
                <h3 className="font-bold text-lg text-foreground">جاري معالجة وتخطيط حاوية الفيديو</h3>
                <p className="text-xs text-muted-foreground">فهرسة الحزم اللغوية وتحليل علامات الـ SRT الزمنية وقراءة القاموس الموحد...</p>
              </div>
            </div>

            {uploadedFile && (
              <div className="bg-secondary/40 border border-border rounded-lg p-3.5 mb-6 flex items-center gap-3" dir="ltr">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <div className="text-left text-xs">
                  <p className="font-semibold text-foreground truncate max-w-md">{uploadedFile.name}</p>
                  <p className="text-muted-foreground mt-0.5">{(uploadedFile.size / (1024 * 1024)).toFixed(2)} ميغابايت • تم تحديد ملف الوسائط</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {steps.map((step, idx) => {
                const isCompleted = loadingStep > idx;
                const isCurrent = loadingStep === idx;
                
                return (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                      isCompleted 
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600' 
                        : isCurrent 
                          ? 'border-primary/30 bg-primary/5 text-foreground shadow-sm ring-1 ring-primary/20' 
                          : 'border-border bg-card/50 text-muted-foreground opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isCompleted ? (
                        <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : isCurrent ? (
                        <span className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-border flex items-center justify-center text-xs font-semibold shrink-0">
                          {idx + 1}
                        </div>
                      )}
                      <span className="text-sm font-medium">{step.label}</span>
                    </div>
                    {isCompleted && (
                      <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-600 font-semibold rounded">
                        مكتمل
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 bg-secondary h-2 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: '0%' }}
                animate={{ width: `${(loadingStep / steps.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Player UI state with active controls and dictionary lookup panel */}
        {appState === 'player' && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            <div className="lg:col-span-3 flex flex-col space-y-4">
              
              {/* Primary Video Container */}
              <div 
                ref={containerRef}
                className="relative aspect-video rounded-2xl bg-black border border-border shadow-2xl overflow-hidden group flex flex-col justify-between"
              >
                <video
                  ref={videoRef}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-cover"
                  src="/main.mp4"
                  playsInline
                />

                {!isPlaying && (
                  <div 
                    onClick={() => setIsPlaying(true)}
                    className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center cursor-pointer transition-colors hover:bg-black/50"
                  >
                    <div className="w-16 h-16 rounded-full bg-primary/95 text-primary-foreground flex items-center justify-center shadow-2xl transform hover:scale-110 active:scale-95 transition-all">
                      <svg className="w-8 h-8 fill-current translate-x-[-2px]" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Subtitle Board OUTSIDE the Video Frame */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-md text-center min-h-[120px] flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-2 right-3 flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  الترجمة التفاعلية الفورية من ملفات الـ SRT المزامنة
                </div>
                
                <AnimatePresence mode="wait">
                  {activeSubtitle ? (
                    <motion.div 
                      key={activeSubtitle}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="w-full space-y-3"
                    >
                      <div 
                        className="flex flex-wrap justify-center gap-y-3 gap-x-2 text-2xl md:text-3xl font-bold select-text font-sans text-foreground" 
                        dir={selectedSubtitleTrack === "english"? "ltr": "rtl"}
                      >
                        {activeSubtitle.split(" ").map((word, wordIdx) => {
                          const clean = getCleanWord(word);
                          const hasTranslation = !!dictionary[clean];
                          return (
                            <div key={wordIdx} className="relative group/word">
                              <span 
                                onClick={() => handleWordClick(word)}
                                onMouseEnter={() => setHoveredWord(word)}
                                onMouseLeave={() => setHoveredWord(null)}
                                className={`cursor-pointer transition-all duration-150 inline-block px-1 rounded-md py-0.5 border-b-2 ${
                                  hasTranslation 
                                    ? 'border-primary/60 hover:bg-primary/20 hover:text-primary text-foreground font-black' 
                                    : 'border-border hover:bg-accent hover:text-accent-foreground text-foreground/90'
                                }`}
                              >
                                {word}
                              </span>

                              {/* Hover tooltip card */}
                              {hoveredWord === word && hasTranslation && (
                                <div 
                                  className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 bg-popover text-popover-foreground text-xs px-3 py-1.5 rounded-lg shadow-xl border border-border font-sans font-medium whitespace-nowrap z-50 flex items-center gap-1.5"
                                  dir="ltr"
                                >
                                  <span>{dictionary[clean].translation}</span>
                                  <span className="text-[10px] text-muted-foreground opacity-75">(انقر)</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="text-muted-foreground text-xs italic flex items-center gap-2">
                      <span>لا توجد ترجمة نشطة حالياً ضمن هذا المدى الزمني للفيديو.</span>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Player control board */}
              <div className="bg-card border border-border rounded-2xl p-4 shadow-md space-y-4">
                
                <div className="flex items-center gap-3" dir="ltr">
                  <span className="text-xs font-mono text-muted-foreground">{Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')}</span>
                  <input 
                    type="range"
                    min="0"
                    max={duration}
                    step="0.05"
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition shadow-sm"
                    >
                      {isPlaying ? (
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>

                    <button 
                      onClick={() => {
                        const video = videoRef.current;
                        if (video) video.currentTime = 0;
                        const audios = [audioEnRef.current, audioArStdRef.current, audioArSimpRef.current];
                        audios.forEach(audio => {
                          if (audio) audio.currentTime = 0;
                        });
                      }}
                      className="p-2.5 bg-secondary text-secondary-foreground hover:bg-secondary/85 border border-border rounded-xl transition"
                      title="إعادة تشغيل المقطع"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
                      </svg>
                    </button>

                    <div className="flex items-center gap-2 border-r border-border pr-3">
                      <button onClick={() => setIsMuted(!isMuted)} className="text-muted-foreground hover:text-foreground">
                        {isMuted || volume === 0 ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          </svg>
                        )}
                      </button>
                      <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-20 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  </div>

                  {/* Audio track mixer selector */}
                  <div className="flex items-center gap-3 flex-wrap">
                    
                    <div className="flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-xl border border-border">
                      <span className="text-xs font-semibold text-muted-foreground ml-1">المسار الصوتي (المزج):</span>
                      <select 
                        value={selectedAudioTrack}
                        onChange={(e) => setSelectedAudioTrack(e.target.value as any)}
                        className="bg-transparent border-none text-xs font-medium focus:ring-0 cursor-pointer text-foreground pl-4"
                      >
                        {/* <option value="native" className="bg-card text-foreground">مسار الفيديو الأصلي (.mp4)</option> */}
                        <option value="english" className="bg-card text-foreground">الترجمة الإنجليزية الصوتية (.wav)</option>
                        <option value="arabic-standard" className="bg-card text-foreground">صوت العربية الفصحى (.wav)</option>
                        <option value="arabic-simplified" className="bg-card text-foreground">صوت العربية المبسطة (.wav)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-xl border border-border">
                      <span className="text-xs font-semibold text-muted-foreground ml-1">مسار الترجمة:</span>
                      <select 
                        value={selectedSubtitleTrack}
                        onChange={(e) => setSelectedSubtitleTrack(e.target.value as any)}
                        className="bg-transparent border-none text-xs font-medium focus:ring-0 cursor-pointer text-foreground pl-4"
                      >
                        <option value="standard" className="bg-card text-foreground">العربية الفصحى</option>
                        <option value="simplified" className="bg-card text-foreground">العربية المبسطة</option>
                        <option value="english" className="bg-card text-foreground">الإنجليزية (English)</option>
                        {/* <option value="none" className="bg-card text-foreground">إيقاف الترجمة</option> */}
                      </select>
                    </div>

                  </div>

                </div>

              </div>

            </div>

            {/* Morphology dictionary lookup dashboard */}
            <div className="lg:col-span-1 flex flex-col space-y-4 h-full">
              
              <div className="bg-card border border-border rounded-2xl p-5 shadow-md flex-1 flex flex-col justify-between min-h-[420px]">
                
                <div>
                  <div className="flex items-center justify-between border-b border-border pb-3.5 mb-4">
                    <h3 className="font-bold text-sm tracking-wide text-foreground uppercase flex items-center gap-2">
                      التحليل اللغوي والصرفي
                    </h3>
                    <span className="text-[11px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                      العربية للناطقين بغيرها
                    </span>
                  </div>

                  {selectedWordDetails ? (
                    <motion.div 
                      key={selectedWordDetails.word}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-4 text-right"
                    >
                      <div className="bg-accent/40 rounded-xl p-4 text-center border border-border relative">
                        <button 
                          onClick={() => setSelectedWordDetails(null)}
                          className="absolute top-2 left-2 p-1 hover:bg-accent rounded-md transition text-muted-foreground"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <h2 className="text-4xl font-bold text-primary tracking-wide mb-1 leading-normal" dir={selectedSubtitleTrack=== "english"? "ltr":"rtl"}>
                          {selectedWordDetails.word}
                        </h2>
                        <span className="text-xs px-2.5 py-0.5 bg-background text-muted-foreground border border-border rounded-full font-semibold">
                          {selectedWordDetails.type}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">المقابل بالإنجليزية (Translation)</h4>
                        <p className="text-base font-semibold text-foreground" dir="ltr">{selectedWordDetails.translation}</p>
                      </div>

                      <div>
                        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">الحروف الجذرية للكلمة (الْجِذْر)</h4>
                        <div className="flex gap-2 justify-start" dir="rtl">
                          {(selectedWordDetails.root || "N/A").split("-").map((char, charIdx) => (
                            <span 
                              key={charIdx} 
                              className="w-8 h-8 rounded-lg bg-secondary text-secondary-foreground border border-border flex items-center justify-center font-bold text-sm"
                            >
                              {char.trim()}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">الشرح الصرفي والبنية الهيكلية</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {selectedWordDetails.explanation}
                        </p>
                      </div>

                    </motion.div>
                  ) : (
                    <div className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
                      <div className="p-3 bg-secondary rounded-full border border-border">
                        <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">لم يتم تحديد كلمة</p>
                        <p className="text-xs text-muted-foreground max-w-[200px] mx-auto mt-1">
                          قم بتمرير الماوس أو انقر على الكلمات المظللة بالترجمة أسفل مشغل الفيديو لتشريح الكلمة صرفياً وتجذيرها هنا.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4 mt-6">
                  <div className="bg-secondary/40 rounded-xl p-3 border border-border text-[11px] leading-relaxed flex items-start gap-2.5 text-right">
                    <div className="w-4 h-4 text-primary shrink-0 mt-0.5 animate-pulse">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 10-2 0v1a1 1 0 102 0zM14.243 14.243a1 1 0 101.414-1.414l-.707-.707a1 1 0 10-1.414 1.414l.707.707z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">نصيحة ذهبية للمتعلم</p>
                      <p className="text-muted-foreground mt-0.5">ركز دائماً على فهم الحروف الجذرية (الْجِذْر). فتمكينك من الكشف عن الجذور الثلاثية يسهل فك رموز واشتقاقات مئات الكلمات تلقائياً!</p>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      <footer className="border-t border-border bg-card px-6 py-4 text-center text-xs text-muted-foreground">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
          <p>حقوق الطبع والنشر © 2026 تيسير للتعليم والاستماع المتدرج. مجمع الملك سلمان العالمي للغة العربية.</p>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setAppState('welcome')}
              className="hover:text-primary transition font-medium flex items-center gap-1.5"
            >
              إعادة تهيئة المشغل
            </button>
            <span>•</span>
            <span className="text-[10px] bg-secondary border border-border rounded px-2 py-0.5">موجه مسارات الصوت Web Audio API</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
