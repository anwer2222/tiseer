'use client';

import { useState, useEffect } from 'react';

// 1. تحديد أنواع البيانات للقاموس
interface DictionaryEntry {
  translation: string;
  root: string;
  type: string;
  explanation: string;
}

type SubtitleDictionary = Record<string, DictionaryEntry>;

export default function ArabicPlayerConsole() {
  const [dictionary, setDictionary] = useState<SubtitleDictionary>({});
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  // 2. جلب القاموس من مجلد public عند تحميل المكون
  useEffect(() => {
    async function fetchDictionary() {
      try {
        const response = await fetch('/dictionary.json');
        const data = await response.json();
        setDictionary(data);
      } catch (error) {
        console.error("خطأ في تحميل ملف القاموس:", error);
      }
    }
    fetchDictionary();
  }, []);

  // نص تجريبي من القائمة الخاصة بك لعرض الآلية
  const sampleSubtitle = "اعتذر سمو الأمير لتأخري";

  // دالة تنظيف الكلمة من علامات الترقيم والحركات إذا لزم الأمر للمطابقة المفتاحية
  const cleanKey = (word: string) => {
    return word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()،؟]/g, "").trim();
  };

  return (
    <div className="p-6 bg-background text-foreground dir-rtl" dir="rtl">
      {/* صندوق الترجمة أسفل الفيديو */}
      <div className="p-4 rounded-lg bg-card border border-border text-center text-2xl">
        {sampleSubtitle.split(" ").map((word, index) => {
          const key = cleanKey(word);
          const hasDefinition = !!dictionary[key];

          return (
            <span
              key={index}
              className={`inline-block mx-1 transition-colors cursor-pointer relative group ${
                hasDefinition ? 'hover:text-primary border-b border-dashed border-muted-foreground' : ''
              }`}
              onMouseEnter={() => hasDefinition && setHoveredWord(key)}
              onMouseLeave={() => setHoveredWord(null)}
              onClick={() => hasDefinition && setSelectedWord(key)}
            >
              {word}

              {/* ميزة الـ Hover: عرض الترجمة الإنجليزية السريعة فوق الكلمة مباشرة */}
              {hoveredWord === key && dictionary[key]?.translation && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-popover text-popover-foreground rounded shadow-md whitespace-nowrap z-50">
                  {dictionary[key].translation}
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* ميزة الـ Click: فتح اللوحة الجانبية للتفاصيل الصرفية المعمقة */}
      {selectedWord && dictionary[selectedWord] && (
        <div className="mt-6 p-4 rounded-lg bg-secondary text-secondary-foreground border border-border">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xl font-bold font-sans">التشريح الصرفي: {selectedWord}</h3>
            <button 
              onClick={() => setSelectedWord(null)}
              className="text-sm bg-destructive text-destructive-foreground px-2 py-1 rounded"
            >
              إغلاق
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm font-mono">
            <div><strong>الترجمة (Translation):</strong> {dictionary[selectedWord].translation || 'غير متوفر'}</div>
            <div><strong>الجذر الثلاثي (Root):</strong> {dictionary[selectedWord].root || 'غير متوفر'}</div>
            <div><strong>نوع الكلمة (Type):</strong> {dictionary[selectedWord].type || 'غير متوفر'}</div>
            <div className="col-span-2"><strong>الشرح والسياق (Explanation):</strong> {dictionary[selectedWord].explanation || 'لا يوجد شرح متاح حالياً.'}</div>
          </div>
        </div>
      )}
    </div>
  );
}