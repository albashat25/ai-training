const fs = require('fs');

// تأكد من وجود ملف الأسئلة
const questionsFile = 'questions_batch1.json';
if (!fs.existsSync(questionsFile)) {
  console.error(`❌ خطأ: الملف ${questionsFile} غير موجود!`);
  process.exit(1);
}

const questions = JSON.parse(fs.readFileSync(questionsFile, 'utf8'));
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_KEY) {
  console.error(`❌ خطأ: DEEPSEEK_API_KEY غير موجود في Secrets!`);
  process.exit(1);
}

console.log(`🚀 بدء معالجة ${questions.length} سؤال`);

async function processAll() {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`[${i+1}/${questions.length}] معالجة: ${q.id || 'بدون ID'}`);
    
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: q.question }],
          max_tokens: 4000
        })
      });
      
      const data = await response.json();
      const answer = data.choices[0].message.content;
      
      if (!fs.existsSync('answers')) fs.mkdirSync('answers');
      const filename = `answers/${q.id || `q_${i+1}`}.json`;
      fs.writeFileSync(filename, JSON.stringify({ 
        id: q.id || `q_${i+1}`,
        question: q.question, 
        answer: answer,
        timestamp: new Date().toISOString()
      }, null, 2));
      
      console.log(`✅ تم حفظ: ${filename}`);
      
    } catch (err) {
      console.log(`❌ فشل السؤال ${i+1}: ${err.message}`);
    }
    
    // انتظر 2 ثانية بين كل سؤال
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('🎉 اكتملت المعالجة!');
}

processAll();
