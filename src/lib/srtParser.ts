export interface SubtitleCue {
    id: number;
    startTime: number; // بالثواني
    endTime: number;   // بالثواني
    text: string;
  }
  
  /**
   * تحول صيغة الوقت من SRT (مثل 00:01:23,450) إلى ثوانٍ عشرية (مثل 83.45)
   */
  function timeToSeconds(timeString: string): number {
    const [time, milliseconds] = timeString.split(',');
    const [hours, minutes, seconds] = time.split(':');
    return (
      parseInt(hours, 10) * 3600 +
      parseInt(minutes, 10) * 60 +
      parseInt(seconds, 10) +
      parseInt(milliseconds, 10) / 1000
    );
  }
  
  /**
   * تقوم بمعالجة وتحليل النص الكامل لملف الـ SRT وتحويله إلى مصفوفة من الـ SubtitleCue
   */
  export function parseSRT(srtContent: string): SubtitleCue[] {
    if (!srtContent || typeof srtContent !== 'string') return [];
  
    // توحيد نهايات الأسطر لمنع المشاكل بين بيئات التشغيل المختلفة (Windows/Mac/Linux)
    const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // تقسيم النص إلى كتل بناءً على السطر الفارغ المزدوج
    const blocks = normalized.split('\n\n').filter((block) => block.trim() !== '');
  
    return blocks
      .map((block) => {
        const lines = block.split('\n').map((line) => line.trim());
        
        // التخطي إذا كانت الكتلة لا تحتوي على الحد الأدنى من الأسطر المطلوبة (الرقم، الوقت، النص)
        if (lines.length < 3) return null;
  
        const id = parseInt(lines[0], 10);
        const timeLine = lines[1];
        
        // دمج الأسطر المتبقية التي تمثل نص الترجمة
        const text = lines.slice(2).filter(Boolean).join(' ');
  
        if (isNaN(id) || !timeLine || !timeLine.includes(' --> ')) return null;
  
        const [startStr, endStr] = timeLine.split(' --> ');
  
        try {
          return {
            id,
            startTime: timeToSeconds(startStr.trim()),
            endTime: timeToSeconds(endStr.trim()),
            text,
          };
        } catch (e) {
          console.warn('خطأ أثناء تحليل السطر الزمني للترجمة:', timeLine, e);
          return null;
        }
      })
      .filter((cue): cue is SubtitleCue => cue !== null);
  }