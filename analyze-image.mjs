import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

async function analyzeImage() {
  try {
    const zai = await ZAI.create();
    
    const imagePath = '/home/z/my-project/upload/Screenshot_20260327_152021_Chrome.jpg';
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'What does this screenshot show? Describe the page content, any error messages, URL bar content, and what the user is seeing. Be specific about whether this looks like a proper dashboard, landing page, or error page.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    });

    console.log('Analysis:', response.choices[0]?.message?.content);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeImage();
