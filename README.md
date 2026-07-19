This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## voice removal:_vocalremover.org
## [\u0621-\u064A]+ Arabic 
## Arabic diacritics: [\u064B-\u0652\u0670]

ffmpeg -i main.mp4 \
       -i arabic.wav \
       -i english.wav \
       -i lang_ar_hi.wav \
       -i lang_ar_lo.wav \
       -i arabic.srt \
       -i lang_en.srt \
       -i lang_ar_hi.srt \
       -i lang_ar_lo.srt \
       -map 0:v \
       -map 1:a -metadata:s:a:0 language=ara -metadata:s:a:0 title="Arabic" \
       -map 2:a -metadata:s:a:1 language=eng -metadata:s:a:1 title="English" \
       -map 3:a -metadata:s:a:2 language=ara -metadata:s:a:2 title="Arabic High" \
       -map 4:a -metadata:s:a:3 language=ara -metadata:s:a:3 title="Arabic Simple" \
       -map 5:s -metadata:s:s:0 language=ara -metadata:s:s:0 title="Arabic Subtitles" \
       -map 6:s -metadata:s:s:1 language=eng -metadata:s:s:1 title="English Subtitles" \
       -map 7:s -metadata:s:s:2 language=ara -metadata:s:s:2 title="Arabic High Subtitles" \
       -map 8:s -metadata:s:s:3 language=ara -metadata:s:s:3 title="Arabic Simple Subtitles" \
       -c:v copy -c:a aac -c:s srt lang_demo.mkv