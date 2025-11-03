const express = require('express');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');
const { spawn } = require('child_process');

const { translateText } = require('../services/translate');
const { generateSpeechFromText } = require('../services/tts');
const { getImagePrescriptionSummary, answerQuestionWithContext, analyzeMedicineImage } = require('../services/groq');
const { downloadTwilioMedia } = require('../utils/media');
const { SARVAM_API_KEY } = require('../config/env');

const userState = {};


module.exports = function webhookRouterFactory({ twilioClient }) {
  const router = express.Router();

  router.post('/whatsapp-webhook', async (req, res) => {
    const from = req.body.From;
    const timestamp = Date.now();
    const incomingMsg = req.body.Body?.toLowerCase().trim();
    const mediaUrl = req.body.MediaUrl0;
    const contentType = req.body.MediaContentType0;
    try {
      const langMap = {
        '1': { code: 'hi', label: 'Hindi' },
        '2': { code: 'en', label: 'English' },
        '3': { code: 'bn', label: 'Bengali' },
        '4': { code: 'ta', label: 'Tamil' },
        '5': { code: 'te', label: 'Telugu' },
        '6': { code: 'kn', label: 'Kannada' },
        '7': { code: 'ml', label: 'Malayalam' },
        '8': { code: 'mr', label: 'Marathi' },
        '9': { code: 'gu', label: 'Gujarati' }
      };

      const langCodeMap = {
        hi: 'hi-IN', en: 'en-IN', bn: 'bn-IN', ta: 'ta-IN',
        te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', mr: 'mr-IN', gu: 'gu-IN'
      };

      // Voice follow-up handler
      if (mediaUrl && contentType?.startsWith('audio') && userState[from]?.expectingVoice) {
        const oggFile = `voice_${timestamp}.ogg`;
        const wavFile = `voice_${timestamp}.wav`;
        const oggPath = path.join(__dirname, '../../public', oggFile);
        const wavPath = path.join(__dirname, '../../public', wavFile);

        await downloadTwilioMedia(mediaUrl, oggFile);

        await new Promise((resolve, reject) => {
          const ffmpeg = spawn('ffmpeg', ['-i', oggPath, '-ar', '16000', '-ac', '1', wavPath]);
          ffmpeg.stderr.on('data', data => console.error('ffmpeg:', data.toString()));
          ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error('FFmpeg failed')));
        });

        const form = new FormData();
        form.append('file', fs.createReadStream(wavPath));
        form.append('model', 'saarika:v2.5');
        form.append('language_code', 'unknown');

        const response = await fetch('https://api.sarvam.ai/speech-to-text', {
          method: 'POST',
          headers: {
            'api-subscription-key': SARVAM_API_KEY,
            ...form.getHeaders()
          },
          body: form
        });

        const result = await response.json();
        const transcript = result.transcript || 'Sorry, could not understand the audio.';

        await twilioClient.messages.create({
          from: 'whatsapp:+14155238886',
          to: from,
          body: `🗨️ Transcribed: ${transcript}\n\n💡 Processing your question...`
        });

        const prevSummary = userState[from]?.summary || '';
        const langCode = userState[from]?.languageCode || 'en-IN';
        const langLabel = userState[from]?.languageLabel || 'English';
        // Derive a 2-letter language code for text generation if possible
        const targetLang = (langCode.split('-')[0] || 'en');
        const replyText = await answerQuestionWithContext(prevSummary, transcript, targetLang);

        const audioAnswerURL = await generateSpeechFromText(replyText, langCode, timestamp);

        if (audioAnswerURL) {
          await twilioClient.messages.create({
            from: 'whatsapp:+14155238886',
            to: from,
            body: `🤖 Here's the answer to your question in ${langLabel}:`,
            mediaUrl: [audioAnswerURL]
          });
        } else {
          await twilioClient.messages.create({
            from: 'whatsapp:+14155238886',
            to: from,
            body: `🤖 Here's the answer to your question in ${langLabel}:\n\n${replyText}`
          });
        }

        try { fs.existsSync(oggPath) && fs.unlinkSync(oggPath); } catch (_) {}
        try { fs.existsSync(wavPath) && fs.unlinkSync(wavPath); } catch (_) {}

        return res.sendStatus(200);
      }

      // Stop command handler - reset to prescription flow
      if (incomingMsg === 'done') {
        userState[from] = {};
        await twilioClient.messages.create({
          from: 'whatsapp:+14155238886',
          to: from,
          body: '🔄 Session reset! Please send a new prescription photo to start again.'
        });
        return res.sendStatus(200);
      }

      // Link command handler
      if (incomingMsg === 'link' || incomingMsg === '🔗') {
        await twilioClient.messages.create({
          from: 'whatsapp:+14155238886',
          to: from,
          body: '🔗 Here\'s the link to Swaasthya-Saathi:\n\nhttps://swaasthya-saathi.vercel.app/\n\nAccess your health dashboard and manage your prescriptions!'
        });
        return res.sendStatus(200);
      }

      // Language selection handler
      if (userState[from]?.waitingForLanguage && incomingMsg) {
        const selectedLang = langMap[incomingMsg];
        if (!selectedLang) {
          await twilioClient.messages.create({
            from: 'whatsapp:+14155238886',
            to: from,
            body: '❌ Invalid option. Please reply with a valid number.'
          });
          return res.sendStatus(200);
        }

        let translated = '';
        if (userState[from].summary && userState[from].summary.trim()) {
          translated = await translateText(userState[from].summary, selectedLang.code);
        }
        if (!translated || translated.trim() === '') translated = userState[from].summary || 'No summary available';

        // Add reminder prompt to the prescription explanation in user's selected language
        const reminderPrompts = {
          'hi': 'क्या आप चाहते हैं कि मैं आपके नुस्खे के अनुसार आपकी दवाओं के लिए एक अनुस्मारक सेट करूं? फिर दो दबाएं।',
          'en': 'Would you like me to setup a reminder for your medicines as per your prescription? Then press two.',
          'bn': 'আপনি কি চান যে আমি আপনার প্রেসক্রিপশন অনুযায়ী আপনার ওষুধের জন্য একটি অনুস্মারক সেট করি? তাহলে দুই চাপুন।',
          'ta': 'உங்கள் மருந்துச்சீட்டின் படி உங்கள் மருந்துகளுக்கு நினைவூட்டல் அமைக்க விரும்புகிறீர்களா? பின்னர் இரண்டு அழுத்தவும்।',
          'te': 'మీరు మీ ప్రిస్క్రిప్షన్ ప్రకారం మీ మందులకు రిమైండర్ సెటప్ చేయాలనుకుంటున్నారా? అప్పుడు రెండు నొక్కండి।',
          'kn': 'ನಿಮ್ಮ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಪ್ರಕಾರ ನಿಮ್ಮ ಔಷಧಿಗಳಿಗೆ ರಿಮೈಂಡರ್ ಸೆಟಪ್ ಮಾಡಲು ನೀವು ಬಯಸುತ್ತೀರಾ? ನಂತರ ಎರಡು ಒತ್ತಿರಿ।',
          'ml': 'നിങ്ങളുടെ പ്രിസ്ക്രിപ്ഷൻ അനുസരിച്ച് നിങ്ങളുടെ മരുന്നുകൾക്ക് ഒരു ഓർമ്മപ്പെടുത്തൽ സജ്ജമാക്കാൻ നിങ്ങൾ ആഗ്രഹിക്കുന്നുണ്ടോ? പിന്നെ രണ്ട് അമർത്തുക।',
          'mr': 'तुम्हाला तुमच्या प्रिस्क्रिप्शननुसार तुमच्या औषधांसाठी रिमाइंडर सेट करायचा आहे का? मग दोन दाबा।',
          'gu': 'શું તમે ઇચ્છો છો કે હું તમારા પ્રિસ્ક્રિપ્શન મુજબ તમારી દવાઓ માટે રિમાઇન્ડર સેટ કરું? પછી બે દબાવો।'
        };
        
        const reminderPromptTranslated = reminderPrompts[selectedLang.code] || reminderPrompts['en'];
        console.log('Using manual reminder prompt for:', selectedLang.label);
        console.log('Reminder prompt:', reminderPromptTranslated);
        const combinedText = translated + '\n\n' + reminderPromptTranslated;
        
        
        console.log('Generating combined prescription + reminder audio in', selectedLang.label, '...');
        console.log('Using TTS language code:', langCodeMap[selectedLang.code]);
        console.log('Combined text length:', combinedText.length);
        console.log('Combined text preview:', combinedText.substring(0, 200) + '...');
        
        // Ensure the text is properly formatted for TTS
        const cleanCombinedText = combinedText.replace(/\n\n/g, ' ').trim();
        console.log('Cleaned text for TTS:', cleanCombinedText.substring(0, 200) + '...');
        
        const audioURL = await generateSpeechFromText(cleanCombinedText, langCodeMap[selectedLang.code], timestamp);

        if (audioURL) {
          await twilioClient.messages.create({
            from: 'whatsapp:+14155238886',
            to: from,
            body: `🎧 Here's your prescription summary with reminder prompt in ${selectedLang.label}:`,
            mediaUrl: [audioURL]
          });
        } else {
          await twilioClient.messages.create({
            from: 'whatsapp:+14155238886',
            to: from,
            body: `📝 Here's your prescription summary in ${selectedLang.label}:\n\n${combinedText}`
          });
        }

        userState[from].waitingForLanguage = false;
        userState[from].expectingVoice = true;
        userState[from].languageCode = langCodeMap[selectedLang.code];
        userState[from].languageLabel = selectedLang.label;

        // Reminder prompt is now combined with prescription explanation above

        await twilioClient.messages.create({
          from: 'whatsapp:+14155238886',
          to: from,
          body: '🎤 You can now send voice notes to ask questions about the prescription.'
        });

        console.log('Language selection handler completed successfully');
        return res.sendStatus(200);
      }

      // Reminder setup handler
      if (incomingMsg === '2' && userState[from]?.expectingVoice) {
        console.log('User pressed 2 for reminder setup');
        const langCode = userState[from]?.languageCode || 'en-IN';
        const langLabel = userState[from]?.languageLabel || 'English';
        
        // Create confirmation messages in each language
        const confirmationMessages = {
          'hi-IN': 'आपके नुस्खे के अनुसार आपकी दवाओं के लिए अनुस्मारक सेट कर दिया गया है।',
          'en-IN': 'Reminder has been setup for your medicines as per your prescription.',
          'bn-IN': 'আপনার প্রেসক্রিপশন অনুযায়ী আপনার ওষুধের জন্য অনুস্মারক সেট করা হয়েছে।',
          'ta-IN': 'உங்கள் மருந்துச்சீட்டின் படி உங்கள் மருந்துகளுக்கு நினைவூட்டல் அமைக்கப்பட்டது।',
          'te-IN': 'మీ ప్రిస్క్రిప్షన్ ప్రకారం మీ మందులకు రిమైండర్ సెట్ చేయబడింది।',
          'kn-IN': 'ನಿಮ್ಮ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಪ್ರಕಾರ ನಿಮ್ಮ ಔಷಧಿಗಳಿಗೆ ರಿಮೈಂಡರ್ ಸೆಟ್ ಮಾಡಲಾಗಿದೆ।',
          'ml-IN': 'നിങ്ങളുടെ പ്രിസ്ക്രിപ്ഷൻ അനുസരിച്ച് നിങ്ങളുടെ മരുന്നുകൾക്ക് ഓർമ്മപ്പെടുത്തൽ സജ്ജമാക്കി।',
          'mr-IN': 'तुमच्या प्रिस्क्रिप्शननुसार तुमच्या औषधांसाठी रिमाइंडर सेट केले आहे।',
          'gu-IN': 'તમારા પ્રિસ્ક્રિપ્શન મુજબ તમારી દવાઓ માટે રિમાઇન્ડર સેટ કરવામાં આવ્યું છે।'
        };
        
        const confirmationMessage = confirmationMessages[langCode] || confirmationMessages['en-IN'];
        console.log('Using confirmation message in:', langLabel);
        console.log('Confirmation message:', confirmationMessage);
        console.log('Generating confirmation audio for:', confirmationMessage);
        const confirmationAudioURL = await generateSpeechFromText(confirmationMessage, langCode, timestamp);
        console.log('Confirmation audio URL:', confirmationAudioURL);

        if (confirmationAudioURL) {
          await twilioClient.messages.create({
            from: 'whatsapp:+14155238886',
            to: from,
            body: `✅ ${confirmationMessage}`,
            mediaUrl: [confirmationAudioURL]
          });
          console.log('Sent confirmation with audio');
        } else {
          await twilioClient.messages.create({
            from: 'whatsapp:+14155238886',
            to: from,
            body: `✅ ${confirmationMessage}`
          });
          console.log('Sent confirmation without audio');
        }

        return res.sendStatus(200);
      }

      // Prescription image handler (only when no prescription summary captured yet)
      if (mediaUrl && contentType?.startsWith('image') && !userState[from]?.summary) {
        const localImageFile = `twilio_img_${timestamp}.jpg`;
        const groqImageUrl = await downloadTwilioMedia(mediaUrl, localImageFile);

        const summary = await getImagePrescriptionSummary(groqImageUrl);
        userState[from] = { waitingForLanguage: true, summary, expectingVoice: false, awaitingMedicinePhoto: true };

        const languageList = `
1 Hindi
2 English
3 Bengali
4 Tamil
5 Telugu
6 Kannada
7 Malayalam
8 Marathi
9 Gujarati

Please send the number of your preferred language.
`;

        const langAudioURL = await generateSpeechFromText(languageList, 'hi-IN', timestamp);

        await twilioClient.messages.create({
          from: 'whatsapp:+14155238886',
          to: from,
          body: `🎙️ Please listen and reply with a number (1–9) to select your language.`,
          mediaUrl: [langAudioURL]
        });

        await twilioClient.messages.create({
          from: 'whatsapp:+14155238886',
          to: from,
          body:
            '🗣️ In which language would you like to hear the summary?\n' +
            '1. हिंदी\n2. English\n3. বাংলা\n4. தமிழ்\n5. తెలుగు\n6. ಕನ್ನಡ\n7.മലയാളം \n8. मराठी\n9. ગુજરાતી\n' +
            '\n👉 Reply with the number (1–9).\n\n' +
            '💡 Tip: Type "LINK" or "🔗" anytime to access your health dashboard!'
        });

        await twilioClient.messages.create({
          from: 'whatsapp:+14155238886',
          to: from,
          body: '📸 After choosing language, please send a clear photo of each medicine label one by one to get spoken instructions.'
        });
      }

      // Medicine image handler (after prescription captured)
      if (mediaUrl && contentType?.startsWith('image') && userState[from]?.awaitingMedicinePhoto && userState[from]?.summary) {
        const localImageFile = `medicine_${timestamp}.jpg`;
        const hostedUrl = await downloadTwilioMedia(mediaUrl, localImageFile);

        const targetLang = (userState[from]?.languageCode || 'en-IN').split('-')[0] || 'en';
        const analysis = await analyzeMedicineImage(userState[from].summary, hostedUrl, targetLang);

        const langCode = userState[from]?.languageCode || 'en-IN';
        const langLabel = userState[from]?.languageLabel || 'English';

        // AI handles all logic - just use the instructions it provides
        const instructions = analysis.instructions || analysis.warning || 'No information available from the image.';
        
        const audioURL = await generateSpeechFromText(instructions, langCode, timestamp);
        
        if (audioURL) {
          await twilioClient.messages.create({
            from: 'whatsapp:+14155238886',
            to: from,
            body: `📄 Information from your image in ${langLabel}:`,
            mediaUrl: [audioURL]
          });
        } else {
          await twilioClient.messages.create({
            from: 'whatsapp:+14155238886',
            to: from,
            body: `📄 Information from your image:\n\n${instructions}`
          });
        }
      }

      res.sendStatus(200);
    } catch (err) {
      console.error('❌ Error:', err.message);
      res.sendStatus(500);
    }
  });

  return router;
};


