import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

process.env.ZAI_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiN2NhNzc0ODUtM2Q4ZS00OTZkLTg4MjktMTNiMjMwZGM4ZDlhIiwiY2hhdF9pZCI6ImNoYXQtYjVjNDBlZGEtNGEwYi00ZWRlLTk0MGYtMDhlOGEwMTUwMjVkIiwicGxhdGZvcm0iOiIifQ.v1euD8zs_PRvNBm9IU8-1ZWROeI-QapdlsV8j7Vp6jE';

async function analyze(imagePath, label) {
  try {
    const zai = await ZAI.create();
    const buf = fs.readFileSync(imagePath);
    const b64 = buf.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${b64}`;
    
    const response = await zai.chat.completions.createVision({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this screenshot in detail. What website URL is shown? What state is the page in - loading, error, or working? What UI elements and text are visible? Be specific about any error messages or issues.' },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }],
      thinking: { type: 'disabled' }
    });
    
    console.log(`\n=== ${label} ===`);
    console.log(response.choices[0]?.message?.content || 'No content');
  } catch (err) {
    console.error(`${label} error:`, err.message);
  }
}

await analyze('/home/z/my-project/upload/Screenshot_20260411_085048_Chrome.jpg', 'Screenshot 1 (085048)');
await analyze('/home/z/my-project/upload/Screenshot_20260411_085107_Chrome.jpg', 'Screenshot 2 (085107)');
await analyze('/home/z/my-project/upload/Screenshot_20260411_085352_Chrome.jpg', 'Screenshot 3 (085352)');
